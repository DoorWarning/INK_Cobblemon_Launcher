import fs from 'node:fs';
import path from 'node:path';
import { logsDir } from './paths';

function todayFile(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return path.join(logsDir(), `launcher-${ymd}.log`);
}

function write(level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(todayFile(), line, 'utf8');
  } catch {
    // ignore log-write failures
  }
  const c = level === 'ERROR' ? console.error : console.log;
  c(line.trimEnd());
}

export const log = {
  info: (m: string) => write('INFO', m),
  warn: (m: string) => write('WARN', m),
  error: (m: string) => write('ERROR', m)
};
