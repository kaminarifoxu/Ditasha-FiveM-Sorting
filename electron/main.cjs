const {app,BrowserWindow,Menu,dialog,ipcMain,net,protocol,session,shell} = require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {ExportStore}=require('./export-store.cjs');
const {ORIGIN,isAppURL,resolveAsset,trustedEvent,externalURL}=require('./trust.cjs');
const {createPortableUpdater}=require('./updater.cjs');
const {startReplacement}=require('./installer.cjs');
const {completeUpdateStartup}=require('./update-startup.cjs');
const fs=require('node:fs/promises');
const store=new ExportStore(); let win, picking=false, closing=false,allowQuit=false,installing=false;
protocol.registerSchemesAsPrivileged([{scheme:'ditasha',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const locked=app.requestSingleInstanceLock();
if(!locked) app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(async()=>{
    app.setAppUserModelId('com.ditasha.assetsorter');
    const root=path.join(__dirname,'..','ui');
    protocol.handle('ditasha',async request=>{
      const filename=resolveAsset(request.url,root);
      if(request.method!=='GET'||!filename)return new Response('Not found',{status:404});
      try {
        const response=await net.fetch(pathToFileURL(filename).href);
        const headers=new Headers(response.headers);
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'");
        return new Response(response.body,{status:response.status,headers});
      }catch{return new Response('Not found',{status:404});}
    });
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    const guard=event=>{if(closing||!trustedEvent(event,win))throw new Error('Permintaan tidak diizinkan.');};
    const updateDirectory=path.join(app.getPath('userData'),'updates');
    const updater=createPortableUpdater({version:app.getVersion(),directory:updateDirectory,fetcher:(...args)=>net.fetch(...args),onState:state=>{if(win&&!win.isDestroyed())win.webContents.send('update:changed',state);}});
    ipcMain.handle('update:state',async event=>{guard(event);const state=updater.getState();try{const report=JSON.parse((await fs.readFile(path.join(updateDirectory,'install.json'),'utf8')).replace(/^\uFEFF/,''));if(report.status==='error')state.installError=report.message;}catch{}return state;});
    ipcMain.handle('update:check',event=>{guard(event);return updater.check();});
    ipcMain.handle('update:download',event=>{guard(event);return updater.download();});
    ipcMain.handle('update:auto',(event,enabled)=>{guard(event);return updater.setAutoDownload(enabled);});
    ipcMain.handle('update:install',async event=>{
      guard(event);
      if(installing)throw Error('Update sedang dipasang.');
      const target=process.env.PORTABLE_EXECUTABLE_FILE,staged=updater.getReadyPath();
      if(process.platform!=='win32'||!target)throw Error('Gunakan EXE portable Windows untuk memasang update.');
      if(!staged)throw Error('Unduh update terlebih dahulu.');
      const workspace=await win.webContents.executeJavaScript('({busy:state.busy,files:state.files.length})');
      if(workspace.busy||store.sessions.size||picking)throw Error('Selesaikan impor atau ekspor sebelum memasang update.');
      if(workspace.files){const choice=dialog.showMessageBoxSync(win,{type:'question',title:'Pasang update?',message:'Sesi impor tidak akan tersimpan setelah mulai ulang.',detail:'Ekspor hasil terlebih dahulu, atau lanjutkan jika file impor bisa dibuka kembali.',buttons:['Kembali','Pasang & mulai ulang'],defaultId:0,cancelId:0});if(choice!==1)return false;}
      installing=true;
      await win.webContents.executeJavaScript('state.busy=true;render()');
      try{await startReplacement({target,staged,parentPid:process.pid,bootloaderPid:process.ppid,directory:updateDirectory,expectedVersion:updater.getState().availableVersion});allowQuit=true;setTimeout(()=>app.quit(),150);return true;}
      catch(error){installing=false;await win.webContents.executeJavaScript('state.busy=false;render()');throw error;}
    });
    ipcMain.handle('export:pick',async(event,name)=>{
      guard(event);
      if(picking||store.sessions.size)throw new Error('Ekspor lain masih berjalan.');
      if(typeof name!=='string'||!/^[a-z][a-z0-9_]{0,39}\.zip$/.test(name))throw new Error('Nama resource tidak valid.');
      picking=true;
      try {
        const result=await dialog.showSaveDialog(win,{title:'Simpan resource FiveM',defaultPath:path.join(app.getPath('downloads'),name),filters:[{name:'ZIP resource FiveM',extensions:['zip']}],properties:['showOverwriteConfirmation','createDirectory']});
        if(result.canceled||!result.filePath)return null;
        guard(event); return await store.open(result.filePath);
      }finally{picking=false;}
    });
    ipcMain.handle('export:write',async(event,id,data)=>{guard(event);await store.write(id,data);});
    ipcMain.handle('export:close',async(event,id)=>{guard(event);await store.commit(id);});
    ipcMain.handle('export:abort',async(event,id)=>{guard(event);await store.abort(id);});
    win=new BrowserWindow({width:1450,height:940,minWidth:800,minHeight:600,title:'DITASHA Asset Sorter',backgroundColor:'#101115',icon:path.join(__dirname,'..','assets','icon.ico'),show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
    Menu.setApplicationMenu(null);
    win.webContents.setWindowOpenHandler(({url})=>{if(externalURL(url))shell.openExternal(url).catch(()=>{});return {action:'deny'};});
    win.webContents.on('will-navigate',(event,url)=>{if(!isAppURL(url)){event.preventDefault();if(externalURL(url))shell.openExternal(url).catch(()=>{});}});
    win.webContents.on('will-prevent-unload',event=>{
      if(allowQuit){event.preventDefault();return;}
      const response=dialog.showMessageBoxSync(win,{type:'question',title:'Tutup DITASHA?',message:'Sesi impor belum tersimpan. Tutup aplikasi?',detail:'Ekspor hasil sebelum menutup. Ekspor yang sedang berjalan akan dibatalkan dan file asli tetap utuh.',buttons:['Kembali','Tutup aplikasi'],defaultId:0,cancelId:0});
      if(response===1)event.preventDefault();
    });
    win.on('close',event=>{
      if(store.sessions.size&&!closing){
        event.preventDefault();
        const response=dialog.showMessageBoxSync(win,{type:'question',title:'Batalkan ekspor?',message:'Ekspor resource sedang berjalan. Batalkan dan tutup aplikasi?',buttons:['Lanjutkan ekspor','Batalkan dan tutup'],defaultId:0,cancelId:0});
        if(response===1){closing=true;store.cleanup().finally(()=>win?.destroy());}
      }
    });
    win.on('closed',()=>{win=null;store.cleanup().catch(()=>{});});
    win.once('ready-to-show',()=>win.show());
    await win.loadURL(ORIGIN+'/');
    await completeUpdateStartup({target:process.env.PORTABLE_EXECUTABLE_FILE,version:app.getVersion()});
    setTimeout(()=>updater.check(),2500).unref();
    setInterval(()=>updater.check(),30*60*1000).unref();
  }).catch(error=>{dialog.showErrorBox('DITASHA tidak dapat dibuka',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
}
