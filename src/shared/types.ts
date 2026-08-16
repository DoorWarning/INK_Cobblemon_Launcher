export type AssetType = 'mod' | 'resource';
export type AssetSource = 'modrinth' | 'direct';

export interface ManifestAsset {
  type: AssetType;
  name: string;
  source: AssetSource;
  projectId?: string;
  versionId?: string;
  url: string;
  sha1: string;
  size: number;
  autoEnable?: boolean;
  required?: boolean;
}

export interface Manifest {
  schemaVersion: 1;
  generatedAt: string;
  minecraft: {
    version: string;
    loader: 'fabric';
    loaderVersion: string;
    java: string;
    memoryMB: { min: number; max: number };
  };
  assets: ManifestAsset[];
}

export interface PlayerProfile {
  name: string;
  uuid: string;
  avatarUrl: string;
}

export type SyncStage =
  | 'idle'
  | 'fetching-manifest'
  | 'checking'
  | 'downloading'
  | 'installing-fabric'
  | 'launching'
  | 'running'
  | 'done'
  | 'error';

export interface SyncProgress {
  stage: SyncStage;
  message: string;
  currentIndex?: number;
  totalCount?: number;
  currentFile?: string;
  bytesDownloaded?: number;
  bytesTotal?: number;
  error?: string;
}

export const IPC = {
  Login: 'ink:login',
  Logout: 'ink:logout',
  GetProfile: 'ink:get-profile',
  Launch: 'ink:launch',
  OnProgress: 'ink:progress',
  OnGameEvent: 'ink:game-event'
} as const;
