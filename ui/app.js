/* DITASHA Asset Sorter — local, ephemeral asset processing. */
'use strict';
const E=globalThis.AssetEngine,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const icons={eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',hair:'<path d="M5 20V9a7 7 0 0 1 14 0v11M8 19v-8m8 8V9M5 11c5 0 5-5 7-5 0 4 3 6 7 6M9 21h6"/>',shirt:'<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c-1 4-7 4-8 0Z"/>',glasses:'<circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 14h4M2 14V8l3-3m17 9V8l-3-3"/>',code:'<path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-15-4 18"/>',folder:'<path d="M3 5h7l2 3h9v12H3z"/>',shield:'<path d="m12 2 9 4v7c0 4-5 8-9 9-4-1-9-5-9-9V6z"/><path d="m8 12 3 3 5-6"/>',help:'<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4h.01"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',plus:'<path d="M12 4v16M4 12h16"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M9 10v7m6-7v7"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',box:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7 4.7l10 5.6"/>',file:'<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 13h8m-8 4h5"/>',check:'<path d="m5 12 4 4 10-10"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',alert:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',close:'<path d="m5 5 14 14M5 19 19 5"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.file}</svg>`;}
$$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const state={files:[],category:'all',busy:false,preview:'manifest',limit:100,nextId:1,archives:[],controller:null};let lastPlan,toastTimer;
const labels={all:'Semua aset',...E.categories};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function bytes(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:n<1024**3?`${(n/1048576).toFixed(1)} MB`:`${(n/1024**3).toFixed(2)} GB`;}
function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function settings(){return{name:$('#resource-name').value.trim(),mode:$('#mode').value,gender:$('#gender').value};}
function buildPlan(){return E.plan(state.files,settings());}
function render(){
 lastPlan=buildPlan();const size=state.files.reduce((s,f)=>s+E.fileSize(f),0),errors=lastPlan.issues.filter(i=>i.severity==='error');
 $('#stat-files').innerHTML=state.files.length+' <small>file</small>';$('#stat-size').innerHTML=bytes(size).replace(/ (B|KB|MB|GB)$/, ' <small>$1</small>');$('#stat-drawables').innerHTML=state.files.filter(f=>f.parsed.ext==='ydd').length+' <small>model</small>';$('#stat-issues').innerHTML=lastPlan.issues.length+' <small>temuan</small>';
 ['#file-btn','#folder-btn','#resource-name','#mode','#gender'].forEach(sel=>$(sel).disabled=state.busy);
 for(const key of Object.keys(labels))$('#count-'+key).textContent=key==='all'?state.files.length:state.files.filter(f=>f.category===key).length;
 const search=$('#search').value.toLowerCase(),type=$('#type-filter').value;
 const filtered=state.files.filter(f=>(state.category==='all'||f.category===state.category)&&(type==='all'||f.parsed.ext===type)&&f.path.toLowerCase().includes(search));
 $('#list-title').innerHTML=esc(labels[state.category])+` <span id="list-count">${filtered.length}</span>`;
 $('#file-list').innerHTML=filtered.slice(0,state.limit).map(f=>`<tr><td><div class="file-name"><span class="file-icon ${f.parsed.ext==='ytd'?'texture':''}">${icon(f.parsed.ext==='ytd'?'layers':'file')}</span><div class="file-text">${f.parsed.ext==='ydd'?`<button class="model-file-button" data-viewmodel="${f.id}" title="Preview 3D ${esc(f.name)}">${esc(f.name)} ${icon('eye')}</button>`:`<b title="${esc(f.name)}">${esc(f.name)}</b>`}<small title="${esc(f.path)}">${esc(f.path)}</small></div></div></td><td><select data-file-id="${f.id}" aria-label="Kategori ${esc(f.name)}">${Object.entries(E.categories).map(([k,v])=>`<option value="${k}" ${k===f.category?'selected':''}>${v}</option>`).join('')}</select></td><td class="size">${bytes(E.fileSize(f))}</td><td><button class="icon-button" data-remove="${f.id}" aria-label="Keluarkan ${esc(f.name)}">${icon('close')}</button></td></tr>`).join('');
 $('#empty').hidden=filtered.length>0;
 if(!filtered.length)$('#empty').innerHTML=state.files.length?`<div class="empty-symbol">${icon('search')}</div><h3>Tidak ada file yang cocok</h3><p>Ubah pencarian atau pilih kategori lain.</p>`:`<div class="empty-symbol">${icon('layers')}</div><h3>Workspace-mu masih kosong</h3><p>Masukkan aset untuk mulai menyortir<br>dan menyusun resource FiveM.</p><span>01 IMPOR <b>·</b> 02 PERIKSA <b>·</b> 03 EKSPOR</span>`;
 $('#table-summary').innerHTML=state.files.length?`${Math.min(state.limit,filtered.length)} dari ${filtered.length} file${filtered.length>state.limit?' · <button class="text-button" id="more-files">Tampilkan berikutnya</button>':''}`:'Belum ada file diimpor';
 $('#clear-btn').disabled=!state.files.length||state.busy;$('#model-preview-btn').disabled=state.busy||!state.files.some(f=>f.parsed.ext==='ydd');
 const addon=settings().mode==='addon';$('#gender-field').hidden=!addon;$('#mode-note').textContent=addon?'Collection baru dari komponen freemode. Nomor drawable tetap utuh.':'Pertahankan namespace dan metadata dari pack asli.';
 $('#ymt-summary').textContent=addon?`${lastPlan.groups.length} collection · biner RSC7`:'Menggunakan file bawaan';$('#ymt-badge').textContent=addon?'AUTO':'ASLI';$('#ymt-badge').classList.toggle('muted',!addon);
 $('#export-summary').textContent=state.files.length?`${lastPlan.files.length} aset untuk ekspor`:'Belum ada aset';$('#export-size').textContent=bytes(size);
 $('#name-note').textContent=/^[a-z][a-z0-9_]{0,39}$/.test(settings().name)?'Huruf kecil, angka, dan underscore.':'Nama belum valid; gunakan huruf kecil, angka, atau underscore.';
 $('#export-note').textContent=state.busy?'Sedang memproses aset…':!state.files.length?'Impor aset untuk mengaktifkan ekspor.':errors.length?`${errors.length} masalah harus diselesaikan sebelum ekspor.`:addon?'YMT baru disertakan. Uji hasilnya di FiveM.':'ZIP resource beserta manifest dan laporan.';
 ['#export-top','#export-btn'].forEach(sel=>$(sel).disabled=state.busy||!lastPlan.files.length||errors.length>0);
 $('#issues-panel').hidden=!state.files.length||!lastPlan.issues.length;
 $('#issues').innerHTML=lastPlan.issues.slice(0,24).map(i=>`<div class="issue ${i.severity}"><b>${i.severity==='error'?'Perlu diperbaiki':'Catatan'}</b> · ${esc(i.message)}</div>`).join('')+(lastPlan.issues.length>24?`<div class="issue">${lastPlan.issues.length-24} temuan lain. Periksa kategori dan file pasangan.</div>`:'');
 if($('#preview-dialog').open)renderPreview();
}
function transfer(title,detail,percent=0){$('#transfer').hidden=false;$('#transfer-title').textContent=title;$('#transfer-status').textContent=detail;$('#transfer-progress').value=Math.max(0,Math.min(100,percent));}
async function importFiles(list){
 if(state.busy)return;state.busy=true;state.controller=new AbortController();render();const signal=state.controller.signal,pending=[],readers=[];let skipped=0,total=state.files.reduce((s,f)=>s+E.fileSize(f),0),position=0;
 try{
  for(const file of list){
   LargeIO.checkAbort(signal);transfer('Mengimpor aset',file.name,position/list.length*100);let entries;
   if(file.name.toLowerCase().endsWith('.zip')){
    const archive=await LargeIO.openArchive(file,LargeIO.MAX-total,state.files.length+pending.length,signal);readers.push(archive.reader);entries=archive.entries;
   }else entries=[{path:file.webkitRelativePath||file.name,size:file.size,blob:file}];
   for(const source of entries){
    LargeIO.checkAbort(signal);
    if(source.path.endsWith('/')||source.path.split(/[\\/]/).some(x=>x.startsWith('.')||x==='__MACOSX')){skipped++;continue;}
    const safe=E.cleanPath(source.path),name=safe.split('/').pop();if(!name){skipped++;continue;}
    total+=source.size;if(total>LargeIO.MAX)throw Error('Batas total sesi 25 GB.');
    if(state.files.length+pending.length>=LargeIO.MAX_FILES)throw Error('Maksimal 50.000 file per sesi.');
    const parsed=E.parseName(name),record={id:state.nextId++,name,path:safe,size:source.size,blob:source.blob,entry:source.entry,parsed,category:E.classify(name,safe)};
    if(['ydd','ytd','yft','yld'].includes(parsed.ext)){
     if(source.blob){const header=new Uint8Array(await source.blob.slice(0,16).arrayBuffer());record.invalidHeader=header.length<16||new DataView(header.buffer).getUint32(0,true)!==0x37435352;}
     else record.headerDeferred=true;
    }
    if(['meta','xml'].includes(parsed.ext)){
     if(source.size>4*1048576)record.metaInvalid=true;
     else{const data=await LargeIO.smallBytes(source,4*1048576,signal),doc=new DOMParser().parseFromString(new TextDecoder().decode(data),'application/xml');record.metaInvalid=!!doc.querySelector('parsererror');record.metaRoot=doc.documentElement.tagName;}
    }
    pending.push(record);
    if(pending.length%100===0){transfer('Mengimpor aset',`${pending.length} file · ${bytes(total)} / 25 GB`,position/list.length*100);await new Promise(r=>setTimeout(r,0));}
   }
   position++;await new Promise(r=>setTimeout(r,0));
  }
  state.files.push(...pending);state.archives.push(...readers);state.limit=100;toast(`${pending.length} file diimpor${skipped?` · ${skipped} berkas sistem dilewati`:''}.`);
 }catch(e){for(const r of readers)await r.close().catch(()=>{});toast(signal.aborted?'Impor dibatalkan.':'Impor dibatalkan: '+(e.message||'Tidak dapat membaca file.'));}
 finally{state.busy=false;state.controller=null;$('#transfer').hidden=true;$('#file-input').value='';$('#folder-input').value='';render();}
}
$('#cancel-transfer').onclick=()=>state.controller?.abort();
$('#file-btn').onclick=e=>{e.stopPropagation();if(state.busy)return;$('#file-input').click();};$('#folder-btn').onclick=e=>{e.stopPropagation();if(state.busy)return;$('#folder-input').click();};
$('#file-input').onchange=e=>importFiles([...e.target.files]);$('#folder-input').onchange=e=>importFiles([...e.target.files]);
$('#dropzone').onclick=e=>{if(!state.busy&&!e.target.closest('button'))$('#file-input').click();};$('#dropzone').onkeydown=e=>{if(e.target===$('#dropzone')&&!state.busy&&['Enter',' '].includes(e.key)){e.preventDefault();$('#file-input').click();}};
let dragDepth=0;$('#dropzone').ondragenter=e=>{e.preventDefault();dragDepth++;$('#dropzone').classList.add('dragging');};$('#dropzone').ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};$('#dropzone').ondragleave=e=>{e.preventDefault();if(--dragDepth<=0)$('#dropzone').classList.remove('dragging');};
async function readEntry(entry,prefix=''){if(entry.isFile)return new Promise((res,rej)=>entry.file(f=>{Object.defineProperty(f,'webkitRelativePath',{value:prefix+f.name});res([f]);},rej));const reader=entry.createReader();let all=[];while(true){const items=await new Promise((res,rej)=>reader.readEntries(res,rej));if(!items.length)break;for(const item of items){all.push(...await readEntry(item,prefix+entry.name+'/'));if(all.length>LargeIO.MAX_FILES)throw Error('Folder melebihi batas 50.000 file.');}}return all;}
$('#dropzone').ondrop=async e=>{e.preventDefault();dragDepth=0;$('#dropzone').classList.remove('dragging');if(state.busy)return;const dt=e.dataTransfer;const entries=[...dt.items].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);try{if(entries.length){const files=[];for(const entry of entries)files.push(...await readEntry(entry));await importFiles(files);}else await importFiles([...dt.files]);}catch(err){toast(err.message||'Folder tidak dapat dibaca.');}};
$$('[data-category]').forEach(btn=>btn.onclick=()=>{state.category=btn.dataset.category;state.limit=100;$$('[data-category]').forEach(x=>{x.classList.toggle('active',x===btn);x.setAttribute('aria-current',x===btn?'page':'false');});render();});
$('#search').oninput=()=>{state.limit=100;render();};$('#type-filter').onchange=()=>{state.limit=100;render();};
$('#file-list').onchange=e=>{if(e.target.dataset.fileId&&!state.busy){const f=state.files.find(f=>f.id===+e.target.dataset.fileId);if(f&&Object.hasOwn(E.categories,e.target.value)){f.category=e.target.value;render();}}};
$('#file-list').onclick=e=>{const modelButton=e.target.closest('[data-viewmodel]');if(modelButton&&!state.busy){openModelPreview(+modelButton.dataset.viewmodel);return;}const b=e.target.closest('[data-remove]');if(b&&!state.busy){state.files=state.files.filter(f=>f.id!==+b.dataset.remove);render();}};
$('#table-summary').onclick=e=>{if(e.target.id==='more-files'){state.limit+=100;render();}};
['#resource-name','#mode','#gender'].forEach(sel=>$(sel).addEventListener(sel==='#resource-name'?'input':'change',render));
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#clear-btn').onclick=()=>$('#clear-dialog').showModal();$('#confirm-clear').onclick=()=>{if(state.busy)return;for(const r of state.archives)r.close().catch(()=>{});state.archives=[];state.files=[];$('#clear-dialog').close();render();toast('Workspace dikosongkan.');};
$('#help-btn').onclick=$('#help-top').onclick=()=>$('#help-dialog').showModal();
function renderPreview(){const p=buildPlan();let content;
 if(state.preview==='manifest')content=p.manifest;
 else if(state.preview==='tree')content=E.tree(p);
 else content=p.mode==='addon'?p.groups.length?p.groups.map(g=>`${g.name}\nPed: ${g.ped}\nYMT: stream/metadata/${g.creature}.ymt\n${g.components.map(c=>`  ${c.name} · slot ${c.slot} · ${c.items?.length||0} drawable · ${c.totalTextures||0} tekstur`).join('\n')}\n\n${E.ymtXml(g)}`).join('\n\n'):'Belum ada komponen freemode yang terdeteksi.\n\nContoh pasangan:\nhair_000_u.ydd\nhair_diff_000_a_uni.ytd':'Mode Pertahankan memakai YMT asli.\n\n'+(state.files.filter(f=>f.parsed.ext==='ymt').map(f=>f.path).join('\n')||'Belum ada YMT diimpor.');
 $('#preview-content').textContent=content;
}
$('#preview-btn').onclick=()=>{renderPreview();$('#preview-dialog').showModal();};$$('[data-preview]').forEach(b=>b.onclick=()=>{state.preview=b.dataset.preview;$$('[data-preview]').forEach(x=>x.classList.toggle('active',x===b));renderPreview();});
$('#copy-preview').onclick=async()=>{try{await navigator.clipboard.writeText($('#preview-content').textContent);toast('Pratinjau disalin.');}catch{toast('Tidak dapat mengakses clipboard. Pilih teks pratinjau lalu salin manual.');}};
async function exportResource(){
 if(state.busy)return;const p=buildPlan();if(!p.files.length||p.issues.some(i=>i.severity==='error')){toast('Periksa temuan sebelum ekspor.');return;}
 const size=p.files.reduce((s,f)=>s+E.fileSize(f.source),0),direct=typeof window.showSaveFilePicker==='function';
 if(!direct&&size>LargeIO.FALLBACK){toast('Penyimpanan desktop belum tersedia. Tutup dan buka kembali aplikasi.');return;}
 state.busy=true;state.controller=new AbortController();render();let disk=null,closed=false;
 try{
  let sink,blobSink;
  if(direct){
   const handle=await window.showSaveFilePicker({suggestedName:p.name+'.zip',types:[{description:'ZIP resource FiveM',accept:{'application/zip':['.zip']}}]});
   LargeIO.checkAbort(state.controller.signal);disk=await handle.createWritable();
   sink=new WritableStream({write:chunk=>disk.write(chunk),close:async()=>{await disk.close();closed=true;},abort:async e=>{await disk.abort(e);closed=true;}});
  }else{blobSink=new zip.BlobWriter('application/zip');sink=blobSink;}
  transfer('Mengekspor resource',`0 B / ${bytes(size)}`);
  let lastUpdate=0;await LargeIO.writeResource(p,sink,{signal:state.controller.signal,onprogress:info=>{const now=Date.now();if(now-lastUpdate>150||info.written===info.total){lastUpdate=now;transfer('Mengekspor resource',`${info.name} · ${bytes(info.written)} / ${bytes(info.total)}`,info.total?info.written/info.total*100:100);}}});
  if(disk&&!closed){await disk.close();closed=true;}
  if(blobSink){const blob=await blobSink.getData(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=p.name+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  toast(`Resource ${p.name}.zip selesai diekspor.`);
 }catch(e){if(disk&&!closed)await disk.abort().catch(()=>{});toast(e.name==='AbortError'||state.controller.signal.aborted?'Ekspor dibatalkan.':e.name==='SecurityError'?'Tidak dapat membuka lokasi penyimpanan. Coba folder lain.':'Ekspor gagal: '+e.message);}
 finally{state.busy=false;state.controller=null;$('#transfer').hidden=true;render();}
}
$('#export-btn').onclick=$('#export-top').onclick=exportResource;
const context=document.modelContext;
if(context?.registerTool){const controller=new AbortController();const options={signal:controller.signal};const register=tool=>{try{Promise.resolve(context.registerTool(tool,options)).catch(()=>{});}catch{}};
 register({name:'inspect_asset_workspace',title:'Periksa workspace aset',description:'Baca jumlah aset, kategori, konfigurasi, dan hasil pemeriksaan pada sesi browser ini.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>{const p=buildPlan();return{files:state.files.length,categories:Object.fromEntries(Object.keys(E.categories).map(k=>[k,state.files.filter(f=>f.category===k).length])),settings:settings(),issues:p.issues,collections:p.groups.map(g=>g.name)};}});
 register({name:'configure_asset_resource',title:'Atur resource aset',description:'Ubah nama resource dan mode ekspor pada workspace. Tidak mengunduh atau menghapus file.',inputSchema:{type:'object',properties:{name:{type:'string',pattern:'^[a-z][a-z0-9_]{0,39}$'},mode:{type:'string',enum:['preserve','addon']},gender:{type:'string',enum:['mp_m_freemode_01','mp_f_freemode_01']}},required:['name','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!/^[a-z][a-z0-9_]{0,39}$/.test(input.name)||!['preserve','addon'].includes(input.mode)||(input.gender&&!['mp_m_freemode_01','mp_f_freemode_01'].includes(input.gender)))throw Error('Konfigurasi resource tidak valid.');if(state.busy)throw Error('Workspace sedang memproses file.');$('#resource-name').value=input.name;$('#mode').value=input.mode;if(input.gender)$('#gender').value=input.gender;render();return{settings:settings(),issues:lastPlan.issues};}});
 window.addEventListener('pagehide',()=>controller.abort(),{once:true});
}
render();

async function openModelPreview(id){if(state.busy)return;try{const viewer=await import('./viewer.js');await viewer.openPreview(state.files,id);}catch(e){toast('Preview tidak dapat dibuka: '+e.message);}}
$('#model-preview-btn').onclick=()=>openModelPreview(state.files.find(f=>f.parsed.ext==='ydd')?.id);
