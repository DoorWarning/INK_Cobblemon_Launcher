import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';
import type { Manifest, ManifestAsset, SyncProgress } from '@shared/types';
import {
  modsDir,
  resourcePacksDir,
  cacheDir,
  stateFile,
  optionsFile,
  sodiumConfigFile,
  ensureDirs
} from './paths';
import { log } from './logger';
import {
  DEFAULTS_VERSION,
  DEFAULT_OPTIONS_SOFT,
  DEFAULT_OPTIONS_HARD,
  DEFAULT_BUILTIN_PACK_IDS,
  DEFAULT_SODIUM_CONFIG
} from './defaults';

// Full URL including scheme AND path, e.g.
// If unset, empty, or invalid, the launcher falls back to the manifest bundled inside the app.
const REMOTE_MANIFEST_URL =
  process.env.INK_MANIFEST_URL ??
  'https://raw.githubusercontent.com/DoorWarning/INK_Cobblemon_Launcher/refs/heads/main/manifest/manifest.json';

type ProgressFn = (p: SyncProgress) => void;

interface LocalState {
  installed: Record<string, { sha1: string; type: ManifestAsset['type'] }>;
  defaultsAppliedVersion?: number;
}

function loadState(): LocalState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as LocalState;
  } catch {
    return { installed: {} };
  }
}

function saveState(s: LocalState): void {
  fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2), 'utf8');
}

function targetDirFor(type: ManifestAsset['type']): string {
  return type === 'mod' ? modsDir() : resourcePacksDir();
}

function fileNameFromUrl(url: string): string {
  const clean = url.split('?')[0]!;
  const raw = clean.substring(clean.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function sha1File(p: string): string {
  const buf = fs.readFileSync(p);
  return crypto.createHash('sha1').update(buf).digest('hex').toLowerCase();
}

function loadBundledManifest(): Manifest {
  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, 'manifest.json')
    : path.join(app.getAppPath(), 'manifest', 'manifest.json');
  return JSON.parse(fs.readFileSync(bundled, 'utf8')) as Manifest;
}

function isValidHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchManifest(): Promise<Manifest> {
  const url = REMOTE_MANIFEST_URL.trim();
  if (!url || url.includes('CHANGE_ME') || !isValidHttpUrl(url)) {
    log.warn(
      `Remote manifest URL invalid or unset ("${url}"); falling back to bundled manifest. ` +
        `Set INK_MANIFEST_URL to a full URL like "http://host:port/manifest.json".`
    );
    return loadBundledManifest();
  }
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as Manifest;
  } catch (err) {
    log.warn(`Remote manifest fetch failed (${String(err)}); falling back to bundled manifest.`);
    return loadBundledManifest();
  }
}

async function downloadWithRetry(
  asset: ManifestAsset,
  destPath: string,
  onBytes: (downloaded: number, total: number) => void
): Promise<void> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');
      const total = Number(res.headers.get('content-length') ?? asset.size);
      const tmp = `${destPath}.part`;
      const out = fs.createWriteStream(tmp);
      const hash = crypto.createHash('sha1');
      let received = 0;
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          hash.update(value);
          out.write(value);
          received += value.byteLength;
          onBytes(received, total);
        }
      }
      await new Promise<void>((resolve, reject) => {
        out.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });
      const digest = hash.digest('hex').toLowerCase();
      if (digest !== asset.sha1.toLowerCase()) {
        fs.unlinkSync(tmp);
        throw new Error(`SHA-1 mismatch: expected ${asset.sha1}, got ${digest}`);
      }
      fs.renameSync(tmp, destPath);
      return;
    } catch (err) {
      lastErr = err;
      log.warn(`Download attempt ${attempt}/${maxAttempts} failed for ${asset.name}: ${String(err)}`);
    }
  }
  throw new Error(`Download failed after ${maxAttempts} attempts: ${String(lastErr)}`);
}

function parseOptionsTxt(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    map.set(line.substring(0, idx), line.substring(idx + 1));
  }
  return map;
}

function serializeOptionsTxt(map: Map<string, string>): string {
  return Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join('\n') + '\n';
}

function currentResourcePacks(map: Map<string, string>): string[] {
  const raw = map.get('resourcePacks');
  if (!raw) return ['vanilla', 'fabric'];
  try {
    const arr = JSON.parse(raw.trim()) as unknown;
    return Array.isArray(arr) ? arr.map(String) : ['vanilla', 'fabric'];
  } catch {
    return ['vanilla', 'fabric'];
  }
}

