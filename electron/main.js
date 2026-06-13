'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scanSkins, inspect } = require('./skins');
const launcher = require('./launcher');
const auth = require('./auth');

const APP_DIR = path.join(__dirname, '..');          // index.html / *.png があるフォルダ
const DOWNLOADS_DIR = path.dirname(APP_DIR);          // 親フォルダ = ダウンロード想定
const USERDATA = path.join(APP_DIR, 'skin-gallery-userdata.json');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, backgroundColor: '#0d0d0f',
    title: 'Skin Gallery',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.removeMenu();
  win.loadFile(path.join(APP_DIR, 'index.html'));
  watchDownloads();
}

// ---- userdata（お気に入り・フォルダ）の読み書き ----
function readUserData() { try { return JSON.parse(fs.readFileSync(USERDATA, 'utf-8')); } catch (_) { return null; } }
ipcMain.on('userdata:get-sync', e => { e.returnValue = readUserData(); });
ipcMain.handle('userdata:save', (_e, ud) => {
  try { fs.writeFileSync(USERDATA, JSON.stringify(ud, null, 2)); return { ok: true }; }
  catch (err) { return { ok: false, error: String(err) }; }
});

// ---- スキン一覧（ライブ走査・データURI） ----
ipcMain.handle('skins:get', () => {
  const { skins, registry } = scanSkins(APP_DIR);
  return { skins, registry, userdata: readUserData() };
});

// ---- ダウンロードから取り込み（直近スキンPNGをコピー） ----
function pull(days) {
  const have = new Set();
  for (const f of fs.readdirSync(APP_DIR)) if (f.toLowerCase().endsWith('.png')) {
    try { have.add(crypto.createHash('md5').update(fs.readFileSync(path.join(APP_DIR, f))).digest('hex')); } catch (_) {}
  }
  const cutoff = Date.now() - days * 86400000;
  let added = 0;
  let list = [];
  try { list = fs.readdirSync(DOWNLOADS_DIR); } catch (_) { return 0; }
  for (const f of list) {
    if (!f.toLowerCase().endsWith('.png')) continue;
    const src = path.join(DOWNLOADS_DIR, f);
    let st, raw;
    try { st = fs.statSync(src); if (st.mtimeMs < cutoff) continue; raw = fs.readFileSync(src); } catch (_) { continue; }
    if (!inspect(raw).valid) continue;
    const md5 = crypto.createHash('md5').update(raw).digest('hex');
    if (have.has(md5)) continue;
    let dst = path.join(APP_DIR, f);
    if (fs.existsSync(dst)) dst = path.join(APP_DIR, md5.slice(0, 8) + '_' + f);
    try { fs.copyFileSync(src, dst); have.add(md5); added++; } catch (_) {}
  }
  return added;
}
ipcMain.handle('downloads:pull', (_e, days) => {
  const added = pull(days || 7);
  const { skins, registry } = scanSkins(APP_DIR);
  return { added, skins, registry };
});

// ---- ダウンロードフォルダ監視：新しいスキンが来たら取り込んで通知 ----
let watchTimer = null;
function watchDownloads() {
  try {
    fs.watch(DOWNLOADS_DIR, (_evt, fname) => {
      if (!fname || !String(fname).toLowerCase().endsWith('.png')) return;
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        const added = pull(2);                // 直近2日ぶんを拾う
        if (added > 0 && win && !win.isDestroyed()) win.webContents.send('downloads:changed', { added });
      }, 1500);
    });
  } catch (_) {}
}

// ---- ランチャーの保存済みスキンへ追加（認証不要） ----
ipcMain.handle('launcher:add', (_e, skins) => launcher.addSkins(skins || []));
ipcMain.handle('launcher:info', () => {
  const lib = launcher.readLibrary();
  return { path: launcher.libraryPath(), count: Object.keys(lib.customSkins || {}).length };
});

// ---- Minecraftプロフィールへ直接アップロード（MS認証・任意） ----
ipcMain.handle('skin:upload', async (_e, { dataUri, slim }) => {
  if (!auth.hasClientId(APP_DIR)) return { ok: false, error: 'NO_CLIENT_ID' };
  try {
    const i = String(dataUri).indexOf(',');
    const buf = Buffer.from(i >= 0 ? dataUri.slice(i + 1) : dataUri, 'base64');
    const onPrompt = p => { if (win && !win.isDestroyed()) win.webContents.send('auth:prompt', p); };
    await auth.uploadSkin(APP_DIR, buf, !!slim, onPrompt);
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('auth:available', () => auth.hasClientId(APP_DIR));
ipcMain.handle('open:external', (_e, url) => { shell.openExternal(url); });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
