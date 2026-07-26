#!/usr/bin/env node
/**
 * Free (kill listeners on) the backend + frontend ports so restarts don't fail.
 *
 * Defaults: web=3000, api=4000 (override with WEB_PORT / API_PORT).
 *
 * Usage:
 *   npm run ports:free
 *   node scripts/free-ports.mjs
 *   node scripts/free-ports.mjs 3000 4000
 */
import { execSync } from 'node:child_process';

const DEFAULT_PORTS = [
  Number(process.env.WEB_PORT || process.env.PORT || 3000),
  Number(process.env.API_PORT || 4000),
];

const ports = (process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : DEFAULT_PORTS
).filter((p) => Number.isInteger(p) && p > 0 && p < 65536);

function unique(values) {
  return [...new Set(values)];
}

function pidsOnPortWindows(port) {
  let output = '';
  try {
    output = execSync(`netstat -ano -p tcp`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
  } catch {
    return [];
  }

  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    // Example:  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
    if (!/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const local = parts[1] || '';
    const pid = Number(parts[parts.length - 1]);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    // Match :3000 at end of local address (IPv4 / IPv6)
    if (
      local.endsWith(`:${port}`) ||
      local.endsWith(`]:${port}`) ||
      local === `*:${port}`
    ) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function pidsOnPortUnix(port) {
  try {
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return unique(
      output
        .split(/\s+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    );
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /F`, {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
  }
}

const portsToFree = unique(ports);
console.log(`Freeing ports: ${portsToFree.join(', ')}`);

let killed = 0;
for (const port of portsToFree) {
  const pids =
    process.platform === 'win32'
      ? pidsOnPortWindows(port)
      : pidsOnPortUnix(port);

  if (pids.length === 0) {
    console.log(`  :${port}  already free`);
    continue;
  }

  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`  :${port}  killed PID ${pid}`);
      killed += 1;
    } catch (err) {
      console.warn(
        `  :${port}  could not kill PID ${pid}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}

console.log(killed ? `Done. Freed ${killed} process(es).` : 'Done. Nothing to kill.');
