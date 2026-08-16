import fs from 'node:fs';
import path from 'node:path';
import { Client, type ILauncherOptions } from 'minecraft-launcher-core';
import type { Manifest, SyncProgress } from '@shared/types';
import { dataRoot } from './paths';
import { currentMclcAuth } from './auth';
import { log } from './logger';

type ProgressFn = (p: SyncProgress) => void;
type GameEventFn = (evt: { kind: 'data' | 'debug' | 'close' | 'error'; text: string }) => void;

async function ensureFabricProfile(root: string, mcVersion: string, loaderVersion: string): Promise<string> {
  const profileId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const profileDir = path.join(root, 'versions', profileId);
  const profileJsonPath = path.join(profileDir, `${profileId}.json`);
  if (!fs.existsSync(profileJsonPath)) {
    log.info(`Downloading Fabric profile JSON: ${profileId}`);
    const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fabric meta fetch failed: ${res.status}`);
    const text = await res.text();
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(profileJsonPath, text, 'utf8');
  }
  return profileId;
}

export async function launchGame(
  manifest: Manifest,
  onProgress: ProgressFn,
  onGameEvent: GameEventFn
): Promise<void> {
  const auth = currentMclcAuth();
  if (!auth) throw new Error('로그인이 필요합니다.');

  const root = dataRoot();
  const mc = manifest.minecraft;

  onProgress({ stage: 'installing-fabric', message: 'Fabric 로더 준비 중…' });
  const profileId = await ensureFabricProfile(root, mc.version, mc.loaderVersion);

  const launcher = new Client();

  launcher.on('debug', (msg: string) => {
    log.info(`[mlc-debug] ${msg}`);
    onGameEvent({ kind: 'debug', text: msg });
  });
  launcher.on('data', (msg: string) => {
    onGameEvent({ kind: 'data', text: msg });
  });
  launcher.on('progress', (e: { type: string; task: number; total: number }) => {
    onProgress({
      stage: 'installing-fabric',
      message: `${e.type} ${e.task}/${e.total}`,
      currentIndex: e.task,
      totalCount: e.total
    });
  });
  launcher.on('close', (code: number) => {
    log.info(`Minecraft closed with code ${code}`);
    onGameEvent({ kind: 'close', text: `Minecraft exited (code ${code})` });
  });

  onProgress({ stage: 'launching', message: '마인크래프트 실행 중…' });

  const opts: ILauncherOptions = {
    // msmc's MclcUser has optional client_token; mlc's IUser requires it. Bridged at runtime.
    authorization: auth as unknown as ILauncherOptions['authorization'],
    root,
    version: {
      number: mc.version,
      type: 'release',
      custom: profileId
    },
    memory: {
      max: `${Math.floor(mc.memoryMB.max)}M`,
      min: `${Math.floor(mc.memoryMB.min)}M`
    },
    overrides: {
      detached: false
    }
  };
  await launcher.launch(opts);

  onProgress({ stage: 'running', message: '게임 실행 중' });
}
