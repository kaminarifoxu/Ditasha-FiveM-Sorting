/* Read-only GTA V Legacy RSC7 drawable/texture reader.
 * Binary layout references: CodeWalker Drawable.cs, Texture.cs, VertexType.cs.
 * Static mesh preview: no gameplay shaders, animation, skinning or cloth simulation.
 */
(function(root){
 'use strict';
 const MAX_RESOURCE=256*1024**2,MAX_VERTICES=2000000,MAX_INDICES=6000000;
 function pageSize(f){const s=[(f>>>27)&1,(f>>>26)&1,(f>>>25)&1,(f>>>24)&1,(f>>>17)&127,(f>>>11)&63,(f>>>7)&15,(f>>>5)&3,(f>>>4)&1];return 512*2**(f&15)*s.reduce((a,c,i)=>a+c*2**i,0);}
 class Resource{
  constructor(bytes,kind){
   if(bytes.length<16)throw Error('File terlalu pendek.');const h=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   if(h.getUint32(0,true)!==0x37435352)throw Error('Preview hanya mendukung RSC7 GTA V Legacy yang tidak dienkripsi.');
   const version=h.getUint32(4,true);if((kind==='ydd'&&version!==165)||(kind==='ytd'&&version!==13))throw Error(`Versi resource ${version} belum didukung preview ${kind.toUpperCase()}.`);
   this.sys=pageSize(h.getUint32(8,true));this.gfx=pageSize(h.getUint32(12,true));const size=this.sys+this.gfx;
   if(!this.sys||size>MAX_RESOURCE)throw Error('Resource preview terlalu besar (maksimal 256 MB setelah dekompresi).');
   this.data=root.fflate.inflateSync(bytes.subarray(16),{out:new Uint8Array(size)});if(this.data.length!==size)throw Error('Ukuran resource tidak cocok dengan header.');this.v=new DataView(this.data.buffer,this.data.byteOffset,this.data.byteLength);
  }
  range(o,n){if(!Number.isSafeInteger(o)||o<0||o+n>this.data.length)throw Error('Pointer/data resource di luar batas.');return o;}
  u8(o){this.range(o,1);return this.v.getUint8(o);}u16(o){this.range(o,2);return this.v.getUint16(o,true);}u32(o){this.range(o,4);return this.v.getUint32(o,true);}f32(o){this.range(o,4);return this.v.getFloat32(o,true);}
  ptr(o,nullable=false){this.range(o,8);const lo=this.u32(o),hi=this.u32(o+4);if(!lo&&!hi&&nullable)return null;if(hi)throw Error('Pointer resource 64-bit tidak didukung.');const section=lo>>>28;let p;if(section===5){p=lo-0x50000000;if(p>=this.sys)throw Error('Pointer system tidak valid.');}else if(section===6){p=this.sys+lo-0x60000000;if(p>=this.sys+this.gfx)throw Error('Pointer graphics tidak valid.');}else throw Error('Pointer resource tidak valid.');return this.range(p,1);}
  str(p){if(p===null)return'';this.range(p,1);let e=p;while(e<this.data.length&&e-p<1024&&this.data[e])e++;return new TextDecoder().decode(this.data.subarray(p,e));}
  list(header){const p=this.ptr(header,true),count=this.u16(header+8);if(count>4096)throw Error('Daftar resource terlalu besar.');if(!count||p===null)return[];this.range(p,count*8);return Array.from({length:count},(_,i)=>this.ptr(p+i*8,true)).filter(p=>p!==null);}
 }
 function half(v){const s=(v&32768)?-1:1,e=(v>>>10)&31,m=v&1023;return e===0?s*2**-14*m/1024:e===31?m?NaN:s*Infinity:s*2**(e-15)*(1+m/1024);}
 const sizes=[0,4,4,8,0,8,12,16,4,4,4,0,0,0,0,0];
 function components(r,p,type){switch(type){case 1:return[half(r.u16(p)),half(r.u16(p+2))];case 3:return[0,2,4,6].map(o=>half(r.u16(p+o)));case 2:return[r.f32(p)];case 5:return[r.f32(p),r.f32(p+4)];case 6:return[r.f32(p),r.f32(p+4),r.f32(p+8)];case 7:return[0,4,8,12].map(o=>r.f32(p+o));default:throw Error('Format koordinat vertex belum didukung.');}}
 function textureHeader(r,p){return{name:r.str(r.ptr(p+40,true)),width:r.u16(p+80),height:r.u16(p+82),stride:r.u16(p+86),format:r.u32(p+88),data:r.ptr(p+112,true)};}
 function dictionary(r,p){return p===null?[]:r.list(p+48).map(t=>textureHeader(r,t));}
 function material(r,p){const list=r.ptr(p,true),count=r.u8(p+16);if(list===null)return{diffuse:null,textures:[]};r.range(list,count*16);let hashStart=list+count*16;for(let i=0;i<count;i++)hashStart+=r.u8(list+i*16)*16;
  const textures=[];for(let i=0;i<count;i++){if(r.u8(list+i*16)!==0)continue;const tex=r.ptr(list+i*16+8,true);if(tex===null)continue;const name=r.str(r.ptr(tex+40,true)),hash=r.u32(hashStart+i*4);textures.push({name,hash});}
  const diffuseHash=root.AssetEngine.joaat('DiffuseSampler'),diffuse=textures.find(t=>t.hash===diffuseHash)||textures.find(t=>!/(_n|_normal|_bump|_s|_spec|_specular)$/i.test(t.name));return{diffuse:diffuse?.name||null,textures};
 }
 function readYdd(bytes){const r=new Resource(bytes,'ydd'),drawables=r.list(48);if(!drawables.length)throw Error('YDD tidak berisi drawable.');let vertices=0,indices=0;const output=[];
  for(const [di,d]of drawables.entries()){
   const sg=r.ptr(d+16,true);let mats=[],embedded=[];if(sg!==null){const sp=r.ptr(sg+16,true),sc=r.u16(sg+24);if(sc>4096)throw Error('Terlalu banyak material.');if(sp!==null)for(let i=0;i<sc;i++)mats.push(material(r,r.ptr(sp+i*8)));const td=r.ptr(sg+8,true);embedded=dictionary(r,td);}
   const drawable={name:r.str(r.ptr(d+168,true))||`Drawable ${di+1}`,lods:[],embedded};
   for(const [li,offset]of [80,88,96,104].entries()){
    const lp=r.ptr(d+offset,true);if(lp===null)continue;const meshes=[];
    for(const model of r.list(lp)){
     const gp=r.ptr(model+8,true),gc=r.u16(model+16),mapping=r.ptr(model+32,true);if(gp===null)continue;if(gc>4096)throw Error('Terlalu banyak geometry.');
     for(let i=0;i<gc;i++){
      const g=r.ptr(gp+i*8),vb=r.ptr(g+24),ib=r.ptr(g+56),stride=r.u16(vb+8),vc=r.u32(vb+24),ic=r.u32(ib+8),data=r.ptr(vb+16,true)??r.ptr(vb+32),idx=r.ptr(ib+16),decl=r.ptr(vb+48);
      if(!stride||stride>1024||vc>MAX_VERTICES||ic>MAX_INDICES||ic%3)throw Error('Ukuran/struktur geometry tidak didukung.');vertices+=vc;indices+=ic;if(vertices>MAX_VERTICES||indices>MAX_INDICES)throw Error('Model terlalu kompleks untuk preview browser.');r.range(data,vc*stride);r.range(idx,ic*2);
      const flags=r.u32(decl),types=r.v.getBigUint64(decl+8,true),layout=new Map();let off=0;
      for(let sem=0;sem<16;sem++)if((flags>>>sem)&1){const type=Number((types>>BigInt(sem*4))&15n),size=sizes[type];if(!size)throw Error(`Format vertex ${type} belum didukung.`);layout.set(sem,{off,type,size});off+=size;}
      if(off>stride||!layout.has(0))throw Error('Layout vertex tidak valid.');const pos=layout.get(0),uv=layout.get(6),positions=new Float32Array(vc*3),uvs=uv?new Float32Array(vc*2):null,indexArray=new Uint16Array(ic);
      for(let vi=0;vi<vc;vi++){const p=components(r,data+vi*stride+pos.off,pos.type);if(p.length<3||p.slice(0,3).some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))throw Error('Koordinat model tidak valid.');positions.set(p.slice(0,3),vi*3);if(uv){const t=components(r,data+vi*stride+uv.off,uv.type);if(t.length<2||!t.slice(0,2).every(Number.isFinite))throw Error('UV model tidak valid.');uvs.set(t.slice(0,2),vi*2);}}
      for(let ii=0;ii<ic;ii++){const v=r.u16(idx+ii*2);if(v>=vc)throw Error('Index geometry di luar jumlah vertex.');indexArray[ii]=v;}
      const shader=mapping===null?0:r.u16(mapping+i*2);meshes.push({positions,uvs,indices:indexArray,material:mats[shader]||{diffuse:null,textures:[]},name:`Mesh ${meshes.length+1}`});
     }
    }
    if(meshes.length)drawable.lods.push({name:['High','Medium','Low','Very low'][li],meshes});
   }
   if(drawable.lods.length)output.push(drawable);
  }
  if(!output.length)throw Error('Tidak ada mesh yang dapat dipreview.');
  // Keep only decoded mesh data; embedded texture headers stay tied to this resource.
  return{drawables:output,resource:r,vertices,triangles:indices/3};
 }
 function readYtd(bytes){const r=new Resource(bytes,'ytd'),textures=dictionary(r,0);if(!textures.length)throw Error('YTD tidak memiliki tekstur.');return{textures,resource:r};}
 function rgb565(c){return[((c>>>11)&31)*255/31,((c>>>5)&63)*255/63,(c&31)*255/31].map(Math.round);}
 function decodeTexture(r,t){const{width:w,height:h,format:f,data:p,stride}=t;if(p===null||!w||!h||w*h>16777216)throw Error('Ukuran tekstur tidak didukung (maks. 16 juta pixel).');const out=new Uint8Array(w*h*4),v=r.v;const block=[0x31545844,0x33545844,0x35545844].includes(f);
  if(block){const blockSize=f===0x31545844?8:16,bw=Math.ceil(w/4),bh=Math.ceil(h/4);r.range(p,bw*bh*blockSize);
   for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
    const b=p+(by*bw+bx)*blockSize,cp=b+(blockSize===16?8:0),c0=r.u16(cp),c1=r.u16(cp+2),c=[rgb565(c0),rgb565(c1)],ci=r.u32(cp+4);if(c0>c1||f!==0x31545844){c.push(c[0].map((x,i)=>Math.round((2*x+c[1][i])/3)),c[0].map((x,i)=>Math.round((x+2*c[1][i])/3)));}else c.push(c[0].map((x,i)=>Math.round((x+c[1][i])/2)),[0,0,0]);
    let alpha=[],alphaBits=0n;if(f===0x35545844){const a=r.u8(b),z=r.u8(b+1);alpha=[a,z];if(a>z){for(let i=1;i<=6;i++)alpha.push(Math.round(((7-i)*a+i*z)/7));}else{for(let i=1;i<=4;i++)alpha.push(Math.round(((5-i)*a+i*z)/5));alpha.push(0,255);}for(let i=0;i<6;i++)alphaBits|=BigInt(r.u8(b+2+i))<<BigInt(i*8);}
    for(let i=0;i<16;i++){const x=bx*4+i%4,y=by*4+(i>>2);if(x>=w||y>=h)continue;const color=(ci>>>(i*2))&3,o=(y*w+x)*4;out.set(c[color],o);out[o+3]=f===0x31545844?(c0<=c1&&color===3?0:255):f===0x33545844?((r.u8(b+(i>>1))>>>((i&1)*4))&15)*17:alpha[Number((alphaBits>>BigInt(i*3))&7n)];}
   }
  }else if([21,22,32,50,28].includes(f)){
   const bpp=[50,28].includes(f)?1:4,row=Math.max(stride,w*bpp);r.range(p,row*h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=p+y*row+x*bpp,o=(y*w+x)*4;if(f===50){out[o]=out[o+1]=out[o+2]=r.u8(s);out[o+3]=255;}else if(f===28){out[o]=out[o+1]=out[o+2]=255;out[o+3]=r.u8(s);}else{out[o]=r.u8(s+(f===32?0:2));out[o+1]=r.u8(s+1);out[o+2]=r.u8(s+(f===32?2:0));out[o+3]=f===22?255:r.u8(s+3);}}
  }else throw Error(`Format tekstur 0x${f.toString(16)} belum didukung. Preview mendukung DXT1/3/5, BGRA/RGBA, A8, L8.`);
  return{data:out,width:w,height:h,name:t.name};
 }
 function textureKey(name){return name.toLowerCase().split('^').pop().replace(/(_diff_\d{3})_[a-z]_(uni|whi|bla|chi|lat|ara|kor|pak)$/,'$1').replace(/(_diff_\d{3})_[a-z]$/,'$1');}
 function matchTexture(name,textures){if(!name)return textures.length===1?textures[0]:null;return textures.find(t=>t.name.toLowerCase()===name.toLowerCase())||textures.find(t=>textureKey(t.name)===textureKey(name))||(textures.length===1?textures[0]:null);}
 function candidateFiles(model,files){const m=model.parsed||root.AssetEngine.parseName(model.name),all=files.filter(f=>f.parsed.ext==='ytd');if(m.component)return all.filter(f=>f.parsed.component===m.component&&f.parsed.index===m.index&&f.parsed.namespace===m.namespace);const stem=model.name.slice(0,-4).toLowerCase();return all.filter(f=>{const n=f.name.toLowerCase();return n===stem+'.ytd'||n.startsWith(stem+'_')||n.startsWith(stem+'^');});}
 root.GtaPreview={Resource,pageSize,readYdd,readYtd,decodeTexture,textureKey,matchTexture,candidateFiles,half,MAX_RESOURCE};
})(globalThis);
