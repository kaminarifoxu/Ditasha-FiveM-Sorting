(() => {
  const bridge=window.ditashaDesktop;
  if (!bridge) return;
  document.querySelector('#install-app').onclick=()=>document.querySelector('#install-dialog').showModal();
  const $=selector=>document.querySelector(selector);
  function showUpdate(info){
    $('#update-version').textContent=`Versi saat ini: ${info.version}${info.availableVersion?' · Tersedia: '+info.availableVersion:''}`;
    $('#update-message').textContent=info.message;
    $('#auto-update').checked=info.autoDownload;
    $('#update-progress').hidden=!['downloading','verifying','ready'].includes(info.status);$('#update-progress').value=info.progress||0;
    const busy=['checking','downloading','verifying'].includes(info.status);
    $('#check-update').disabled=busy||info.status==='ready';
    $('#download-update').hidden=info.status!=='available';
    $('#apply-update').hidden=info.status!=='ready';
    $('#update-notes').textContent=info.notes||'';
    $('#update-error').textContent=info.installError||'';
    $('#update-app').textContent=info.status==='ready'?'Update siap':info.status==='downloading'?`Update ${info.progress||0}%`:'Update';
  }
  async function updateAction(action){try{const info=await action();if(info&&typeof info==='object')showUpdate(info);}catch(error){$('#update-error').textContent=error.message;}}
  bridge.onUpdate?.(showUpdate);
  if($('#update-app'))$('#update-app').onclick=()=>{$('#update-dialog').showModal();updateAction(()=>bridge.updateState());};
  if($('#check-update'))$('#check-update').onclick=()=>updateAction(()=>bridge.updateCheck());
  if($('#download-update'))$('#download-update').onclick=()=>updateAction(()=>bridge.updateDownload());
  if($('#auto-update'))$('#auto-update').onchange=()=>updateAction(()=>bridge.updateAuto($('#auto-update').checked));
  if($('#apply-update'))$('#apply-update').onclick=async()=>{const button=$('#apply-update');button.disabled=true;await updateAction(()=>bridge.updateInstall());button.disabled=false;};
  if(bridge.updateState)updateAction(()=>bridge.updateState());
  // Native save dialog + awaited bounded writes preserve the existing streaming ZIP pipeline.
  window.showSaveFilePicker=async options=>{
    const id=await bridge.pick(options?.suggestedName || 'ditasha_assets.zip');
    if (!id) throw new DOMException('Penyimpanan dibatalkan.','AbortError');
    let opened=false;
    return {createWritable:async()=>{
      if(opened) throw new Error('Sesi ekspor sudah dibuka.'); opened=true;
      let ended=false;
      return {
        write:async data=>{
          if(ended)throw new Error('Sesi ekspor sudah ditutup.');
          const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
          for(let offset=0;offset<bytes.length;offset+=256*1024) await bridge.write(id,bytes.slice(offset,offset+256*1024));
        },
        close:async()=>{if(ended)return;try{await bridge.close(id);}finally{ended=true;}},
        abort:async()=>{if(ended)return;ended=true;await bridge.abort(id);}
      };
    }};
  };
  window.addEventListener('beforeunload', event=>{
    if (state.files.length || state.busy) { event.preventDefault(); event.returnValue=''; }
  });
})();
