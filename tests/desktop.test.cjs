const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {ExportStore}=require('../electron/export-store.cjs');
const {resolveAsset,isAppURL,trustedEvent,externalURL}=require('../electron/trust.cjs');
test('native export chunks commit ZIP atomically; cancellation preserves previous output',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-export-'));
 try{
  const destination=path.join(root,'resource.zip');await fs.writeFile(destination,'original');
  const store=new ExportStore(),id=await store.open(destination);
  await assert.rejects(()=>store.open(destination));await assert.rejects(()=>store.write(id,new Uint8Array(1024**2+1)));await assert.rejects(()=>store.write('invalid',new Uint8Array([1])));
  await store.write(id,new Uint8Array([80,75,3,4]));await store.write(id,new Uint8Array([1,2,3]));assert.equal(await fs.readFile(destination,'utf8'),'original');
  await store.commit(id);assert.deepEqual([...await fs.readFile(destination)],[80,75,3,4,1,2,3]);assert.equal(store.sessions.size,0);
  const cancel=await store.open(destination);await store.write(cancel,new Uint8Array([99]));await store.abort(cancel);assert.deepEqual([...await fs.readFile(destination)],[80,75,3,4,1,2,3]);assert.deepEqual(await fs.readdir(root),['resource.zip']);
  const pending=await store.open(destination);await store.write(pending,new Uint8Array([42]));await store.cleanup();assert.equal(store.sessions.size,0);assert.deepEqual(await fs.readdir(root),['resource.zip']);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('only packaged assets and main-frame IPC are trusted',()=>{
 const root=path.resolve('ui');assert.equal(resolveAsset('ditasha://app/',root),path.join(root,'index.html'));assert.equal(resolveAsset('ditasha://app/viewer.js',root),path.join(root,'viewer.js'));
 for(const url of ['https://app/viewer.js','ditasha://evil/viewer.js','ditasha://app/%2e%2e%2felectron/main.cjs','ditasha://app/%5c..%5csecret.js','ditasha://app/%00.js','ditasha://app/private.json'])assert.equal(resolveAsset(url,root),null,url);
 assert.equal(isAppURL('ditasha://app.evil/'),false);assert.equal(externalURL('https://github.com/dexyfex/CodeWalker'),true);assert.equal(externalURL('file:///C:/Windows/system32/cmd.exe'),false);
 const frame={url:'ditasha://app/'},contents={mainFrame:frame},window={isDestroyed:()=>false,webContents:contents};assert.equal(trustedEvent({sender:contents,senderFrame:frame},window),true);assert.equal(trustedEvent({sender:contents,senderFrame:{url:'ditasha://app/'}},window),false);
});
test('desktop renderer bridge chunks and awaits native writes, aborts and reports picker cancellation',async()=>{
 const calls=[],events={},elements=new Map(['#install-app','#install-dialog'].map(x=>[x,{showModal(){}}]));
 const sandbox={Uint8Array,DOMException,state:{files:[],busy:false},document:{querySelector:x=>elements.get(x)},window:{ditashaDesktop:{pick:async()=> 'id',write:async(id,chunk)=>calls.push(['write',chunk.length]),close:async()=>calls.push(['close']),abort:async()=>calls.push(['abort'])},addEventListener:(n,f)=>events[n]=f}};
 vm.runInNewContext(await fs.readFile('ui/desktop.js','utf8'),sandbox);
 const handle=await sandbox.window.showSaveFilePicker({suggestedName:'resource.zip'}),sink=await handle.createWritable();await sink.write(new Uint8Array(600000));await sink.close();assert.deepEqual(calls,[['write',262144],['write',262144],['write',75712],['close']]);await assert.rejects(()=>sink.write(new Uint8Array(1)));
 const next=await sandbox.window.showSaveFilePicker({}),other=await next.createWritable();await other.abort();assert.equal(calls.at(-1)[0],'abort');sandbox.window.ditashaDesktop.pick=async()=>null;await assert.rejects(()=>sandbox.window.showSaveFilePicker({}),error=>error.name==='AbortError');
});
