// Minecraftランチャーの「保存済みスキン」ライブラリ(launcher_custom_skins.json)へ
// 認証なしでスキンを追記する。アカウントへの適用はランチャー側で1クリック（または auth.js のAPI）。
//
// 形式（実機で確認済み）:
//   customSkins[id] = { id, name, slim, created, updated,
//                       skinImage:dataURI(64x64), modelImage:dataURI(プレビュー), textureId:sha256(skinPNG) }
//
// 書き込み前に必ずタイムスタンプ付きバックアップを作る。textureId 重複はスキップ。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function minecraftDir() {
  if (process.platform === 'win32')
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft');
  return path.join(os.homedir(), '.minecraft');
}
function libraryPath() { return path.join(minecraftDir(), 'launcher_custom_skins.json'); }

function readLibrary() {
  const p = libraryPath();
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch (_) { return { customSkins: {}, version: 1 }; }
}

function dataUriToBuf(dataUri) {
  const i = String(dataUri).indexOf(',');
  return Buffer.from(i >= 0 ? dataUri.slice(i + 1) : dataUri, 'base64');
}
function pngDims(buf) {
  try { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
  catch (_) { return null; }
}

// skins: [{ name, skinImage(dataURI), slim(bool), modelImage?(dataURI) }]
function addSkins(skins) {
  const p = libraryPath();
  if (!fs.existsSync(path.dirname(p)))
    return { ok: false, error: '.minecraft が見つかりません（ランチャー未インストール？）', added: 0 };

  const lib = readLibrary();
  if (!lib.customSkins || typeof lib.customSkins !== 'object') lib.customSkins = {};

  // バックアップ（既存ファイルがある時だけ）
  if (fs.existsSync(p)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try { fs.copyFileSync(p, p + '.' + stamp + '.bak'); } catch (_) {}
  }

  const existing = new Set(Object.values(lib.customSkins).map(s => s && s.textureId).filter(Boolean));
  let maxN = 0;
  for (const id of Object.keys(lib.customSkins)) {
    const m = /^skin_(\d+)$/.exec(id); if (m) maxN = Math.max(maxN, +m[1]);
  }

  const now = new Date().toISOString();
  let added = 0, skipped = 0, invalid = 0;
  for (const s of skins) {
    if (!s || !s.skinImage) continue;
    const buf = dataUriToBuf(s.skinImage);
    const textureId = crypto.createHash('sha256').update(buf).digest('hex');
    if (existing.has(textureId)) { skipped++; continue; }
    // modelImage は純正と同じ 288x384 のプレビューPNG必須。
    // 64x64等の規格外を書くと新版ランチャーが起動時にクラッシュ(0x1)するため弾く。
    const mi = s.modelImage;
    const md = mi ? pngDims(dataUriToBuf(mi)) : null;
    if (!md || md.w !== 288 || md.h !== 384) { invalid++; continue; }
    const id = 'skin_' + (++maxN);
    lib.customSkins[id] = {
      id,
      name: (s.name || id).slice(0, 32),
      slim: !!s.slim,
      created: now,
      updated: now,
      skinImage: s.skinImage,
      modelImage: mi,           // 288x384 の正規プレビュー
      textureId,
    };
    existing.add(textureId);
    added++;
  }

  if (added > 0) fs.writeFileSync(p, JSON.stringify(lib, null, 2));
  return { ok: true, added, skipped, invalid, path: p };
}

module.exports = { addSkins, readLibrary, libraryPath, minecraftDir };

// CLI: node electron/launcher.js --list
if (require.main === module) {
  if (process.argv.includes('--list')) {
    const lib = readLibrary();
    const cs = lib.customSkins || {};
    console.log('ライブラリ:', libraryPath());
    console.log('登録数:', Object.keys(cs).length);
    for (const [id, s] of Object.entries(cs))
      console.log(' ', id, '·', s.name, '·', s.slim ? 'slim' : 'classic', '·', (s.textureId || '').slice(0, 12));
  } else {
    console.log('usage: node electron/launcher.js --list');
  }
}
