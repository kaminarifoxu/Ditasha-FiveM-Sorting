const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

class ExportStore {
  constructor() { this.sessions = new Map(); }
  async open(destination) {
    if (this.sessions.size) throw new Error('Ekspor lain masih berjalan.');
    const id = randomUUID();
    const temporary = path.join(path.dirname(destination), `.ditasha-${id}.partial`);
    const handle = await fs.open(temporary, 'wx');
    this.sessions.set(id, {destination, temporary, handle, bytes:0, busy:false});
    return id;
  }
  get(id) {
    if (typeof id !== 'string' || !this.sessions.has(id)) throw new Error('Sesi ekspor tidak valid.');
    const session = this.sessions.get(id);
    if (session.busy) throw new Error('Penulisan sebelumnya belum selesai.');
    return session;
  }
  async write(id, chunk) {
    const session = this.get(id);
    if (!(chunk instanceof Uint8Array) || !chunk.length || chunk.length > 1024*1024) throw new Error('Ukuran blok ekspor tidak valid.');
    // 25 GiB input + generous space for ZIP64 headers and generated metadata.
    if (session.bytes + chunk.length > 26*1024**3) throw new Error('Hasil ekspor melebihi batas 26 GB.');
    session.busy = true;
    try {
      let offset=0;
      while (offset < chunk.length) {
        const {bytesWritten} = await session.handle.write(chunk, offset, chunk.length-offset);
        if (!bytesWritten) throw new Error('Tidak dapat menulis blok ekspor.');
        offset += bytesWritten;
      }
      session.bytes += chunk.length;
    } finally { session.busy = false; }
  }
  async commit(id) {
    const session = this.get(id); session.busy = true;
    try {
      await session.handle.sync(); await session.handle.close();
      await fs.rename(session.temporary, session.destination);
      this.sessions.delete(id);
    } catch (error) {
      session.busy = false;
      await this.abort(id);
      throw error;
    }
  }
  async abort(id) {
    const session = this.get(id); session.busy = true;
    try { await session.handle.close().catch(()=>{}); await fs.unlink(session.temporary).catch(()=>{}); }
    finally { this.sessions.delete(id); }
  }
  async cleanup() {
    for (const [id, session] of this.sessions) {
      while (session.busy) await new Promise(resolve=>setTimeout(resolve,10));
      if (this.sessions.has(id)) await this.abort(id);
    }
  }
}
module.exports = {ExportStore};
