import { useCallback, useEffect, useState } from 'react';
import type { PlayerProfile, SyncProgress } from '@shared/types';

type Status = 'idle' | 'busy' | 'running' | 'error';

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [progress, setProgress] = useState<SyncProgress>({ stage: 'idle', message: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    window.ink.getProfile().then((r) => setProfile(r.profile));
    const off = window.ink.onProgress((p) => {
      setProgress(p);
      if (p.stage === 'error') {
        setStatus('error');
        setErrorText(p.error ?? p.message);
      } else if (p.stage === 'running') {
        setStatus('running');
      } else if (p.stage === 'done') {
        // 'done' from sync — launch will follow, keep busy
      }
    });
    const off2 = window.ink.onGameEvent((e) => {
      if (e.kind === 'close') {
        setStatus('idle');
        setProgress({ stage: 'idle', message: '' });
      }
    });
    return () => {
      off();
      off2();
    };
  }, []);

  const handleLogin = useCallback(async () => {
    setStatus('busy');
    setErrorText('');
    const r = await window.ink.login();
    if (r.ok) {
      setProfile(r.profile);
      setStatus('idle');
    } else {
      setStatus('error');
      setErrorText(r.error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await window.ink.logout();
    setProfile(null);
  }, []);

  const handleLaunch = useCallback(async () => {
    if (!profile) {
      await handleLogin();
      return;
    }
    setStatus('busy');
    setErrorText('');
    setProgress({ stage: 'fetching-manifest', message: '준비 중…' });
    const r = await window.ink.launch();
    if (!r.ok) {
      setStatus('error');
      setErrorText(r.error);
    }
  }, [profile, handleLogin]);

  const busy = status === 'busy';
  const running = status === 'running';
  const buttonLabel = !profile
    ? '로그인'
    : running
      ? '게임 실행 중…'
      : busy
        ? '준비 중…'
        : '게임 시작';

  const barPct =
    progress.bytesTotal && progress.bytesTotal > 0
      ? Math.min(100, ((progress.bytesDownloaded ?? 0) / progress.bytesTotal) * 100)
      : progress.currentIndex && progress.totalCount
        ? (progress.currentIndex / progress.totalCount) * 100
        : progress.stage === 'done' || progress.stage === 'running'
          ? 100
          : 0;

  return (
    <div className="app">
      <div className="bg" />
      <div className="overlay" />

      <header className="topbar">
        <div className="brand">Ink Launcher · 잉크 코블몬</div>
        <div className="profile-slot">
          {profile ? (
            <>
              {profile.avatarUrl && <img className="avatar" src={profile.avatarUrl} alt="" />}
              <span className="nickname">{profile.name}</span>
              <button className="ghost" onClick={handleLogout} disabled={busy || running}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="ghost" onClick={handleLogin} disabled={busy}>
              로그인
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <button
          className={`launch ${busy || running ? 'launch--busy' : ''}`}
          onClick={handleLaunch}
          disabled={busy || running}
        >
          {buttonLabel}
        </button>
      </main>

      <footer className="bottombar">
        <div className="progress-wrap">
          <div className="progress-bar">
            <div
              className={`progress-fill ${progress.stage === 'error' ? 'progress-fill--err' : ''}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="status-text">
            {status === 'error'
              ? `오류: ${errorText}`
              : progress.message || '대기 중'}
            {progress.currentIndex && progress.totalCount
              ? `  ·  ${progress.currentIndex}/${progress.totalCount}`
              : ''}
          </div>
        </div>
      </footer>
    </div>
  );
}
