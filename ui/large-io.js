/* Disk-backed source references + bounded ZIP64 streaming. */
(function(root){
 'use strict';
 const MAX=25*1024**3,MAX_FILES=50000,FALLBACK=512*1024**2;
 root.zip.configure({useWebWorkers:false,chunkSize:256*1024});
 function checkAbort(signal){if(signal?.aborted)throw new DOMException('Dibatalkan','AbortError');}
 async function openArchive(blob,available,count,signal){
  checkAbort(signal);const reader=new root.zip.ZipReader(new root.zip.BlobReader(blob));
  try{const entries=[];let total=0;
   for await(const entry of reader.getEntriesGenerator()){
    checkAbort(signal);if(entry.directory||entry.filename.split(/[\\/]/).some(x=>x.startsWith('.')||x==='__MACOSX'))continue;
    if(entry.encrypted)throw Error('ZIP berpassword belum didukung.');
    if(!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0)throw Error('Ukuran entri ZIP tidak valid.');
    total+=entry.uncompressedSize;if(total>available)throw Error('Isi ZIP melewati batas total 25 GB.');
    if(entries.length+count>=MAX_FILES)throw Error('Maksimal 50.000 file per sesi.');
    entries.push({path:entry.filename,size:entry.uncompressedSize,entry});
   }
   return{reader,entries,total};
  }catch(e){await reader.close();throw e;}
 }
 async function smallBytes(source,limit=4*1024**2,signal){
  checkAbort(signal);if(source.size>limit)throw Error('Metadata terlalu besar.');
  if(source.blob)return new Uint8Array(await source.blob.arrayBuffer());
  const result=await source.entry.getData(new root.zip.Uint8ArrayWriter(),{signal,checkSignature:true});
  if(result.length>limit||result.length!==source.size)throw Error('Ukuran metadata ZIP tidak cocok.');return result;
 }
 function sourceStream(source,signal,verifyHeader=false){
  let read=0,header=[],headerLength=0;let unzipPromise=null;
  const guard=new TransformStream({transform(chunk,controller){
   checkAbort(signal);read+=chunk.length;if(read>source.size)throw Error('Isi file melebihi ukuran yang tercatat.');
   if(verifyHeader&&headerLength<16){const part=chunk.subarray(0,16-headerLength);header.push(part);headerLength+=part.length;
    if(headerLength===16){const a=new Uint8Array(16);let o=0;for(const h of header){a.set(h,o);o+=h.length;}if(new DataView(a.buffer).getUint32(0,true)!==0x37435352)throw Error('Header model/tekstur bukan RSC7 GTA V Legacy.');}
   }
   controller.enqueue(chunk);
  },flush(){if(read!==source.size)throw Error('Ukuran file tidak sesuai.');if(verifyHeader&&headerLength<16)throw Error('Header model/tekstur terlalu pendek.');}});
  if(source.blob){unzipPromise=source.blob.stream().pipeTo(guard.writable,{signal});}
  else{unzipPromise=source.entry.getData(guard.writable,{signal,checkSignature:true});}
  // Propagate extraction errors to the readable side; retain a handled completion promise.
  const done=unzipPromise.catch(async e=>{try{await guard.writable.abort(e);}catch{}throw e;});done.catch(()=>{});
  return{readable:guard.readable,done};
 }
 async function writeResource(plan,sink,{signal,onprogress=()=>{}}={}){
  const E=root.AssetEngine,writer=new root.zip.ZipWriter(sink,{zip64:true,level:0,bufferedWrite:false});
  const total=plan.files.reduce((s,f)=>s+E.fileSize(f.source),0);let written=0;
  for(const f of plan.files){
   checkAbort(signal);const source=f.source,stream=sourceStream(source,signal,['ydd','ytd','yft','yld'].includes(source.parsed.ext));
   try{
    await writer.add(plan.name+'/'+f.path,stream.readable,{signal,zip64:true,level:0,bufferedWrite:false,uncompressedSize:E.fileSize(source),onprogress:current=>onprogress({name:source.name,written:written+current,total})});
    await stream.done;
   }catch(e){try{await stream.readable.cancel(e);}catch{}throw Error(`${source.name}: ${e.message||e}`);}
   written+=E.fileSize(source);onprogress({name:source.name,written,total});
  }
  for(const [path,data] of Object.entries(E.generated(plan))){checkAbort(signal);await writer.add(path,new root.zip.Uint8ArrayReader(data),{signal,zip64:true,level:0});}
  checkAbort(signal);await writer.close();onprogress({name:'Selesai',written:total,total});
 }
 root.LargeIO={MAX,MAX_FILES,FALLBACK,openArchive,smallBytes,sourceStream,writeResource,checkAbort};
})(globalThis);
