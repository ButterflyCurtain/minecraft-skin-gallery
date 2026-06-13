#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
このフォルダの *.png を走査して以下を生成する。

  skins.json     ... 台帳（md5をキーにした一意管理）。
                     ファイルを消しても記録は残り present:false になる。
                     firstSeen / lastSeen / files(別名履歴) / valid / reason を保持。
  skins-data.js  ... ビューア用。正常スキンを base64 データURIで同梱（file:// でも動く）＋
                     台帳の軽量版(window.__REGISTRY__)。

使い方:  このフォルダで  python gen.py
"""
import glob, os, sys, time, shutil, hashlib, struct, base64, json, datetime

PNG_SIG = b'\x89PNG\r\n\x1a\n'
VALID_DIMS = {(64, 64), (64, 32)}

def pull_from_downloads(here, days):
    """親フォルダ(=ダウンロード)直下の、直近 days 日以内に追加されたスキン形状PNG
    (64x64/64x32) を、未取り込み(md5重複なし)のものだけこのフォルダへコピーする。"""
    downloads = os.path.dirname(here)
    if os.path.abspath(downloads) == os.path.abspath(here):
        print('親フォルダが取得できないため取り込みをスキップ'); return 0
    have = set()
    for f in glob.glob(os.path.join(here, '*.png')):
        try: have.add(hashlib.md5(open(f, 'rb').read()).hexdigest())
        except Exception: pass
    cutoff = time.time() - days * 86400
    added = 0
    for src in glob.glob(os.path.join(downloads, '*.png')):
        try:
            if os.path.getmtime(src) < cutoff:
                continue
            raw = open(src, 'rb').read()
        except Exception:
            continue
        valid, _, _, _ = inspect(raw)
        if not valid:
            continue
        md5 = hashlib.md5(raw).hexdigest()
        if md5 in have:
            continue
        name = os.path.basename(src)
        dst = os.path.join(here, name)
        if os.path.exists(dst):                       # 同名・別内容 -> md5接頭辞で衝突回避
            dst = os.path.join(here, md5[:8] + '_' + name)
        shutil.copy2(src, dst)
        have.add(md5); added += 1
        print('  + 取り込み:', os.path.basename(dst))
    print(f'ダウンロードから {added} 件取り込み（直近{days}日・スキン形状のみ）')
    return added

def inspect(data):
    """PNGの破損チェック。 (valid, reason, w, h)"""
    if data[:8] != PNG_SIG:
        return False, 'PNG署名が不正（PNGではない / 破損）', None, None
    if len(data) < 24:
        return False, 'ファイルが短すぎる', None, None
    w, h = struct.unpack('>II', data[16:24])
    if b'IEND' not in data[-16:]:
        return False, 'IENDが無い（途中で切れている）', w, h
    if (w, h) not in VALID_DIMS:
        return False, f'スキン規格外の寸法 {w}x{h}', w, h
    return True, '', w, h

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(here)
    today = datetime.date.today().isoformat()

    # --pull[=DAYS]  : 親フォルダ(ダウンロード)の直近スキンPNGを取り込んでから生成（既定7日）
    for arg in sys.argv[1:]:
        if arg == '--pull' or arg.startswith('--pull='):
            days = 7
            if '=' in arg:
                try: days = max(1, int(arg.split('=', 1)[1]))
                except ValueError: pass
            pull_from_downloads(here, days)

    # 既存台帳を読み込み（md5 -> record）
    registry = {}
    if os.path.exists('skins.json'):
        try:
            for r in json.load(open('skins.json', encoding='utf-8')):
                if isinstance(r, dict) and r.get('md5'):
                    registry[r['md5']] = r
        except Exception:
            pass

    present = set()
    data_entries = []  # ビューアに渡す（正常スキンのみ・データURI付き）

    for f in sorted(glob.glob('*.png')):
        raw = open(f, 'rb').read()
        md5 = hashlib.md5(raw).hexdigest()
        valid, reason, w, h = inspect(raw)
        present.add(md5)

        rec = registry.get(md5, {'md5': md5, 'firstSeen': today, 'files': []})
        rec.update(size=len(raw), w=w, h=h, valid=valid, reason=reason,
                   present=True, lastSeen=today, file=f)
        rec.setdefault('firstSeen', today)
        rec.setdefault('files', [])
        if f not in rec['files']:
            rec['files'].append(f)
        registry[md5] = rec

        if valid:
            b64 = base64.b64encode(raw).decode('ascii')
            data_entries.append({
                'md5': md5, 'file': f, 'size': len(raw), 'w': w, 'h': h,
                'data': 'data:image/png;base64,' + b64,
            })

    # 今ディスクに無いものは欠落扱い（記録は残す）
    for md5, rec in registry.items():
        if md5 not in present:
            rec['present'] = False

    # 台帳を書き出し（存在するもの優先・名前順）
    reg_list = sorted(
        registry.values(),
        key=lambda r: (not r.get('present', False), (r.get('file') or '').lower())
    )
    json.dump(reg_list, open('skins.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    # データURIを外した監査用の軽量台帳
    audit = [{k: r.get(k) for k in
              ('md5', 'file', 'size', 'w', 'h', 'valid', 'reason',
               'present', 'firstSeen', 'lastSeen', 'files')}
             for r in reg_list]

    # ユーザーデータ（お気に入り★・フォルダ分け）を同梱して、HTML差し替え後も引き継げるようにする。
    # ビューアの「⤓ 書き出し」で作る skin-gallery-userdata.json をこのフォルダに置いておけば拾う。
    userdata = None
    if os.path.exists('skin-gallery-userdata.json'):
        try:
            userdata = json.load(open('skin-gallery-userdata.json', encoding='utf-8'))
        except Exception:
            userdata = None

    with open('skins-data.js', 'w', encoding='utf-8') as fp:
        fp.write('// 自動生成: python gen.py で再生成。手で編集しない。\n')
        fp.write('window.__SKINS__ = ' +
                 json.dumps(data_entries, ensure_ascii=False, separators=(',', ':')) + ';\n')
        fp.write('window.__REGISTRY__ = ' +
                 json.dumps(audit, ensure_ascii=False, separators=(',', ':')) + ';\n')
        if userdata is not None:
            fp.write('window.__USERDATA__ = ' +
                     json.dumps(userdata, ensure_ascii=False, separators=(',', ':')) + ';\n')

    ok = sum(1 for r in reg_list if r.get('present') and r.get('valid'))
    bad = sum(1 for r in reg_list if r.get('present') and not r.get('valid'))
    gone = sum(1 for r in reg_list if not r.get('present'))
    print(f'正常 {ok} / 破損 {bad} / 欠落 {gone}  -> skins.json, skins-data.js を更新')

if __name__ == '__main__':
    main()
