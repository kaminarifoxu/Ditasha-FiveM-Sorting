/* Binary layout documented by CodeWalker (dexyfex), GTA V Legacy resource v2.
 * This generator writes CPedVariationInfo for filename-addressed freemode components.
 * It does not rewrite geometry, texture dictionary internals, rigs, or existing YMTs.
 */
(function(root){
 'use strict';
 const slots=['head','berd','hair','uppr','lowr','hand','feet','teef','accs','task','decl','jbib'];
 const categories={peds:'Peds',hair:'Rambut',clothing:'Pakaian',props:'Props',metadata:'Metadata',other:'Perlu ditinjau'};
 const supported=new Set(['ydd','ytd','yft','ymt','yld','ydr','ybn','ymap','ytyp','meta','xml']);
 const streams=new Set(['ydd','ytd','yft','ymt','yld','ydr','ybn','ymap','ytyp']);
 const enc=new TextEncoder();
 function parseName(name){
  const lower=name.toLowerCase(), ext=lower.split('.').pop();
  const base=lower.slice(0,-ext.length-1), cut=base.lastIndexOf('^');
  const namespace=cut>=0?base.slice(0,cut):'', short=cut>=0?base.slice(cut+1):base;
  const ped=namespace.startsWith('mp_f_freemode_01')?'mp_f_freemode_01':namespace.startsWith('mp_m_freemode_01')?'mp_m_freemode_01':null;
  let m=short.match(/^(head|berd|hair|uppr|lowr|hand|feet|teef|accs|task|decl|jbib)_(\d{3})_([urm])(?:_(\d+))?$/);
  if(m&&['ydd','yld'].includes(ext))return{namespace,ped,ext,component:m[1],slot:slots.indexOf(m[1]),index:+m[2],suffix:m[3],alternative:+(m[4]||0),short,kind:ext==='ydd'?'drawable':'cloth'};
  m=short.match(/^(head|berd|hair|uppr|lowr|hand|feet|teef|accs|task|decl|jbib)_diff_(\d{3})_([a-z])_(uni|whi|bla|chi|lat|ara|kor|pak)$/);
  if(m&&ext==='ytd')return{namespace,ped,ext,component:m[1],slot:slots.indexOf(m[1]),index:+m[2],variant:m[3].charCodeAt(0)-97,texId:['uni','whi','bla','chi','lat','ara','kor','pak'].indexOf(m[4]),short,kind:'texture'};
  return{namespace,ped,ext,short,kind:null};
 }
 function classify(name,path=''){
  const p=parseName(name);
  if(['meta','xml','ymt'].includes(p.ext))return'metadata';
  if(p.component)return p.component==='hair'?'hair':'clothing';
  if(/^p_(head|eyes|ears|l?wrist)/.test(p.short)||/\bprops?\b/i.test(path))return'props';
  if(/(^|[\/_ -])(hair|rambut)([\/_ -]|$)/i.test(path))return'hair';
  if(/(^|[\/_ -])(clothes|clothing|pakaian)([\/_ -]|$)/i.test(path))return'clothing';
  if(['ydd','ytd','yft','yld'].includes(p.ext))return'peds';
  return'other';
 }
 function cleanPath(path){return path.replace(/\\/g,'/').split('/').filter(x=>x&&x!=='.'&&x!=='..'&&!/[\x00-\x1f]/.test(x)).join('/');}
 function fileSize(f){return f.size??f.bytes?.length??0;}
 function itemFolder(f,files){
  const p=f.parsed,stem=f.name.slice(0,-p.ext.length-1);
  if(p.component)return `${f.category}/${p.namespace||'freemode'}/${p.component}_${String(p.index).padStart(3,'0')}`;
  const prop=p.short.match(/^(p_[a-z]+)_(?:diff_)?(\d{3})_/);
  if(prop)return `props/${p.namespace||'freemode'}/${prop[1]}_${prop[2]}`;
  const isPed=f.category==='peds'||(p.ext==='ymt'&&(files instanceof Set?files.has(stem.toLowerCase()):files.some(x=>x.category==='peds'&&x.name.slice(0,-x.parsed.ext.length-1).toLowerCase()===stem.toLowerCase())));
  return `${isPed?'peds':f.category}/${stem}`;
 }
 function metaType(file){const n=file.name.toLowerCase(), r=file.metaRoot;
  if(r==='ShopPedApparel'||/(_shop|apparel)\.meta$/.test(n))return'SHOP_PED_APPAREL_META_FILE';
  if(r==='CPedModelInfo__InitDataList'||n==='peds.meta')return'PED_METADATA_FILE';
  if(r==='CExtraTextMetaFile'||n==='pedalternatevariations.meta')return'ALTERNATE_VARIATIONS_FILE';
  const map={'vehicles.meta':'VEHICLE_METADATA_FILE','carvariations.meta':'VEHICLE_VARIATION_FILE','carcols.meta':'CARCOLS_FILE','handling.meta':'HANDLING_FILE','vehiclelayouts.meta':'VEHICLE_LAYOUTS_FILE'};
  if(file.parsed.ext==='ytyp')return'DLC_ITYP_REQUEST';return map[n]||null;
 }
 const issue=(severity,message)=>({severity,message});
 function plan(files,settings){
  const result={files:[],groups:[],issues:[],manifest:'',name:settings.name,mode:settings.mode};
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(settings.name))result.issues.push(issue('error','Nama resource harus dimulai dengan huruf kecil dan berisi maksimal 40 huruf kecil, angka, atau underscore.'));
  const seen=new Map(),pedNames=new Set(files.filter(f=>f.category==='peds').map(f=>f.name.slice(0,-f.parsed.ext.length-1).toLowerCase()));
  for(const f of files){
   const key=f.name.toLowerCase();if(seen.has(key))result.issues.push(issue('error',`Nama file bentrok: ${f.name}. Hapus salah satu atau gunakan pack terpisah.`));else seen.set(key,f);
   if(!supported.has(f.parsed.ext)){result.issues.push(issue('warning',`${f.name}: format ini tidak ikut diekspor. Skrip, resource escrow, dan arsip RPF membutuhkan resource asli.`));continue;}
   if(fileSize(f)===0){result.issues.push(issue('error',`${f.name}: file kosong.`));continue;}
   if(f.invalidHeader)result.issues.push(issue('error',`${f.name}: header model/tekstur bukan RSC7 GTA V Legacy. Aset rusak, Enhanced, atau escrow tidak didukung.`));
   if(f.metaInvalid)result.issues.push(issue('error',`${f.name}: XML metadata tidak valid.`));
   if(f.category==='other')result.issues.push(issue('warning',`${f.name}: kategori belum dikenali; periksa sebelum digunakan.`));
   if(!/^[a-zA-Z0-9_.^+-]+$/.test(f.name))result.issues.push(issue('error',`${f.name}: nama file mengandung karakter yang tidak didukung.`));
   if(settings.mode==='addon'&&f.parsed.component){continue;}
   if(settings.mode==='addon'&&((f.parsed.ext==='ymt'&&/freemode|creaturemetadata/i.test(f.name))||metaType(f)==='SHOP_PED_APPAREL_META_FILE'))continue;
   const dest=streams.has(f.parsed.ext)?`stream/${itemFolder(f,pedNames)}/${f.name}`:`data/${f.name}`;
   result.files.push({path:dest,bytes:f.bytes,source:f});
  }
  if(settings.mode==='addon'){
   const groupMap=new Map();
   for(const f of files.filter(f=>f.parsed.component)){
    const p=f.parsed,ped=p.ped||settings.gender;
    if(p.namespace&&!p.ped){result.issues.push(issue('error',`${f.name}: namespace bukan ped freemode yang didukung.`));continue;}
    const key=ped+'|'+p.namespace;
    if(!groupMap.has(key))groupMap.set(key,{ped,namespace:p.namespace,files:[],components:[],name:''});groupMap.get(key).files.push(f);
   }
   const pedCounts=new Map();
   for(const group of groupMap.values()){
    const number=(pedCounts.get(group.ped)||0)+1;pedCounts.set(group.ped,number);
    const suffix=number>1?'_'+number:'';
    group.dlc=settings.name+suffix;group.name=group.ped+'_'+group.dlc;
    group.ymtName=group.name;group.creature='MP_CreatureMetadata_'+group.name;
    const compMap=new Map();
    for(const f of group.files){const p=f.parsed;
     if(!compMap.has(p.slot))compMap.set(p.slot,{slot:p.slot,name:p.component,drawables:new Map(),textures:new Map(),cloth:new Set()});
     const c=compMap.get(p.slot);
     if(p.kind==='drawable'){
      if(p.alternative){result.issues.push(issue('error',`${f.name}: drawable alternatif belum didukung generator YMT; gunakan metadata asli.`));continue;}
      if(c.drawables.has(p.index))result.issues.push(issue('error',`${p.component} ${p.index}: ada lebih dari satu model di collection ${group.namespace||group.ped}.`));
      c.drawables.set(p.index,{index:p.index,suffix:p.suffix,source:f,textures:[]});
     }else if(p.kind==='texture'){
      if(!c.textures.has(p.index))c.textures.set(p.index,[]);c.textures.get(p.index).push(f);
     }else c.cloth.add(p.index);
    }
    group.components=[...compMap.values()].sort((a,b)=>a.slot-b.slot);
    for(const c of group.components){
     const ids=[...c.drawables.keys()].sort((a,b)=>a-b);
     if(!ids.length){result.issues.push(issue('error',`${group.ped} / ${c.name}: tekstur atau cloth tidak memiliki YDD pasangan.`));continue;}
     if(ids[0]!==0||ids.some((id,i)=>id!==i))result.issues.push(issue('error',`${group.ped} / ${c.name}: nomor drawable harus berurutan dari 000. Saat ini: ${ids.map(i=>String(i).padStart(3,'0')).join(', ')}. Gunakan mode Pertahankan untuk aset replace.`));
     if(ids.length>256)result.issues.push(issue('error',`${c.name}: maksimal 256 drawable per collection.`));
     c.items=ids.map(id=>c.drawables.get(id));c.totalTextures=0;
     for(const d of c.items){
      const tex=(c.textures.get(d.index)||[]).sort((a,b)=>a.parsed.variant-b.parsed.variant);
      d.textures=tex.map(t=>({variant:t.parsed.variant,texId:t.parsed.texId,source:t}));d.cloth=c.cloth.has(d.index);
      if(!tex.length)result.issues.push(issue('error',`${d.source.name}: belum memiliki tekstur YTD pasangan. Impor ${c.name}_diff_${String(d.index).padStart(3,'0')}_a_uni.ytd (atau suffix ras yang sesuai).`));
      if(tex.some((t,i)=>t.parsed.variant!==i))result.issues.push(issue('error',`${d.source.name}: variasi tekstur harus berurutan mulai a, tanpa huruf yang hilang atau ganda.`));
      c.totalTextures+=tex.length;
     }
     if(c.totalTextures>255)result.issues.push(issue('error',`${c.name}: total tekstur melebihi 255 untuk field numAvailTex; pecah menjadi collection terpisah.`));
     for(const id of [...c.textures.keys(),...c.cloth])if(!c.drawables.has(id))result.issues.push(issue('error',`${c.name} ${id}: tekstur/cloth tidak memiliki model pasangan.`));
    }
    result.groups.push(group);
    for(const f of group.files)result.files.push({path:`stream/${f.category}/${group.name}/${f.parsed.component}_${String(f.parsed.index).padStart(3,'0')}/${group.name}^${f.parsed.short}.${f.parsed.ext}`,bytes:f.bytes,source:f});
   }
   if(!result.groups.length)result.issues.push(issue('error','Mode add-on membutuhkan YDD/YTD komponen freemode dengan nama seperti hair_000_u.ydd dan hair_diff_000_a_uni.ytd.'));
   if(files.some(f=>f.category==='props'))result.issues.push(issue('error','Generator YMT belum mendukung props. Ekspor props dalam mode Pertahankan bersama YMT dan shop META aslinya.'));
   for(const f of files.filter(f=>['hair','clothing'].includes(f.category)&&streams.has(f.parsed.ext)&&!f.parsed.component&&f.parsed.ext!=='ymt'))result.issues.push(issue('error',`${f.name}: nama komponen tidak dapat dipetakan untuk YMT add-on. Gunakan metadata asli atau perbaiki nama file.`));
   if(result.groups.length)result.issues.push(issue('warning','YMT dibuat dari nama file. Rig, nama tekstur di dalam YTD, flags khusus, dan mesh tidak diperiksa. Uji resource di FiveM.'));
  }
  const pedFiles=files.filter(f=>f.category==='peds'&&['ydd','yft'].includes(f.parsed.ext)&&!f.parsed.component);
  if(pedFiles.length&&!files.some(f=>metaType(f)==='PED_METADATA_FILE'))result.issues.push(issue('error','Ped kustom memerlukan peds.meta asli. Impor peds.meta beserta YMT ped agar resource dapat didaftarkan.'));
  const pedStems=new Set();
  for(const f of files.filter(f=>f.category==='peds'&&['ydd','yft'].includes(f.parsed.ext)&&!f.parsed.component)){
   if(pedStems.has(f.name.slice(0,-4).toLowerCase()))continue;pedStems.add(f.name.slice(0,-4).toLowerCase());
   const stem=f.name.slice(0,-4).toLowerCase();if(!seen.has(stem+'.ymt'))result.issues.push(issue('error',`${f.name}: YMT ped pasangan belum ada. YMT ped kustom tidak dapat ditentukan dari nama file saja.`));
  }
  for(const f of result.files.filter(f=>f.source.parsed.ext==='meta'&&!metaType(f.source)))result.issues.push(issue('error',`${f.source.name}: jenis metadata tidak dikenali. Resource asli diperlukan untuk memastikan data_file yang benar.`));
  const outputs=new Set();for(const f of result.files){const key=f.path.toLowerCase();if(outputs.has(key))result.issues.push(issue('error',`Path hasil bentrok: ${f.path}`));outputs.add(key);}
  for(const g of result.groups){
   for(const path of [`stream/metadata/${g.creature}.ymt`,`data/${g.name}_shop.meta`])if(outputs.has(path.toLowerCase()))result.issues.push(issue('error',`Metadata hasil bentrok: ${path}`));
  }
  result.manifest=manifest(result);return result;
 }
 function manifest(p){
  const meta=p.files.filter(f=>metaType(f.source)).map(f=>({type:metaType(f.source),path:f.path}));
  for(const g of p.groups)meta.push({type:'SHOP_PED_APPAREL_META_FILE',path:`data/${g.name}_shop.meta`});
  return `fx_version 'cerulean'\ngame 'gta5'\n\nauthor 'DITASHA WORKSHOP'\ndescription 'FiveM assets organized with DITASHA'\nversion '1.0.0'\n`+(meta.length?`\nfiles {\n${meta.map(m=>`    '${m.path}'`).join(',\n')}\n}\n\n${meta.map(m=>`data_file '${m.type}' '${m.path}'`).join('\n')}\n`:'\n-- Files in stream/ are discovered automatically by FiveM.\n');
 }
 function shopMeta(g){const entries=[];
  for(const c of g.components)for(const d of c.items||[])for(const t of d.textures)entries.push(`    <Item><lockHash>0</lockHash><cost value="0"/><textLabel/><uniqueNameHash>CLO_${g.name.toUpperCase()}_${c.name.toUpperCase()}_${d.index}_${t.variant}</uniqueNameHash><eShopEnum>CLO_SHOP_NONE</eShopEnum><locate value="-99"/><scriptSaveData value="0"/><restrictionTags/><forcedComponents/><variantComponents/><drawableIndex value="${d.index}"/><localDrawableIndex value="${d.index}"/><eCompType>PV_COMP_${c.name.toUpperCase()}</eCompType><textureIndex value="${t.variant}"/><isInOutfit value="false"/></Item>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ShopPedApparel>\n  <pedName>${g.ped}</pedName>\n  <dlcName>${g.dlc}</dlcName>\n  <fullDlcName>${g.name}</fullDlcName>\n  <eCharacter>${g.ped.includes('_f_')?'SCR_CHAR_MULTIPLAYER_F':'SCR_CHAR_MULTIPLAYER'}</eCharacter>\n  <creatureMetaData>${g.creature}</creatureMetaData>\n  <pedOutfits/>\n  <pedComponents>\n${entries.join('\n')}\n  </pedComponents>\n  <pedProps/>\n</ShopPedApparel>\n`;
 }
 function ymtXml(g){const avail=Array(12).fill(255);g.components.forEach((c,i)=>avail[c.slot]=i);
  const comps=g.components.map(c=>`<Item><numAvailTex value="${c.totalTextures}"/><aDrawblData3 itemType="CPVDrawblData">${(c.items||[]).map(d=>`<Item><propMask value="${({u:0,r:16,m:32}[d.suffix])|1}"/><numAlternatives value="0"/><aTexData itemType="CPVTextureData">${d.textures.map(t=>`<Item><texId value="${t.texId}"/><distribution value="255"/></Item>`).join('')}</aTexData><clothData><ownsCloth value="${d.cloth}"/></clothData></Item>`).join('')}</aDrawblData3></Item>`).join('\n');
  const infos=g.components.flatMap(c=>(c.items||[]).map(d=>`<Item><hash_2FD08CEF>none</hash_2FD08CEF><hash_FC507D28>none</hash_FC507D28><hash_07AE529D>0 0 0 0 0</hash_07AE529D><flags value="0"/><inclusions>0</inclusions><exclusions>0</exclusions><hash_6032815C>PV_COMP_HEAD</hash_6032815C><hash_7E103C8B value="0"/><hash_D12F579D value="${c.slot}"/><hash_FA1F27BF value="${d.index}"/></Item>`)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CPedVariationInfo name="${g.name}">\n<bHasTexVariations value="true"/><bHasDrawblVariations value="true"/><bHasLowLODs value="false"/><bIsSuperLOD value="false"/>\n<availComp>${avail.join(' ')}</availComp>\n<aComponentData3 itemType="CPVComponentData">${comps}</aComponentData3>\n<aSelectionSets itemType="CPedSelectionSet"/>\n<compInfos itemType="CComponentInfo">${infos}</compInfos>\n<propInfo><numAvailProps value="0"/><aPropMetaData itemType="CPedPropMetaData"/><aAnchors itemType="CAnchorProps"/></propInfo>\n<dlcName>hash_00000000</dlcName>\n</CPedVariationInfo>\n`;
 }
 function joaat(s){let h=0;for(const c of enc.encode(s.toLowerCase())){h=(h+c)>>>0;h=(h+(h<<10))>>>0;h^=h>>>6;}h=(h+(h<<3))>>>0;h^=h>>>11;return(h+(h<<15))>>>0;}
 function concat(parts){const a=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){a.set(p,o);o+=p.length;}return a;}
 function binaryYmt(g){
  const schemas=root.YMT_SCHEMAS;if(!schemas)throw Error('Schema YMT belum tersedia.');
  const schema=n=>schemas.find(s=>s.name===n), align=n=>(n+15)&~15;
  const blocks=[{name:'CPedVariationInfo',data:new Uint8Array(112)}];
  // Each array occupies its own numbered data block; pointers encode (offset << 12) | blockId.
  function add(name,data,count){if(!count)return{ptr:0,count:0};if(blocks.length>=4095)throw Error('Terlalu banyak blok metadata.');blocks.push({name,data});return{ptr:blocks.length,count};}
  function view(a){return new DataView(a.buffer,a.byteOffset,a.byteLength);}
  function arr(a,o,p){const v=view(a);v.setUint32(o,p.ptr,true);v.setUint16(o+8,p.count,true);v.setUint16(o+10,p.count,true);}
  const rootData=blocks[0].data;rootData[0]=1;rootData[1]=1;rootData.fill(255,4,16);
  const comps=[],infos=[];
  for(const [ci,c] of g.components.entries()){
   rootData[4+c.slot]=ci;const cd=new Uint8Array(24);cd[0]=c.totalTextures;const drawables=[];
   for(const d of c.items){const dd=new Uint8Array(48);dd[0]=({u:0,r:16,m:32}[d.suffix])|1;dd[24]=d.cloth?1:0;
    const td=new Uint8Array(d.textures.length*3);d.textures.forEach((t,i)=>{td[i*3]=t.texId;td[i*3+1]=255;});arr(dd,8,add('CPVTextureData',td,d.textures.length));drawables.push(dd);
    const inf=new Uint8Array(48),iv=view(inf);iv.setUint32(0,joaat('none'),true);iv.setUint32(4,joaat('none'),true);inf[44]=c.slot;inf[45]=d.index;infos.push(inf);
   }
   arr(cd,8,add('CPVDrawblData',concat(drawables),drawables.length));comps.push(cd);
  }
  arr(rootData,16,add('CPVComponentData',concat(comps),comps.length));arr(rootData,48,add('CComponentInfo',concat(infos),infos.length));
  let offset=112;const alloc=n=>{const p=offset;offset+=align(n);return p;};
  const pages=alloc(24),structs=alloc(schemas.length*32),enumPos=alloc(24),blockPos=alloc(blocks.length*16),namePos=alloc(enc.encode(g.name).length+1);
  const entryPos=schemas.map(s=>alloc(s.entries.length*16));const enumEntries=alloc(14*8);
  const dataPos=blocks.map(b=>alloc(b.data.length));let pageSize=8192,shift=0;while(pageSize<offset){pageSize*=2;shift++;}if(shift>15)throw Error('YMT melebihi ukuran halaman resource.');
  const buf=new Uint8Array(pageSize),v=view(buf);const ptr=(o,p)=>v.setBigUint64(o,BigInt(0x50000000+p),true);
  v.setUint32(0,0x405bc808,true);v.setUint32(4,1,true);ptr(8,pages);buf[pages+8]=1;
  v.setUint32(16,0x50524430,true);v.setUint16(20,0x79,true);v.setUint32(28,1,true);ptr(32,structs);ptr(40,enumPos);ptr(48,blockPos);ptr(56,namePos);
  v.setUint16(72,schemas.length,true);v.setUint16(74,1,true);v.setUint16(76,blocks.length,true);buf.set(enc.encode(g.name),namePos);
  schemas.forEach((s,i)=>{const o=structs+i*32;v.setUint32(o,s.hash,true);v.setUint32(o+4,s.key,true);v.setUint32(o+8,s.flags,true);ptr(o+16,entryPos[i]);v.setUint32(o+24,s.size,true);v.setUint16(o+30,s.entries.length,true);
   s.entries.forEach((e,j)=>{const p=entryPos[i]+j*16;v.setUint32(p,e[0],true);v.setUint32(p+4,e[1],true);buf[p+8]=e[2];buf[p+9]=e[3];v.setUint16(p+10,e[4],true);v.setUint32(p+12,e[5],true);});
  });
  v.setUint32(enumPos,884254308,true);v.setUint32(enumPos+4,3472084374,true);ptr(enumPos+8,enumEntries);v.setUint32(enumPos+16,14,true);
  ['INVALID',...slots.map(s=>s.toUpperCase()),'MAX'].forEach((n,i)=>{v.setUint32(enumEntries+i*8,joaat('PV_COMP_'+n),true);v.setInt32(enumEntries+i*8+4,i-1,true);});
  blocks.forEach((b,i)=>{const o=blockPos+i*16;v.setUint32(o,schema(b.name).hash,true);v.setUint32(o+4,align(b.data.length),true);ptr(o+8,dataPos[i]);buf.set(b.data,dataPos[i]);});
  const header=new Uint8Array(16),h=view(header);h.setUint32(0,0x37435352,true);h.setUint32(4,2,true);h.setUint32(8,(1<<17)|shift,true);h.setUint32(12,2<<28,true);
  return concat([header,root.fflate.deflateSync(buf,{level:6})]);
 }
 function tree(p){const paths=p.files.map(f=>f.path);for(const g of p.groups)paths.push(`stream/metadata/${g.creature}.ymt`,`data/${g.name}_shop.meta`,`source/${g.name}.ymt.xml`);paths.push('fxmanifest.lua','README.txt','ditasha-report.json');return p.name+'/\n'+paths.sort().map(x=>'  '+x).join('\n');}
 function generated(p){if(p.issues.some(i=>i.severity==='error'))throw Error('Selesaikan temuan yang memblokir ekspor terlebih dahulu.');
  const zip={};const prefix=p.name+'/';
  for(const g of p.groups){zip[prefix+`stream/metadata/${g.creature}.ymt`]=binaryYmt(g);zip[prefix+`data/${g.name}_shop.meta`]=enc.encode(shopMeta(g));zip[prefix+`source/${g.name}.ymt.xml`]=enc.encode(ymtXml(g));}
  zip[prefix+'fxmanifest.lua']=enc.encode(p.manifest);
  zip[prefix+'README.txt']=enc.encode(`DITASHA WORKSHOP — FiveM Asset Sorter\n\n1. Ekstrak folder ${p.name} ke resources/[assets]/.\n2. Tambahkan ke server.cfg:\n   ensure ${p.name}\n3. Restart resource dan uji semua aset di FiveM GTA V Legacy.\n\nMode: ${p.mode==='addon'?'Add-on freemode, YMT RSC7 v2 baru':'Pertahankan namespace/metadata asli'}\n${p.groups.map(g=>`Collection: ${g.name} — ped ${g.ped}`).join('\n')}\n\nTidak mengubah skeleton, mesh, atau nama tekstur internal YTD.\nMetadata ped kustom dan props harus berasal dari resource aslinya.\nFile source/*.ymt.xml hanya untuk pemeriksaan/penyuntingan CodeWalker; bukan file stream.\nJangan menjalankan resource asli dengan collection yang sama bersamaan.\n\nTEMUAN\n${p.issues.map(i=>`[${i.severity}] ${i.message}`).join('\n')||'Tidak ada temuan dari pemeriksaan nama file.'}\n`);
  zip[prefix+'ditasha-report.json']=enc.encode(JSON.stringify({resource:p.name,mode:p.mode,generatedAt:new Date().toISOString(),files:p.files.map(f=>({source:f.source.path,output:f.path,size:fileSize(f.source)})),collections:p.groups.map(g=>({name:g.name,ped:g.ped,components:g.components.map(c=>({slot:c.slot,name:c.name,drawables:c.items.length,textures:c.totalTextures}))})),issues:p.issues},null,2));
  return zip;
 }
 function output(p){const zip=generated(p);for(const f of p.files){if(!f.bytes)throw Error('Gunakan ekspor streaming untuk file besar.');zip[p.name+'/'+f.path]=f.bytes;}return root.fflate.zipSync(zip,{level:0});
 }
 root.AssetEngine={parseName,classify,cleanPath,metaType,plan,manifest,binaryYmt,ymtXml,shopMeta,output,tree,joaat,categories,supported,fileSize,itemFolder,generated};
})(globalThis);
