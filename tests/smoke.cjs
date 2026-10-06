const {app,BrowserWindow,dialog}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ditasha-smoke-'));
app.setPath('userData',path.join(root,'profile'));
// Test runtime forbids the POSIX singleton socket; production lock stays intact.
app.requestSingleInstanceLock=()=>true;
app.commandLine.appendSwitch('use-angle','swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const output=path.join(root,'export.zip');
dialog.showSaveDialog=async()=>({canceled:false,filePath:output});
const errors=[];
app.on('web-contents-created',(_event,contents)=>{contents.on('console-message',(_e,...args)=>{const details=typeof args[0]==='object'?args[0]:{level:args[0],message:args[1]};if(details.level===3||details.level==='error')errors.push(details.message);});contents.on('render-process-gone',(_e,details)=>errors.push('Renderer gone: '+details.reason));});
require('../electron/main.cjs');
async function run(){
 let win;for(let i=0;i<300;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading())break;await new Promise(r=>setTimeout(r,100));}
 if(!win)throw new Error('Window not created');
 const status=await win.webContents.executeJavaScript(`({title:document.title,bridge:!!window.ditashaDesktop,picker:typeof window.showSaveFilePicker,secure:window.isSecureContext,errors:document.querySelector('#toast').textContent})`);
 console.log('Window:',JSON.stringify(status));
 if(!status.bridge||status.picker!=='function'||!status.secure)throw new Error('Desktop bridge/context missing');
 const model=fs.readFileSync(path.join(__dirname,'fixtures/feet_006_u.ydd')).toString('base64');
 const second=fs.readFileSync(path.join(__dirname,'fixtures/jbib_000_u.ydd')).toString('base64');
 const result=await win.webContents.executeJavaScript(`(async()=>{const model=Uint8Array.from(atob(${JSON.stringify(model)}),c=>c.charCodeAt(0));const second=Uint8Array.from(atob(${JSON.stringify(second)}),c=>c.charCodeAt(0));await importFiles([new File([model],'feet_006_u.ydd'),new File([second],'jbib_000_u.ydd')]);document.querySelector('#mode').value='addon';render();const handle=await window.showSaveFilePicker({suggestedName:'native_test.zip'}),sink=await handle.createWritable();await LargeIO.writeResource(buildPlan(),new WritableStream({write:c=>sink.write(c),close:()=>sink.close(),abort:()=>sink.abort()}));await openModelPreview(state.files[0].id);for(let i=0;i<100;i++){if(document.querySelector('#model-stats').textContent)break;await new Promise(r=>setTimeout(r,100));}const box=document.querySelector('[data-select-model=\"'+state.files[1].id+'\"]');box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));await document.querySelector('#load-models').onclick();document.querySelector('#model-layout-choice').value='row';document.querySelector('#model-layout-choice').dispatchEvent(new Event('change'));return{files:state.files.length,stats:document.querySelector('#model-stats').textContent,model:document.querySelector('#model-status').textContent,canvas:!!document.querySelector('#model-canvas'),issues:buildPlan().issues};})()`);
 console.log('Import/export/preview:',JSON.stringify(result));
 if(!fs.existsSync(output)||fs.readFileSync(output).subarray(0,2).toString()!=='PK')throw new Error('Native ZIP export failed');
 console.log('ZIP bytes:',fs.statSync(output).size,'Console errors:',JSON.stringify(errors));
 if(!result.stats?.startsWith('2 YDD'))throw new Error('Model preview did not load');
 win.destroy();console.log('PASS desktop runtime smoke');app.exit(0);
}
app.whenReady().then(run).catch(error=>{console.error(error);app.exit(1)});
setTimeout(()=>{console.error('Runtime smoke timed out');app.exit(1)},45000);
