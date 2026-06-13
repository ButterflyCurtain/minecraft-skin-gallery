# Skin Gallery

Minecraft スキンの 3D ビューア兼ライブラリ。ダーク基調のミニマルUIで、スキンの閲覧・整理・
ランチャー連携・プロフィールへのアップロードまで行える。`skinview3d` で描画。

## できること

- **3Dビューア** — 歩く/走る/待機/手振り/飛行/静止。外装レイヤー切替・自動回転・背景変更。
- **慣性** — WASD/ホイールでのカメラ操作やマウスドラッグに応じ、頭・体・腕・脚が遅れて追従し
  揺り戻す。ドラッグが激しいほど大きく振れる（非線形）。
- **視線追従** — レンダリング領域のマウス位置へ頭が自然に向く。
- **整理** — お気に入り★、フォルダ分け。スキン行をドラッグしてフォルダへ移動／スキン同士を
  重ねてフォルダ化。キーボード操作・検索・お気に入り絞り込み対応。
- **監査** — 破損チェックと全件読込テスト。`skins.json` は md5 キーの台帳（削除後も記録保持）。
- **ポータブルな設定** — ★とフォルダ分けを `skin-gallery-userdata.json` に書き出し／読み込み。
  HTML を差し替えても引き継げる。

## 2つの動かし方

### A. ブラウザ（サーバ不要・ダブルクリック）
1. このフォルダに 64×64 / 64×32 のスキン PNG を置く。
2. `python gen.py` を実行 → `skins-data.js`（base64 データURI同梱）と `skins.json` を生成。
3. `index.html` をダブルクリック。
   - `python gen.py --pull`（既定7日 / `--pull=14` で日数指定）で、親=ダウンロードフォルダの
     直近スキンPNGを取り込んでから生成できる。

### B. Electron アプリ（自動化あり）
```
npm install
npm start
```
アプリ版は **gen.py 不要**でフォルダをライブ走査し、さらに:
- ダウンロードフォルダを監視し、新着スキンを自動取り込み（`⟳ 取り込み` で手動も可）。
- ★・フォルダ分けを `skin-gallery-userdata.json` に**自動保存**。
- **`⊕` ランチャー追加** — `launcher_custom_skins.json` に追記し、Minecraft ランチャーの
  「保存済みスキン」に登録（認証不要・書き込み前に自動バックアップ）。
- **`☁` アップロード** — Microsoft ログインして Minecraft プロフィールへ直接適用（下記の設定が必要）。

## MS アップロードの設定（任意・`☁` を使う場合）

公開クライアントIDは同梱していない（規約・悪用防止のため各自登録が安全）。

1. portal.azure.com → アプリの登録 → 新規登録（対応アカウント=「個人の Microsoft アカウント」）
2. 認証 → 「パブリック クライアント フローを許可する」= はい
3. 取得したクライアントIDを次のいずれかに設定:
   - 環境変数 `MS_CLIENT_ID`
   - `electron/auth-config.json` に `{ "clientId": "..." }`

トークンは `electron/auth-tokens.json` にローカル保存され使い回される（どちらも `.gitignore` 済み）。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | UI・3Dビューア・整理・慣性（単一ファイル） |
| `gen.py` | PNG走査 → `skins-data.js`/`skins.json` 生成（ブラウザ用）。`--pull` で取り込み |
| `electron/main.js` | Electron メイン。ライブ走査・監視・IPC |
| `electron/skins.js` | フォルダ走査（gen.py の JS 版） |
| `electron/launcher.js` | `launcher_custom_skins.json` への追記 |
| `electron/auth.js` | MS デバイスコード認証 → スキンアップロード（任意） |
| `skinview3d.bundle.js` | 3D描画ライブラリ（ベンダ） |

スキンPNG・生成データ（`*.png` / `skins-data.js` / `skins.json`）は `.gitignore` 済み。
