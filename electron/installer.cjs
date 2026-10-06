'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { replacementScript } = require('./updater.cjs');
async function startReplacement({
  target,
  staged,
  parentPid,
  bootloaderPid,
  directory,
  expectedVersion,
  confirmRestart = true,
}) {
  if (process.platform !== 'win32') throw Error('Pemasangan otomatis tersedia pada EXE Windows.');
  await fs.mkdir(directory, { recursive: true });
  await fs.access(staged);
  // Check directory writes, rather than W_OK, which does not check Windows ACLs.
  const probe = await fs.mkdtemp(path.join(path.dirname(target), '.ditasha-write-'));
  await fs.rm(probe, { recursive: true });
  const handshakePath = path.join(directory, 'install.started'),
    logPath = path.join(directory, 'install.json'),
    readyPath = confirmRestart ? path.join(directory, 'restart-ready.json') : null;
  await fs.rm(handshakePath, { force: true });
  const script = replacementScript({
    target,
    staged,
    parentPid,
    bootloaderPid,
    logPath,
    handshakePath,
    readyPath,
    readyToken: randomUUID(),
    expectedVersion,
  });
  const executable = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('PORTABLE_')) delete env[key];
  // Match Cache Switcher's CREATE_NO_WINDOW startup through the Windows
  // Process API. Node's detached flag produces a different console lifecycle.
  env.DITASHA_UPDATER_COMMAND = Buffer.from(script, 'utf16le').toString('base64');
  const bootstrap = `$ErrorActionPreference='Stop'
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = '${executable.replace(/'/g, "''")}'
$info.Arguments = '-NoProfile -NonInteractive -EncodedCommand ' + $env:DITASHA_UPDATER_COMMAND
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.WorkingDirectory = '${path.dirname(target).replace(/'/g, "''")}'
$info.EnvironmentVariables.Remove('DITASHA_UPDATER_COMMAND')
$helper = [System.Diagnostics.Process]::Start($info)
$helper.Dispose()`;
  const output = await fs.open(path.join(directory, 'helper-output.log'), 'w');
  const child = spawn(
    executable,
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(bootstrap, 'utf16le').toString('base64'),
    ],
    {
      cwd: path.dirname(target),
      env,
      detached: false,
      windowsHide: true,
      stdio: ['ignore', output.fd, output.fd],
    },
  );
  try {
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  } finally {
    await output.close();
  }
  try {
    let started = false;
    for (let i = 0; i < 150; i++) {
      try {
        await fs.access(handshakePath);
        started = true;
        break;
      } catch {}
      if (child.exitCode !== null && child.exitCode !== 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!started) {
      const detail = await fs
        .readFile(path.join(directory, 'helper-output.log'), 'utf8')
        .catch(() => '');
      throw Error(
        'Helper update tidak dapat berjalan (exit ' + child.exitCode + '). ' + detail.slice(-3000),
      );
    }
  } catch (error) {
    child.kill();
    throw error;
  }
  child.unref();
  return { logPath };
}
module.exports = { startReplacement };
