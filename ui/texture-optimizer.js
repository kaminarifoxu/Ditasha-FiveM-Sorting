const GP=globalThis.GtaPreview;
const DXT1=0x31545844,DXT3=0x33545844,DXT5=0x35545844;
const SUPPORTED=new Set([DXT1,DXT3,DXT5,21,22,32,50,28]);

function texHeader(r,p){return{header:p,name:r.str(r.ptr(p+40,true)),width:r.u16(p+80),height:r.u16(p+82),depth:r.u16(p+84),stride:r.u16(p+86),format:r.u32(p+88),levels:r.u8(p+93),data:r.ptr(p+112,true)};}
function collectTextures(r,kind){
 const out=[],seen=new Set();
 const push=p=>{if(p===null||seen.has(p))return;seen.add(p);out.push(texHeader(r,p));};
 if(kind==='ytd')for(const p of r.list(48))push(p);
 else{
  for(const d of r.list(48)){
   const sg=r.ptr(d+16,true);if(sg===null)continue;const td=r.ptr(sg+8,true);if(td===null)continue;for(const p of r.list(td+48))push(p);
  }
 }
 return out;
}
function pitch(format,w){if(format===DXT1)return Math.ceil(w/4)*8;if(format===DXT3||format===DXT5)return Math.ceil(w/4)*16;if([21,22,32].includes(format))return w*4;if([50,28].includes(format))return w;throw Error('Format tekstur belum didukung optimizer.');}
function levelSize(format,w,h){if(format===DXT1)return Math.ceil(w/4)*Math.ceil(h/4)*8;if(format===DXT3||format===DXT5)return Math.ceil(w/4)*Math.ceil(h/4)*16;if([21,22,32].includes(format))return w*h*4;if([50,28].includes(format))return w*h;throw Error('Format tekstur belum didukung optimizer.');}
function chainSize(format,w,h,levels){let n=0;for(let i=0;i<Math.max(1,levels);i++){n+=levelSize(format,w,h);w=Math.max(1,w>>1);h=Math.max(1,h>>1);}return n;}
function targetSize(w,h,max){let tw=w,th=h;while(Math.max(tw,th)>max){tw=Math.max(1,tw>>1);th=Math.max(1,th>>1);}return[tw,th];}
function halfImage(src,w,h){const nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),out=new Uint8Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const o=(y*nw+x)*4;let c=[0,0,0,0],n=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const sx=Math.min(w-1,x*2+dx),sy=Math.min(h-1,y*2+dy),s=(sy*w+sx)*4;for(let k=0;k<4;k++)c[k]+=src[s+k];n++;}for(let k=0;k<4;k++)out[o+k]=Math.round(c[k]/n);}return{data:out,width:nw,height:nh};}
function resizeTo(src,w,h,tw,th){let cur={data:src,width:w,height:h};while(cur.width>tw||cur.height>th)cur=halfImage(cur.data,cur.width,cur.height);return cur;}
function rgb565(r,g,b){return((r*31/255+.5)|0)<<11|((g*63/255+.5)|0)<<5|((b*31/255+.5)|0);}
function from565(v){return[((v>>>11)&31)*255/31,((v>>>5)&63)*255/63,(v&31)*255/31].map(Math.round);}
function write16(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;}function write32(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255;}
function blockPixels(src,w,h,bx,by){const p=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++){const sx=Math.min(w-1,bx*4+x),sy=Math.min(h-1,by*4+y),o=(sy*w+sx)*4;p.push([src[o],src[o+1],src[o+2],src[o+3]]);}return p;}
function colorBlock(pixels,allowAlpha=false){let min=[255,255,255],max=[0,0,0],hasAlpha=false;for(const p of pixels){for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}if(p[3]<128)hasAlpha=true;}let c0=rgb565(...max),c1=rgb565(...min);if(allowAlpha&&hasAlpha){if(c0>c1)[c0,c1]=[c1,c0];}else if(c0<=c1){if(c0===c1)c0=Math.min(65535,c0+1);else[c0,c1]=[c1,c0];}const a=from565(c0),b=from565(c1),pal=[a,b];if(c0>c1||!allowAlpha)pal.push(a.map((v,i)=>Math.round((2*v+b[i])/3)),a.map((v,i)=>Math.round((v+2*b[i])/3)));else pal.push(a.map((v,i)=>Math.round((v+b[i])/2)),[0,0,0]);let bits=0;for(let i=0;i<16;i++){const p=pixels[i];let best=(allowAlpha&&hasAlpha&&p[3]<128&&c0<=c1)?3:0,dist=Infinity;if(best!==3)for(let j=0;j<4;j++){const q=pal[j],d=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(d<dist){dist=d;best=j;}}bits|=best<<(i*2);}const out=new Uint8Array(8);write16(out,0,c0);write16(out,2,c1);write32(out,4,bits>>>0);return out;}
function alphaBlockDXT5(pixels){let amin=255,amax=0;for(const p of pixels){amin=Math.min(amin,p[3]);amax=Math.max(amax,p[3]);}let a0=amax,a1=amin;if(a0===a1){a0=Math.min(255,a0+1);a1=Math.max(0,a1-1);}const pal=[a0,a1];if(a0>a1){for(let i=1;i<=6;i++)pal.push(Math.round(((7-i)*a0+i*a1)/7));}else{for(let i=1;i<=4;i++)pal.push(Math.round(((5-i)*a0+i*a1)/5));pal.push(0,255);}let bits=0n;for(let i=0;i<16;i++){let best=0,dist=1e9;for(let j=0;j<8;j++){const d=Math.abs(pixels[i][3]-pal[j]);if(d<dist){dist=d;best=j;}}bits|=BigInt(best)<<BigInt(i*3);}const out=new Uint8Array(8);out[0]=a0;out[1]=a1;for(let i=0;i<6;i++)out[2+i]=Number((bits>>BigInt(i*8))&255n);return out;}
function encodeLevel(src,w,h,format){
 if(format===DXT1||format===DXT3||format===DXT5){const bs=format===DXT1?8:16,bw=Math.ceil(w/4),bh=Math.ceil(h/4),out=new Uint8Array(bw*bh*bs);let o=0;for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){const px=blockPixels(src,w,h,bx,by);if(format===DXT1){out.set(colorBlock(px,true),o);o+=8;}else if(format===DXT3){for(let i=0;i<8;i++)out[o+i]=0;for(let i=0;i<16;i++){const a=Math.round(px[i][3]/17)&15,bi=o+(i>>1);out[bi]|=a<<((i&1)*4);}out.set(colorBlock(px,false),o+8);o+=16;}else{out.set(alphaBlockDXT5(px),o);out.set(colorBlock(px,false),o+8);o+=16;}}return out;}
 const bpp=[50,28].includes(format)?1:4,out=new Uint8Array(w*h*bpp);for(let i=0;i<w*h;i++){const s=i*4,o=i*bpp;if(format===50)out[o]=Math.round((src[s]*.2126+src[s+1]*.7152+src[s+2]*.0722));else if(format===28)out[o]=src[s+3];else if(format===32){out[o]=src[s];out[o+1]=src[s+1];out[o+2]=src[s+2];out[o+3]=src[s+3];}else{out[o]=src[s+2];out[o+1]=src[s+1];out[o+2]=src[s];out[o+3]=format===22?255:src[s+3];}}return out;
}
function encodeChain(top,w,h,format,levels){const chunks=[];let cur={data:top,width:w,height:h},total=0;for(let i=0;i<levels;i++){const enc=encodeLevel(cur.data,cur.width,cur.height,format);chunks.push(enc);total+=enc.length;if(cur.width===1&&cur.height===1)break;cur=halfImage(cur.data,cur.width,cur.height);}const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.length;}return{data:out,levels:chunks.length};}
function writeResource(original,r,kind){const compressed=globalThis.fflate.deflateSync(r.data,{level:9});const out=new Uint8Array(16+compressed.length);out.set(original.subarray(0,16),0);out.set(compressed,16);new GP.Resource(out,kind);return out;}
export function inspect(bytes,kind){const parsed=kind==='ytd'?GP.readYtd(bytes):GP.readYdd(bytes),textures=collectTextures(parsed.resource,kind);return textures.map(t=>({name:t.name,width:t.width,height:t.height,format:t.format,levels:t.levels,supported:SUPPORTED.has(t.format)}));}
export function optimize(bytes,kind,{maxDimension=2048,minDimension=64}={}){
 if(!['ytd','ydd'].includes(kind))throw Error('Optimizer hanya mendukung YTD dan tekstur embedded YDD.');
 const parsed=kind==='ytd'?GP.readYtd(bytes):GP.readYdd(bytes),r=parsed.resource,textures=collectTextures(r,kind),report=[];let changed=0;
 for(const t of textures){if(!SUPPORTED.has(t.format)||t.data===null||!t.width||!t.height)continue;const[tw,th]=targetSize(t.width,t.height,maxDimension);if(tw===t.width&&th===t.height)continue;if(Math.min(tw,th)<minDimension)continue;const oldLogical=chainSize(t.format,t.width,t.height,Math.max(1,t.levels||1));r.range(t.data,oldLogical);const decoded=GP.decodeTexture(r,t),resized=resizeTo(decoded.data,t.width,t.height,tw,th),maxLevels=Math.floor(Math.log2(Math.max(tw,th)))+1,levels=Math.min(Math.max(1,t.levels||1),maxLevels),encoded=encodeChain(resized.data,tw,th,t.format,levels);if(encoded.data.length>oldLogical)continue;r.data.set(encoded.data,t.data);r.data.fill(0,t.data+encoded.data.length,t.data+oldLogical);r.v.setUint16(t.header+80,tw,true);r.v.setUint16(t.header+82,th,true);r.v.setUint16(t.header+86,pitch(t.format,tw),true);r.v.setUint8(t.header+93,encoded.levels);report.push({name:t.name,before:[t.width,t.height],after:[tw,th],beforeBytes:oldLogical,afterBytes:encoded.data.length});changed++;}
 const out=writeResource(bytes,r,kind);return{bytes:out,report,changed,beforeBytes:bytes.length,afterBytes:out.length,textures:textures.length};
}
