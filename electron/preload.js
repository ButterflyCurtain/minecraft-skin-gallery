'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// userdata はページのスクリプトより前に同期で読んでおく（種付けの順序を保つため）
let userdata = null;
try { userdata = ipcRenderer.sendSync('userdata:get-sync'); } catch (_) {}

contextBridge.exposeInMainWorld('electronAPI', {
  userdata,
  getSkins: () => ipcRenderer.invoke('skins:get'),
  saveUserData: ud => ipcRenderer.invoke('userdata:save', ud),
  pullDownloads: days => ipcRenderer.invoke('downloads:pull', days),
  launcherAdd: skins => ipcRenderer.invoke('launcher:add', skins),
  launcherInfo: () => ipcRenderer.invoke('launcher:info'),
  uploadSkin: payload => ipcRenderer.invoke('skin:upload', payload),
  authAvailable: () => ipcRenderer.invoke('auth:available'),
  openExternal: url => ipcRenderer.invoke('open:external', url),
  openSkinDir: () => ipcRenderer.invoke('dir:open'),
  currentSkinDir: () => ipcRenderer.invoke('dir:current'),
  chooseSkinDir: () => ipcRenderer.invoke('dir:choose'),
  setAdblock: on => ipcRenderer.invoke('adblock:set', on),
  onDownloadsChanged: cb => ipcRenderer.on('downloads:changed', (_e, d) => cb(d)),
  onAuthPrompt: cb => ipcRenderer.on('auth:prompt', (_e, p) => cb(p)),
});
