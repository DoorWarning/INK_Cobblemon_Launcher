import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { IPC, type SyncProgress } from '@shared/types';
import { ensureDirs } from './paths';
import { log } from './logger';
import { login, logout, currentProfile } from './auth';
import { syncAssets } from './sync';
import { launchGame } from './launch';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.Login, async () => {
    try {
      return { ok: true, profile: await login() };
    } catch (err) {
      log.error(`Login failed: ${String(err)}`);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC.Logout, () => {
    logout();
    return { ok: true };
  });

  ipcMain.handle(IPC.GetProfile, () => ({ profile: currentProfile() }));

  ipcMain.handle(IPC.Launch, async () => {
    const send = (p: SyncProgress) => mainWindow?.webContents.send(IPC.OnProgress, p);
    const sendGame = (e: { kind: string; text: string }) =>
      mainWindow?.webContents.send(IPC.OnGameEvent, e);
    try {
      const manifest = await syncAssets(send);
      await launchGame(manifest, send, sendGame);
      return { ok: true };
    } catch (err) {
      const msg = String(err);
      log.error(`Launch failed: ${msg}`);
      send({ stage: 'error', message: '실행 실패', error: msg });
      return { ok: false, error: msg };
    }
  });
}

app.whenReady().then(() => {
  ensureDirs();
  log.info(`Ink Launcher ${app.getVersion()} starting`);
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
