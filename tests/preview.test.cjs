const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={TextEncoder,TextDecoder,Uint8Array,Uint16Array,Float32Array,DataView,Set,Map};vm.createContext(ctx);
for(const f of ['fflate.js','ymt-schema.js','engine.js','gta-preview.js'])vm.runInContext(fs.readFileSync('ui/'+f,'utf8'),ctx);
const P=ctx.GtaPreview,E=ctx.AssetEngine;
const model=P.readYdd(new Uint8Array(fs.readFileSync('tests/fixtures/feet_006_u.ydd')));
assert.equal(model.drawables.length,1);assert.equal(model.drawables[0].lods[0].name,'High');assert.equal(model.drawables[0].lods[0].meshes[0].positions.length/3,1002);assert.equal(model.drawables[0].lods[0].meshes[0].material.diffuse,'feet_diff_006_a_uni');assert.equal(model.triangles,1670);
for(const d of model.drawables)for(const l of d.lods)for(const m of l.meshes){assert.equal(m.uvs.length/2,m.positions.length/3);assert.ok(m.positions.every(Number.isFinite));assert.ok(m.indices.every(i=>i<m.positions.length/3));}
const otherPath='tests/fixtures/jbib_000_u.ydd';if(fs.existsSync(otherPath)){const second=P.readYdd(new Uint8Array(fs.readFileSync(otherPath)));assert.ok(second.vertices>0);console.log('Real jbib YDD:',second.vertices,'vertices',second.triangles,'triangles');}
function ytd(name,format,block){
 const raw=new Uint8Array(16384),v=new DataView(raw.buffer),ptr=(o,p)=>v.setBigUint64(o,BigInt(p),true);
 ptr(48,0x50000100);v.setUint16(56,1,true);v.setUint16(58,1,true);ptr(256,0x50000040);ptr(64+40,0x50000120);raw.set(new TextEncoder().encode(name),288);
 v.setUint16(64+80,4,true);v.setUint16(64+82,4,true);v.setUint16(64+86,format===21?16:8,true);v.setUint32(64+88,format,true);ptr(64+112,0x60000000);raw.set(block,8192);
 const header=new Uint8Array(16),h=new DataView(header.buffer);h.setUint32(0,0x37435352,true);h.setUint32(4,13,true);h.setUint32(8,1<<17,true);h.setUint32(12,(13<<28)|(1<<17),true);const compressed=ctx.fflate.deflateSync(raw);const bytes=new Uint8Array(16+compressed.length);bytes.set(header);bytes.set(compressed,16);return bytes;
}
const red=new Uint8Array([0,248,0,0,0,0,0,0]),blue=new Uint8Array([31,0,0,0,0,0,0,0]);
const a=P.readYtd(ytd('feet_diff_006_a_uni',0x31545844,red)),b=P.readYtd(ytd('feet_diff_006_b_uni',0x31545844,blue));
assert.equal(P.matchTexture('feet_diff_006_a_uni',b.textures).name,'feet_diff_006_b_uni');
const ra=P.decodeTexture(a.resource,a.textures[0]),rb=P.decodeTexture(b.resource,b.textures[0]);assert.deepEqual(Array.from(ra.data.slice(0,4)),[255,0,0,255]);assert.deepEqual(Array.from(rb.data.slice(0,4)),[0,0,255,255]);
const bc3=new Uint8Array(16);bc3[0]=64;bc3[1]=255;bc3.set(red,8);const alpha=P.readYtd(ytd('test',0x35545844,bc3));assert.equal(P.decodeTexture(alpha.resource,alpha.textures[0]).data[3],64);
const bc2=new Uint8Array(16);bc2.fill(255,0,8);bc2.set(blue,8);const alpha2=P.readYtd(ytd('test',0x33545844,bc2));assert.deepEqual(Array.from(P.decodeTexture(alpha2.resource,alpha2.textures[0]).data.slice(0,4)),[0,0,255,255]);
const rgba=new Uint8Array(64);for(let i=0;i<16;i++)rgba.set([3,2,1,128],i*4);const uncompressed=P.readYtd(ytd('test',21,rgba));assert.deepEqual(Array.from(P.decodeTexture(uncompressed.resource,uncompressed.textures[0]).data.slice(0,4)),[1,2,3,128]);
const textures=['mp_m_freemode_01_pack^hair_diff_000_a_uni.ytd','mp_m_freemode_01_pack^hair_diff_000_b_uni.ytd','mp_f_freemode_01_pack^hair_diff_000_a_uni.ytd','mp_m_freemode_01_pack^hair_diff_001_a_uni.ytd'].map((name,i)=>({id:i,name,parsed:E.parseName(name)}));
assert.equal(P.candidateFiles({name:'mp_m_freemode_01_pack^hair_000_u.ydd'},textures).length,2);
assert.throws(()=>P.readYdd(new Uint8Array(16)),/RSC7/);const damaged=new Uint8Array(fs.readFileSync('tests/fixtures/feet_006_u.ydd'));new DataView(damaged.buffer).setUint32(4,159,true);assert.throws(()=>P.readYdd(damaged),/Versi resource/);
// Exercise the same worker message entrypoints used by the viewer.
const messages=[],wctx={...ctx,self:{postMessage:m=>messages.push(m)}};vm.createContext(wctx);wctx.importScripts=(...paths)=>paths.forEach(p=>vm.runInContext(fs.readFileSync('ui/'+p,'utf8'),wctx));vm.runInContext(fs.readFileSync('ui/preview-worker.js','utf8'),wctx);
wctx.self.onmessage({data:{id:1,action:'model',bytes:new Uint8Array(fs.readFileSync('tests/fixtures/feet_006_u.ydd'))}});assert.ok(messages[0].result.drawables.length);
wctx.self.onmessage({data:{id:2,action:'ytd',bytes:ytd('feet_diff_006_b_uni',0x31545844,blue)}});assert.equal(messages[1].result.textures[0].name,'feet_diff_006_b_uni');
wctx.self.onmessage({data:{id:3,action:'decode',names:['feet_diff_006_b_uni']}});assert.deepEqual(Array.from(messages[2].result.textures[0].data.slice(0,4)),[0,0,255,255]);
console.log('PASS: real YDD meshes/LOD/UV/material names, worker model and texture requests, YTD layout, DXT1/3/5 + BGRA pixels, texture variant matching, namespace separation and unsupported-format errors. WebGL rendering not exercised.');
