import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR_NAME = '.ink_cobblemon';

export function dataRoot(): string {
  return path.join(app.getPath('appData'), DATA_DIR_NAME);
}

export function modsDir(): string {
  return path.join(dataRoot(), 'mods');
}

export function resourcePacksDir(): string {
  return path.join(dataRoot(), 'resourcepacks');
}

export function cacheDir(): string {
  return path.join(dataRoot(), 'cache');
}

export function stateFile(): string {
  return path.join(cacheDir(), 'state.json');
}

export function optionsFile(): string {
  return path.join(dataRoot(), 'options.txt');
}

export function configDir(): string {
  return path.join(dataRoot(), 'config');
}

export function sodiumConfigFile(): string {
  return path.join(configDir(), 'sodium-options.json');
}

export function logsDir(): string {
  return path.join(dataRoot(), 'logs');
}

export function ensureDirs(): void {
  for (const dir of [dataRoot(), modsDir(), resourcePacksDir(), cacheDir(), configDir(), logsDir()]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