function applyDefaults(assets: ManifestAsset[], state: LocalState): void {
  const filePacks = assets
    .filter((a) => a.type === 'resource' && a.autoEnable)
    .map((a) => `file/${fileNameFromUrl(a.url)}`);

  const firstTime = (state.defaultsAppliedVersion ?? 0) < DEFAULTS_VERSION;

  let existing = '';
  try {
    existing = fs.readFileSync(optionsFile(), 'utf8');
  } catch {
    // options.txt does not exist yet
  }
  const map = parseOptionsTxt(existing);

  // Apply defaults only on version bump (or first-ever run). Between bumps,
  // user changes made in-game are fully respected.
  if (firstTime) {
    // Soft: fill missing preferences (never overwrite user's own choice).
    for (const [k, v] of Object.entries(DEFAULT_OPTIONS_SOFT)) {
      if (!map.has(k)) map.set(k, v);
    }
    // Hard: forced key bindings — user asked for these specifically, so
    // clobber whatever a mod wrote as its default.
    for (const [k, v] of Object.entries(DEFAULT_OPTIONS_HARD)) {
      map.set(k, v);
    }
  }

  // Resource pack list: file-based packs from the manifest are ALWAYS ensured
  // present (they're required assets). Built-in mod packs are only forced on
  // the first-time apply so the user can later remove them via the in-game UI.
  const packs = new Set(currentResourcePacks(map));
  for (const p of filePacks) packs.add(p);
  if (firstTime) {
    for (const p of DEFAULT_BUILTIN_PACK_IDS) packs.add(p);
  }
  map.set('resourcePacks', JSON.stringify(Array.from(packs)));

  fs.writeFileSync(optionsFile(), serializeOptionsTxt(map), 'utf8');

  // Sodium config: only write on very first launch (never overwrite user's tuning).
  const sodiumPath = sodiumConfigFile();
  if (!fs.existsSync(sodiumPath)) {
    fs.writeFileSync(sodiumPath, JSON.stringify(DEFAULT_SODIUM_CONFIG, null, 2), 'utf8');
    log.info(`Wrote initial Sodium config at ${sodiumPath}`);
  }

  if (firstTime) {
    state.defaultsAppliedVersion = DEFAULTS_VERSION;
    log.info(`Applied first-launch defaults (version ${DEFAULTS_VERSION})`);
  }
}

export async function syncAssets(onProgress: ProgressFn): Promise<Manifest> {
  ensureDirs();

  onProgress({ stage: 'fetching-manifest', message: '매니페스트 확인 중…' });
  const manifest = await fetchManifest();

  onProgress({ stage: 'checking', message: '로컬 파일 검증 중…' });
  const state = loadState();
  const wanted = new Map<string, ManifestAsset>();
  for (const asset of manifest.assets) {
    const filename = fileNameFromUrl(asset.url);
    const key = `${asset.type}/${filename}`;
    wanted.set(key, asset);
  }

  const total = manifest.assets.length;
  let i = 0;
  for (const asset of manifest.assets) {
    i += 1;
    const filename = fileNameFromUrl(asset.url);
    const dest = path.join(targetDirFor(asset.type), filename);
    const key = `${asset.type}/${filename}`;

    let needsDownload = true;
    if (fs.existsSync(dest)) {
      try {
        const localHash = sha1File(dest);
        if (localHash === asset.sha1.toLowerCase()) {
          needsDownload = false;
        }
      } catch {
        needsDownload = true;
      }
    }

    if (!needsDownload) {
      state.installed[key] = { sha1: asset.sha1.toLowerCase(), type: asset.type };
      continue;
    }

    onProgress({
      stage: 'downloading',
      message: `${asset.name} 다운로드 중… (${i}/${total})`,
      currentIndex: i,
      totalCount: total,
      currentFile: asset.name
    });
    await downloadWithRetry(asset, dest, (bytes, tot) => {
      onProgress({
        stage: 'downloading',
        message: `${asset.name} 다운로드 중… (${i}/${total})`,
        currentIndex: i,
        totalCount: total,
        currentFile: asset.name,
        bytesDownloaded: bytes,
        bytesTotal: tot
      });
    });
    state.installed[key] = { sha1: asset.sha1.toLowerCase(), type: asset.type };
  }

  // Delete local files that are no longer in the manifest
  for (const key of Object.keys(state.installed)) {
    if (!wanted.has(key)) {
      const [type, filename] = key.split('/', 2);
      const dir = type === 'mod' ? modsDir() : resourcePacksDir();
      const p = path.join(dir, filename ?? '');
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
        log.info(`Removed stale asset: ${key}`);
      } catch (err) {
        log.warn(`Failed to remove stale ${key}: ${String(err)}`);
      }
      delete state.installed[key];
    }
  }

  applyDefaults(manifest.assets, state);
  saveState(state);
  onProgress({ stage: 'done', message: '모드 동기화 완료', currentIndex: total, totalCount: total });
  return manifest;
}

export { cacheDir };
