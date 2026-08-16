import { Auth } from 'msmc';
import type { PlayerProfile } from '@shared/types';
import { log } from './logger';

type MsmcResult = Awaited<ReturnType<Awaited<ReturnType<Auth['launch']>>['getMinecraft']>>;

let currentToken: MsmcResult | null = null;

export async function login(): Promise<PlayerProfile> {
  const authManager = new Auth('select_account');
  log.info('Starting MSA login flow');
  const xbox = await authManager.launch('electron');
  const mc = await xbox.getMinecraft();
  currentToken = mc;
  const profile: PlayerProfile = {
    name: mc.profile?.name ?? 'Unknown',
    uuid: mc.profile?.id ?? '',
    avatarUrl: mc.profile?.id
      ? `https://mc-heads.net/avatar/${mc.profile.id}/64`
      : ''
  };
  log.info(`Logged in as ${profile.name} (${profile.uuid})`);
  return profile;
}

export function logout(): void {
  currentToken = null;
  log.info('Logged out');
}

export function currentProfile(): PlayerProfile | null {
  if (!currentToken?.profile) return null;
  return {
    name: currentToken.profile.name,
    uuid: currentToken.profile.id,
    avatarUrl: `https://mc-heads.net/avatar/${currentToken.profile.id}/64`
  };
}

export function currentMclcAuth(): ReturnType<MsmcResult['mclc']> | null {
  if (!currentToken) return null;
  return currentToken.mclc();
}
