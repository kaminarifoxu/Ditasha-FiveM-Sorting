const path = require('node:path');
const ORIGIN = 'ditasha://app';
function isAppURL(value) {
  try { const url=new URL(value); return url.protocol==='ditasha:' && url.host==='app' && !url.username && !url.password; } catch { return false; }
}
function resolveAsset(value, root) {
  if (!isAppURL(value)) return null;
  let name;
  try { name=decodeURIComponent(new URL(value).pathname); } catch { return null; }
  if (name.includes('\\') || name.includes('\0') || name.split('/').includes('..')) return null;
  const filename = path.resolve(root, '.' + (name==='/' ? '/index.html' : name));
  if (!filename.startsWith(path.resolve(root)+path.sep)) return null;
  if (!/\.(html|js|css|png|svg|txt|woff2?)$/i.test(filename)) return null;
  return filename;
}
function trustedEvent(event, window) {
  return !!window && !window.isDestroyed() && event.sender===window.webContents && event.senderFrame===window.webContents.mainFrame && isAppURL(event.senderFrame.url);
}
function externalURL(value) {
  try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password && ['docs.fivem.net','github.com'].includes(url.hostname); } catch { return false; }
}
module.exports={ORIGIN,isAppURL,resolveAsset,trustedEvent,externalURL};
