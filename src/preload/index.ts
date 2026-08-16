import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type PlayerProfile, type SyncProgress } from '@shared/types';

type LoginResult = { ok: true; profile: PlayerProfile } | { ok: false; error: string };
type LaunchResult = { ok: true } | { ok: false; error: string };
type GameEvent = { kind: 'data' | 'debug' | 'close' | 'error'; text: string };

export const api = {
  login: (): Promise<LoginResult> => ipcRenderer.invoke(IPC.Login),
  logout: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.Logout),
  getProfile: (): Promise<{ profile: PlayerProfile | null }> => ipcRenderer.invoke(IPC.GetProfile),
  launch: (): Promise<LaunchResult> => ipcRenderer.invoke(IPC.Launch),
  onProgress: (cb: (p: SyncProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: SyncProgress) => cb(p);
    ipcRenderer.on(IPC.OnProgress, listener);
    return () => ipcRenderer.off(IPC.OnProgress, listener);
  },
  onGameEvent: (cb: (e: GameEvent) => void): (() => void) => {
    const listener = (_e: unknown, evt: GameEvent) => cb(evt);
    ipcRenderer.on(IPC.OnGameEvent, listener);
    return () => ipcRenderer.off(IPC.OnGameEvent, listener);
  }
};

contextBridge.exposeInMainWorld('ink', api);
