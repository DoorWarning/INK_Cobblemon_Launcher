#!/usr/bin/env node
// Regenerate manifest/manifest.json from local mods/ and resources/ folders,
// resolving each file against the Modrinth /v2/version_files batch API.
// Any file not found on Modrinth becomes a source:"direct" entry with url:"TODO".
//
// Usage: node scripts/gen-manifest.mjs

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const modsDir = path.join(root, 'mods');
const resDir = path.join(root, 'resources');
const outDir = path.join(root, 'manifest');
const outFile = path.join(outDir, 'manifest.json');

const MC = { version: '1.21.1', loader: 'fabric', loaderVersion: '0.19.3', java: '21', memoryMB: { min: 6144, max: 8192 } };
const UA = 'InkLauncher/0.1 (poiu3405@gmail.com)';

function listFiles(dir, type) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => {
      const p = path.join(dir, n);
      return statSync(p).isFile();
    })
    .map((n) => {
      const p = path.join(dir, n);
      const buf = readFileSync(p);
      const sha1 = createHash('sha1').update(buf).digest('hex').toLowerCase();
      return { name: path.parse(n).name, filename: n, size: buf.byteLength, sha1, type };
    });
}

async function queryModrinth(hashes) {
  const res = await fetch('https://api.modrinth.com/v2/version_files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ hashes, algorithm: 'sha1' })
  });
  if (!res.ok) throw new Error(`Modrinth API ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function main() {
  const files = [...listFiles(modsDir, 'mod'), ...listFiles(resDir, 'resource')];
  if (files.length === 0) {
    console.error('No files found in mods/ or resources/. Nothing to do.');
    process.exit(1);
  }
  console.log(`Hashing done: ${files.length} files. Querying Modrinth…`);

  const map = await queryModrinth(files.map((f) => f.sha1));

  const assets = files.map((f) => {
    const v = map[f.sha1];
    if (!v) {
      const entry = { type: f.type, name: f.name, source: 'direct', url: 'TODO', sha1: f.sha1, size: f.size };
      if (f.type === 'resource') entry.autoEnable = true;
      console.warn(`  [not on Modrinth] ${f.filename} — set source:"direct" with TODO url`);
      return entry;
    }
    const file = (v.files ?? []).find((x) => (x.hashes?.sha1 ?? '').toLowerCase() === f.sha1)
      ?? v.files?.find((x) => x.primary) ?? v.files?.[0];
    const entry = {
      type: f.type,
      name: f.name,
      source: 'modrinth',
      projectId: v.project_id,
      versionId: v.id,
      url: file.url,
      sha1: f.sha1,
      size: file.size
    };
    if (f.type === 'resource') entry.autoEnable = true;
    return entry;
  });

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    minecraft: MC,
    assets
  };
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outFile} with ${assets.length} assets.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
