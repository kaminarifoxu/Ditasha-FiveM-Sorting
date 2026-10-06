'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { completeUpdateStartup, cleanupPrevious } = require('../electron/update-startup.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ditasha-startup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'DITASHA-Editor.exe');
  await fs.writeFile(target, 'new executable');
  await fs.writeFile(target + '.previous', 'old executable');
  return { root, target };
}
test('Legacy updater backup is removed only by a successful new-app startup', async (t) => {
  const { target } = await fixture(t);
  const result = await completeUpdateStartup({
    target,
    version: '1.8.1',
    env: {},
    platform: 'win32',
  });
  assert.equal(result.cleaned, true);
  await assert.rejects(fs.access(target + '.previous'));
  assert.equal(await fs.readFile(target, 'utf8'), 'new executable');
  assert.equal(await cleanupPrevious(target), true);
});
test('New helper receives atomic startup acknowledgement while keeping rollback backup', async (t) => {
  const { root, target } = await fixture(t);
  const ready = path.join(root, 'ready.json');
  const result = await completeUpdateStartup({
    target,
    version: '1.8.1',
    platform: 'win32',
    env: { DITASHA_UPDATE_READY_PATH: ready, DITASHA_UPDATE_TOKEN: 'launch-token' },
  });
  assert.equal(result.confirmed, true);
  const marker = JSON.parse(await fs.readFile(ready, 'utf8'));
  assert.equal(marker.token, 'launch-token');
  assert.equal(marker.target, target);
  assert.equal(marker.version, '1.8.1');
  assert.equal(await fs.readFile(target + '.previous', 'utf8'), 'old executable');
  await assert.rejects(fs.access(ready + '.tmp'));
});
test('Non-portable startup and failed acknowledgement retain backup', async (t) => {
  const { root, target } = await fixture(t);
  await completeUpdateStartup({ target, version: '1.8.1', platform: 'linux', env: {} });
  assert.equal(await fs.readFile(target + '.previous', 'utf8'), 'old executable');
  await assert.rejects(
    completeUpdateStartup({
      target,
      version: '1.8.1',
      platform: 'win32',
      env: {
        DITASHA_UPDATE_READY_PATH: path.join(root, 'missing', 'ready.json'),
        DITASHA_UPDATE_TOKEN: 'token',
      },
    }),
  );
  assert.equal(await fs.readFile(target + '.previous', 'utf8'), 'old executable');
});
