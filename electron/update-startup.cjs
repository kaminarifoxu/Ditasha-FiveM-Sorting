'use strict';
const fs = require('node:fs/promises');

async function cleanupPrevious(target, { attempts = 40, delay = 250 } = {}) {
  if (!target || !/\.exe$/i.test(target)) return false;
  const backup = target + '.previous';
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.unlink(backup);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      if (i === attempts - 1) return false;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

// Called after the renderer is ready and its window is shown. A legacy helper
// does not request an acknowledgement, so the new app cleans its leftover backup.
async function completeUpdateStartup({
  target,
  version,
  env = process.env,
  platform = process.platform,
}) {
  if (platform !== 'win32' || !target) return { confirmed: false, cleaned: false };
  if (env.DITASHA_UPDATE_READY_PATH && env.DITASHA_UPDATE_TOKEN) {
    const marker = { token: env.DITASHA_UPDATE_TOKEN, pid: process.pid, target, version };
    const temporary = env.DITASHA_UPDATE_READY_PATH + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(marker));
    await fs.rename(temporary, env.DITASHA_UPDATE_READY_PATH);
    return { confirmed: true, cleaned: false };
  }
  return { confirmed: false, cleaned: await cleanupPrevious(target) };
}
module.exports = { cleanupPrevious, completeUpdateStartup };
