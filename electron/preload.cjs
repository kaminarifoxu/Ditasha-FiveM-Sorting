const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('ditashaDesktop', {
  pick: name=>ipcRenderer.invoke('export:pick',name),
  write: (id,chunk)=>ipcRenderer.invoke('export:write',id,chunk),
  close: id=>ipcRenderer.invoke('export:close',id),
  abort: id=>ipcRenderer.invoke('export:abort',id),
  updateState:()=>ipcRenderer.invoke('update:state'),
  updateCheck:()=>ipcRenderer.invoke('update:check'),
  updateDownload:()=>ipcRenderer.invoke('update:download'),
  updateAuto:enabled=>ipcRenderer.invoke('update:auto',enabled),
  updateInstall:()=>ipcRenderer.invoke('update:install'),
  onUpdate:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('update:changed',listener);return ()=>ipcRenderer.removeListener('update:changed',listener);}
});
