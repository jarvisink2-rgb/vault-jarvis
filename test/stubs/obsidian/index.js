class FileSystemAdapter { constructor(p){this.p=p} getBasePath(){return this.p} }
class Plugin { constructor(app){this.app=app;this._d=null} async loadData(){return this._d} async saveData(d){this._d=JSON.parse(JSON.stringify(d))}
  registerView(){} addRibbonIcon(){} addCommand(c){(this.cmds=this.cmds||[]).push(c.id)} addSettingTab(){} }
class ItemView{} class PluginSettingTab{}
class Setting{}
const notices=[]; class Notice{constructor(m){notices.push(m);console.log('[Notice]',m)}}
async function requestUrl({url,method='GET'}){ const r=await fetch(url,{method}); return {status:r.status,text:await r.text()}; }
module.exports={Plugin,ItemView,PluginSettingTab,Setting,Notice,requestUrl,FileSystemAdapter,Platform:{isDesktopApp:true},notices};
