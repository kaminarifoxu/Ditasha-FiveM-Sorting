const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, access } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  isNewer,
  releaseInfo,
  trustedURL,
  createPortableUpdater,
  replacementScript,
} = require('../electron/updater.cjs');
const bytes = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 7)]),
  hash = crypto.createHash('sha256').update(bytes).digest('hex');
function release(digest = hash) {
  return {
    tag_name: 'v1.2.0',
    body: '- Test update',
    assets: [
      {
        name: 'DITASHA-Asset-Sorter.exe',
        state: 'uploaded',
        size: bytes.length,
        digest: `sha256:${digest}`,
        browser_download_url:
          'https://github.com/kaminarifoxu/Ditasha-FiveM-Sorting/releases/download/v1.2.0/DITASHA-Asset-Sorter.exe',
      },
    ],
  };
}
async function fixture(t, { meta = release(), payload = bytes, status = 200 } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gano-update-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const states = [];
  const fetcher = async (url) =>
    url.includes('/releases/latest')
      ? new Response(JSON.stringify(meta), { status })
      : new Response(payload);
  const updater = createPortableUpdater({
    version: '1.1.0',
    directory,
    fetcher,
    onState: (s) => states.push(s),
  });
  await updater.setAutoDownload(true);
  return { updater, directory, states };
}
test('numeric version comparison and strict release target', () => {
  assert(isNewer('v1.10.0', '1.9.9'));
  assert(!isNewer('v1.1.0', '1.1.0'));
  assert(!isNewer('v1.0.9', '1.1.0'));
  assert.throws(() => isNewer('v1.2.0-beta', '1.1.0'));
  assert.equal(releaseInfo(release(), '1.1.0').version, '1.2.0');
  assert.equal(releaseInfo({ ...release(), prerelease: true }, '1.1.0'), null);
  assert.throws(() => trustedURL('https://evil.example/update.exe', true));
  assert.throws(() =>
    trustedURL('https://github.com/other/repo/releases/download/v1/app.exe', true),
  );
  assert.throws(() => releaseInfo({ ...release(), assets: [] }, '1.1.0'));
});
test('startup check automatically downloads verified EXE and progress', async (t) => {
  const { updater, states } = await fixture(t);
  assert.equal((await updater.check()).status, 'ready');
  assert.deepEqual(await readFile(updater.getReadyPath()), bytes);
  assert(states.some((s) => s.status === 'downloading'));
  assert(states.some((s) => s.status === 'verifying'));
  assert.equal(updater.getState().progress, 100);
});
test('manual download when automatic setting disabled, with preference persisted', async (t) => {
  const { updater, directory } = await fixture(t);
  await updater.setAutoDownload(false);
  assert.equal((await updater.check()).status, 'available');
  assert.equal(updater.getReadyPath(), null);
  assert.equal((await updater.download()).status, 'ready');
  const again = createPortableUpdater({ version: '1.1.0', directory, fetcher: async () => {} });
  assert.equal(again.getState().autoDownload, false);
});
test('mismatched checksum never leaves executable ready to install', async (t) => {
  const { updater, directory } = await fixture(t, { meta: release('0'.repeat(64)) });
  assert.equal((await updater.check()).status, 'error');
  assert.equal(updater.getReadyPath(), null);
  await assert.rejects(access(path.join(directory, 'update.part')));
});
test('bad payload size is rejected', async (t) => {
  const { updater } = await fixture(t, { payload: bytes.subarray(0, 100) });
  assert.equal((await updater.check()).status, 'error');
  assert.equal(updater.getReadyPath(), null);
});
test('offline, no release, and already current are visible states', async (t) => {
  let { updater } = await fixture(t, { status: 404 });
  assert.equal((await updater.check()).status, 'no-release');
  ({ updater } = await fixture(t, { meta: { ...release(), tag_name: 'v1.1.0' } }));
  assert.equal((await updater.check()).status, 'current');
  updater = createPortableUpdater({
    version: '1.1.0',
    directory: os.tmpdir(),
    fetcher: async () => {
      throw Error('offline');
    },
  });
  assert.equal((await updater.check()).status, 'error');
});
test('checksum sidecar fallback', async (t) => {
  const { directory } = await fixture(t);
  const meta = release();
  delete meta.assets[0].digest;
  meta.assets.push({
    name: meta.assets[0].name + '.sha256',
    state: 'uploaded',
    browser_download_url: meta.assets[0].browser_download_url + '.sha256',
  });
  const updater = createPortableUpdater({
    version: '1.1.0',
    directory,
    fetcher: async (url) =>
      new Response(
        url.includes('/latest')
          ? JSON.stringify(meta)
          : url.endsWith('.sha256')
            ? hash + '  ' + meta.assets[0].name
            : bytes,
      ),
  });
  await updater.setAutoDownload(true);
  assert.equal((await updater.check()).status, 'ready');
});
test('portable install script waits, quotes paths, rolls back and restarts', () => {
  const script = replacementScript({
    target: "C:\\Foxu's folder\\Gano.exe",
    staged: 'C:\\Temp\\new.exe',
    parentPid: 123,
    logPath: 'C:\\Temp\\log.txt',
  });
  assert(script.includes("Foxu''s folder"));
  assert(script.includes('WaitForProcess 123'));
  assert(script.includes("Report 'error' $_.Exception.Message"));
  assert(script.includes("$backup = $target + '.previous'"));
  assert(script.includes('[System.IO.File]::Replace($backup, $target, $next, $true)'));
  assert(script.includes("$_.Name -like 'PORTABLE_*'"));
});

test('DITASHA filename is preferred and has a matching checksum', () => {
  const old = release();
  const asset = {
    ...old.assets[0],
    name: 'DITASHA-Asset-Sorter.exe',
    browser_download_url:
      'https://github.com/kaminarifoxu/Ditasha-FiveM-Sorting/releases/download/v1.2.0/DITASHA-Asset-Sorter.exe',
  };
  const sum = {
    name: 'DITASHA-Asset-Sorter.exe.sha256',
    state: 'uploaded',
    browser_download_url: asset.browser_download_url + '.sha256',
  };
  const info = releaseInfo({ ...old, assets: [...old.assets, asset, sum] }, '1.1.0');
  assert.equal(info.name, 'DITASHA-Asset-Sorter.exe');
  assert.equal(info.checksumURL, sum.browser_download_url);
});

// Repo rename changes browser_download_url even for historical release assets.
test('renamed DITASHA repository accepts canonical releases and keeps legacy assets trusted', () => {
  const renamed = release();
  renamed.assets[0].browser_download_url = renamed.assets[0].browser_download_url.replace(
    'Ditasha-FiveM-Sorting',
    'Ditasha-FiveM-Sorting',
  );
  assert.equal(releaseInfo(renamed, '1.1.0').url, renamed.assets[0].browser_download_url);
  assert.equal(releaseInfo(release(), '1.1.0').version, '1.2.0');
  assert.throws(() =>
    trustedURL(
      'https://github.com/kaminarifoxu/Ditasha-FiveM-Sorting-fake/releases/download/v1/app.exe',
      true,
    ),
  );
  assert.throws(() =>
    trustedURL('https://github.com/other/Ditasha-FiveM-Sorting/releases/download/v1/app.exe', true),
  );
});
