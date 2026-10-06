const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const asar=require('@electron/asar'),resedit=require('resedit');
const root=path.resolve('release/win-unpacked'),archive=path.join(root,'resources/app.asar');
for(const filename of ['electron/main.cjs','electron/preload.cjs','electron/export-store.cjs','electron/trust.cjs','ui/index.html','ui/app.js','ui/desktop.js','ui/viewer.js','ui/preview-state.js','electron/updater.cjs','electron/installer.cjs','electron/update-startup.cjs','ui/preview-worker.js','ui/vendor/three.module.js','ui/vendor/three.core.js','ui/vendor/OrbitControls.js'])assert.deepEqual(asar.extractFile(archive,filename.split('/').join(path.sep)),fs.readFileSync(filename),filename);
const entries=asar.listPackage(archive);assert.ok(!entries.some(name=>name.includes('/node_modules/')||name==='/ui/sw.js'||name==='/ui/install.js'));
const exeBytes=fs.readFileSync(path.join(root,'DITASHA-Asset-Sorter.exe'));assert.equal(exeBytes.subarray(0,2).toString(),'MZ');const pe=exeBytes.readUInt32LE(0x3c);assert.equal(exeBytes.readUInt32LE(pe),0x4550);assert.equal(exeBytes.readUInt16LE(pe+4),0x8664);
const exe=resedit.NtExecutable.from(exeBytes),resources=resedit.NtExecutableResource.from(exe);assert.ok(resources.entries.some(entry=>entry.type===14));assert.ok(resources.entries.some(entry=>entry.type===16));
console.log('PASS Windows x64 PE, embedded icon/version resources and exact packaged app/worker/viewer source.');
