import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { dataRoot } from './paths';
import { log } from './logger';

// Oracle GraalVM JDK 21 for Windows x64 — always redirects to the latest 21.x.
// GraalVM's HotSpot-based JIT + Truffle typically yields better throughput on
// modded Minecraft than a stock OpenJDK.
const GRAALVM_URL = 'https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_windows-x64_bin.zip';

type ProgressFn = (msg: string, bytes?: number, total?: number) => void;

function javaRoot(): string {
  return path.join(dataRoot(), 'java');
}

// The extracted zip has a top-level folder like "graalvm-jdk-21.0.5+9.1/".
// Find whichever exists and points to a real bin/java.exe.
function findJavaExe(root: string): string | null {
  if (!fs.existsSync(root)) return null;
  for (const name of fs.readdirSync(root)) {
    const candidate = path.join(root, name, 'bin', 'java.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function ensureGraalVMJava(onProgress: ProgressFn): Promise<string> {
  const root = javaRoot();
  fs.mkdirSync(root, { recursive: true });

  const existing = findJavaExe(root);
  if (existing) {
    log.info(`Using cached GraalVM at ${existing}`);
    return existing;
  }

  const zipPath = path.join(root, 'graalvm-download.zip');
  onProgress('GraalVM Java 21 다운로드 중… (한 번만 받으면 됩니다)');
  log.info(`Downloading GraalVM from ${GRAALVM_URL}`);

  const res = await fetch(GRAALVM_URL);
  if (!res.ok) throw new Error(`GraalVM download failed: HTTP ${res.status}`);
  if (!res.body) throw new Error('GraalVM download: empty response body');
  const total = Number(res.headers.get('content-length') ?? 0);

  const out = fs.createWriteStream(zipPath);
  const reader = res.body.getReader();
  let received = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      out.write(value);
      received += value.byteLength;
      onProgress('GraalVM Java 21 다운로드 중…', received, total);
    }
  }
  await new Promise<void>((resolve, reject) => {
    out.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  onProgress('GraalVM 압축 해제 중…');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(root, true);
  try {
    fs.unlinkSync(zipPath);
  } catch {
    // best effort cleanup
  }

  const java = findJavaExe(root);
  if (!java) throw new Error('GraalVM extracted but bin/java.exe not found');
  log.info(`GraalVM installed at ${java}`);
  return java;
}
