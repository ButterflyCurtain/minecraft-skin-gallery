'use strict';
const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scanSkins, inspect } = require('./skins');
const launcher = require('./launcher');
const auth = require('./auth');

// スキンを探すフォルダ。開発時はプロジェクト直下、パッケージ後はexeを置いたフォルダ
// （ポータブルexeをスキン用フォルダに置いて起動する想定）。
const APP_DIR = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..');
const DOWNLOADS_DIR = path.dirname(APP_DIR);          // 親フォルダ = ダウンロード想定
const USERDATA = path.join(APP_DIR, 'skin-gallery-userdata.json');

// TODO(4): README/LICENSE 整備（公開準備）。

// ---- namemc 埋め込み(<webview partition="persist:namemc">)用セッション：広告ブロック＋DLをスキンdirへ ----
let adblockOn = false;   // 既定OFF（iframe先への配慮）。UIのトグルで切替。
const AD_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'adservice.google.com', 'partner.googleadservices.com', 'fundingchoicesmessages.google.com',
  'amazon-adsystem.com', 'adnxs.com', 'pubmatic.com', 'rubiconproject.com', 'criteo.com',
  'taboola.com', 'outbrain.com', 'scorecardresearch.com', 'moatads.com', 'media.net',
  'ezoic.net', 'ezojs.com', 'adsrvr.org', 'casalemedia.com', 'openx.net', 'smartadserver.com',
];
function setupNamemcSession() {
  const ses = session.fromPartition('persist:namemc');
  ses.webRequest.onBeforeRequest((details, cb) => {
    if (adblockOn) {
      try {
        const h = new URL(details.url).hostname;
        if (AD_HOSTS.some(d => h === d || h.endsWith('.' + d))) return cb({ cancel: true });
      } catch (_) {}
    }
    cb({});
  });
  // namemc でスキンをDL → APP_DIR(スキンフォルダ)へ保存して一覧更新
  ses.on('will-download', (_e, item) => {
    const name = item.getFilename() || 'skin.png';
    if (!/\.png$/i.test(name)) return;                 // スキン(PNG)だけ取り込む
    let dst = path.join(APP_DIR, name);
    if (fs.existsSync(dst)) dst = path.join(APP_DIR, Date.now().toString(36) + '_' + name);
    item.setSavePath(dst);
    item.once('done', (_ev, state) => {
      if (state === 'completed' && win && !win.isDestroyed())
        win.webContents.send('downloads:changed', { added: 1, file: path.basename(dst) });
    });
  });
}
ipcMain.handle('adblock:set', (_e, on) => { adblockOn = !!on; return adblockOn; });

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, backgroundColor: '#0d0d0f',
    title: 'Skin Gallery',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'index.html'));  // バンドル側のUI（パッケージ後はasar内）
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

app.whenReady().then(() => { setupNamemcSession(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
