#!/usr/bin/env node
/**
 * Build API + Web, free their ports, then launch each `start` in its own
 * terminal window (Git Bash / cmd / PowerShell / Windows Terminal).
 *
 * Usage (from repo root):
 *   npm run build:start
 *   npm run start:apps
 *   node scripts/build-and-start.mjs --skip-build
 *   node scripts/build-and-start.mjs --skip-build --skip-ports
 */
import { spawn, execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipBuild = process.argv.includes('--skip-build');
const skipPorts = process.argv.includes('--skip-ports');

function run(command) {
  console.log(`\n> ${command}\n`);
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
}

function writeLauncherCmd(title, npmScript) {
  const safeName = npmScript.replace(/[^a-z0-9_-]/gi, '-');
  const batPath = path.join(os.tmpdir(), `pdfnexus-${safeName}.cmd`);
  const body = [
    '@echo off',
    `cd /d "${root}"`,
    `title ${title}`,
    `echo Starting ${title}...`,
    `echo cwd: ${root}`,
    `call npm run ${npmScript}`,
    'echo.',
    'echo Process exited with code %ERRORLEVEL%.',
    'pause',
    '',
  ].join('\r\n');
  fs.writeFileSync(batPath, body, 'utf8');
  return batPath;
}

function commandExists(bin) {
  try {
    execFileSync(
      process.platform === 'win32' ? 'where.exe' : 'which',
      [bin],
      { stdio: 'ignore', windowsHide: true }
    );
    return true;
  } catch {
    return false;
  }
}

function launchDetached(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      env,
    });
    child.once('error', reject);
    // Give CreateProcess a moment; resolve once the child is spawned.
    child.unref();
    setImmediate(() => resolve(child.pid));
  });
}

async function openTerminalWindows(title, npmScript) {
  const batPath = writeLauncherCmd(title, npmScript);
  const env = {
    ...process.env,
    // Prevent Git Bash / MSYS from rewriting Windows paths in child commands.
    MSYS_NO_PATHCONV: '1',
    MSYS2_ARG_CONV_EXCL: '*',
  };

  const attempts = [];

  // 1) Windows Terminal (best when installed)
  if (commandExists('wt')) {
    attempts.push(() =>
      launchDetached(
        'wt.exe',
        ['-w', '0', 'new-tab', '--title', title, '-d', root, 'cmd', '/k', `npm run ${npmScript}`],
        env
      )
    );
  }

  // 2) cmd `start` with empty title (avoids space-in-title bug)
  attempts.push(() =>
    launchDetached(
      process.env.ComSpec || 'cmd.exe',
      ['/c', 'start', '', batPath],
      env
    )
  );

  // 3) PowerShell Start-Process on the .cmd file
  attempts.push(() =>
    launchDetached(
      'powershell.exe',
      [
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `Start-Process -FilePath ${JSON.stringify(batPath)}`,
      ],
      env
    )
  );

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await attempt();
      console.log(`  opened: ${title}`);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  console.error(
    `  FAILED to open ${title}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
  console.error(`  Manual fallback:  npm run ${npmScript}`);
  console.error(`  Launcher file:    ${batPath}`);
}

async function openTerminal(title, npmScript) {
  if (process.platform === 'win32') {
    await openTerminalWindows(title, npmScript);
    return;
  }

  if (process.platform === 'darwin') {
    const escaped = root.replace(/'/g, `'\\''`);
    const script = `cd '${escaped}' && npm run ${npmScript}`;
    await launchDetached('osascript', [
      '-e',
      `tell application "Terminal" to do script ${JSON.stringify(script)}`,
    ]);
    console.log(`  opened: ${title}`);
    return;
  }

  const linuxCmd = `cd ${JSON.stringify(root)} && npm run ${npmScript}; exec bash`;
  for (const [bin, args] of [
    ['gnome-terminal', ['--', 'bash', '-lc', linuxCmd]],
    ['x-terminal-emulator', ['-e', `bash -lc ${JSON.stringify(linuxCmd)}`]],
    ['xterm', ['-T', title, '-e', `bash -lc ${JSON.stringify(linuxCmd)}`]],
  ]) {
    try {
      await launchDetached(bin, args);
      console.log(`  opened: ${title}  (${bin})`);
      return;
    } catch {
      // try next
    }
  }

  console.error(
    `Could not open a separate terminal for "${title}". Run manually:\n  npm run ${npmScript}`
  );
}

async function main() {
  if (!skipBuild) {
    console.log('Building backend (@pdfnexus/api) and frontend (@pdfnexus/web)…');
    run('npm run build');
  } else {
    console.log('Skipping build (--skip-build).');
  }

  if (!skipPorts) {
    console.log('Freeing backend/frontend ports…');
    run('node scripts/free-ports.mjs');
  } else {
    console.log('Skipping port cleanup (--skip-ports).');
  }

  console.log('Starting API and Web in separate terminals…');
  await openTerminal('PDFNexus API', 'start:api');
  await openTerminal('PDFNexus Web', 'start:web');

  console.log(`
Opened:
  • PDFNexus API  →  http://localhost:4000  (npm run start:api)
  • PDFNexus Web  →  http://localhost:3000  (npm run start:web)

This window can be closed; the two start terminals keep running.

Ports:
  npm run ports:free     free :3000 and :4000 before a restart
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
