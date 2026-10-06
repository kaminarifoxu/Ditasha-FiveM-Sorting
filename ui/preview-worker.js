importScripts('fflate.js','engine.js','gta-preview.js');
let model=null,textureSet=null;
self.onmessage=e=>{
 const{id,action,bytes,names}=e.data;
 try{
  let result,transfer=[];
  if(action==='model'){
   model=null;textureSet=null;model=GtaPreview.readYdd(bytes);
   result={drawables:model.drawables.map(d=>({name:d.name,lods:d.lods,embedded:d.embedded.map(t=>({name:t.name,width:t.width,height:t.height,format:t.format}))})),decodedBytes:model.resource.data.length,vertices:model.vertices,triangles:model.triangles};
   for(const d of result.drawables)for(const l of d.lods)for(const m of l.meshes){transfer.push(m.positions.buffer,m.indices.buffer);if(m.uvs)transfer.push(m.uvs.buffer);}
  }else if(action==='ytd'){
   textureSet=null;textureSet=GtaPreview.readYtd(bytes);result={decodedBytes:textureSet.resource.data.length,textures:textureSet.textures.map(t=>({name:t.name,width:t.width,height:t.height,format:t.format}))};
  }else if(action==='embedded'){textureSet=null;result={textures:[]};}
  else if(action==='decode'){
   const embedded=model?.drawables.flatMap(d=>d.embedded)||[],decoded=[],warnings=[];let total=0;
   for(const name of [...new Set(names)].slice(0,128)){
    const external=textureSet?.textures.find(t=>t.name===name),tex=external||embedded.find(t=>t.name===name),r=external?textureSet.resource:model?.resource;
    if(!tex||!r)continue;
    try{total+=tex.width*tex.height*4;if(total>128*1024**2)throw Error('Jumlah tekstur preview melebihi 128 MB.');const image=GtaPreview.decodeTexture(r,tex);decoded.push(image);transfer.push(image.data.buffer);}catch(e){warnings.push(`${name}: ${e.message}`);}
   }
   result={textures:decoded,warnings};
  }else throw Error('Aksi preview tidak dikenal.');
  self.postMessage({id,result},transfer);
 }catch(e){self.postMessage({id,error:e.message||'Model tidak dapat dibaca.'});}
};
