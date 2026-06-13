// フォルダの *.png をライブで走査し、ビューア用データ＋台帳を返す（gen.py のJS版）。
// データURIで返すので canvas 汚染なし。Electronのmainから使うほか、node単体でもテスト可:
//   node electron/skins.js <dir>
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_DIMS = [[64, 64], [64, 32]];

function inspect(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG))
    return { valid: false, reason: 'PNG署名が不正（PNGではない / 破損）', w: null, h: null };
  if (buf.length < 24) return { valid: false, reason: 'ファイルが短すぎる', w: null, h: null };
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (buf.subarray(-16).indexOf(Buffer.from('IEND')) === -1)
    return { valid: false, reason: 'IENDが無い（途中で切れている）', w, h };
  if (!VALID_DIMS.some(d => d[0] === w && d[1] === h))
    return { valid: false, reason: `スキン規格外の寸法 ${w}x${h}`, w, h };
  return { valid: true, reason: '', w, h };
}

// 既存の skins.json（台帳）があれば firstSeen 等を引き継ぐ
function loadRegistry(dir) {
  const p = path.join(dir, 'skins.json');
  const reg = {};
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf-8'));
    for (const r of arr) if (r && r.md5) reg[r.md5] = r;
  } catch (_) {}
  return reg;
}

function scanSkins(dir) {
  const today = new Date().toISOString().slice(0, 10);
  const registry = loadRegistry(dir);
  const present = new Set();
  const skins = [];

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png')).sort();
  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(path.join(dir, f)); } catch (_) { continue; }
    const md5 = crypto.createHash('md5').update(raw).digest('hex');
    const ins = inspect(raw);
    present.add(md5);

    const rec = registry[md5] || { md5, firstSeen: today, files: [] };
    Object.assign(rec, {
      size: raw.length, w: ins.w, h: ins.h, valid: ins.valid,
      reason: ins.reason, present: true, lastSeen: today, file: f,
    });
    if (!rec.firstSeen) rec.firstSeen = today;
    if (!rec.files) rec.files = [];
    if (!rec.files.includes(f)) rec.files.push(f);
    registry[md5] = rec;

    if (ins.valid) {
      skins.push({
        md5, file: f, size: raw.length, w: ins.w, h: ins.h,
        data: 'data:image/png;base64,' + raw.toString('base64'),
      });
    }
  }

  for (const md5 of Object.keys(registry))
    if (!present.has(md5)) registry[md5].present = false;

  const regList = Object.values(registry).sort((a, b) =>
    (a.present === false) - (b.present === false) ||
    String(a.file || '').toLowerCase().localeCompare(String(b.file || '').toLowerCase()));

  // 台帳を書き戻す（gen.py と同じ skins.json を維持）
  try { fs.writeFileSync(path.join(dir, 'skins.json'), JSON.stringify(regList, null, 2)); } catch (_) {}

  const audit = regList.map(r => {
    const o = {};
    for (const k of ['md5', 'file', 'size', 'w', 'h', 'valid', 'reason', 'present', 'firstSeen', 'lastSeen', 'files'])
      o[k] = r[k];
    return o;
  });
  return { skins, registry: audit };
}

module.exports = { scanSkins, inspect };

// CLI テスト
if (require.main === module) {
  const dir = process.argv[2] || '.';
  const { skins, registry } = scanSkins(path.resolve(dir));
  const ok = registry.filter(r => r.present !== false && r.valid !== false).length;
  const bad = registry.filter(r => r.present !== false && r.valid === false).length;
  const gone = registry.filter(r => r.present === false).length;
  console.log(`正常 ${ok} / 破損 ${bad} / 欠落 ${gone} ・ ビューア表示 ${skins.length} 件`);
}
