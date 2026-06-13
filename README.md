# Skin Gallery

Minecraft スキンの 3D ビューア兼ライブラリ。ダーク基調のミニマルUIで、閲覧・整理・
ランチャー連携・プロフィールへのアップロードまで。描画は `skinview3d`。

## 主な機能

- **3Dビューア** — 各種アニメ・外装レイヤー・自動回転・背景変更
- **慣性＆視線追従** — カメラ操作やドラッグに頭/体/腕/脚が遅れて追従（激しいほど大きく揺れる）
- **整理** — お気に入り★・フォルダ分け。行をドラッグで移動／重ねてフォルダ化。検索・キー操作対応
- **設定の持ち出し** — ★とフォルダ分けを `skin-gallery-userdata.json` に書き出し/読み込み

## 使い方

**ブラウザ（サーバ不要）** — フォルダにスキンPNGを置き、`python gen.py` → `index.html` を開く。
`python gen.py --pull` で親=ダウンロードフォルダの直近スキンを取り込み。

**アプリ（Electron）**
```
npm install
npm start
```
gen.py 不要でライブ走査。ダウンロード監視で自動取り込み、設定の自動保存、
ランチャーの保存済みスキンへの追加（`⊕`・認証不要）、プロフィールへの直接アップロード（`☁`）。

**配布版** — [Releases](../../releases) の `SkinGallery-*-portable.exe` をスキン用フォルダに置いて起動、
または `*-setup.exe` でインストール。`v*` タグ push で CI が自動ビルド（`.github/workflows/release.yml`）。

## `☁` アップロードの設定（任意）

Azure でパブリッククライアントを登録（個人MSアカウント対応・「パブリッククライアントフローを許可」=はい）し、
取得したIDを `MS_CLIENT_ID` 環境変数か `electron/auth-config.json` の `{ "clientId": "..." }` に設定。
詳細は `electron/auth.js` 冒頭。トークンは `electron/auth-tokens.json` にローカル保存（`.gitignore` 済み）。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | UI・3Dビューア・整理・慣性 |
| `gen.py` | PNG走査 → `skins-data.js`/`skins.json` 生成（`--pull` で取り込み） |
| `electron/main.js` | Electronメイン。走査・監視・IPC |
| `electron/skins.js` | フォルダ走査（gen.py の JS 版） |
| `electron/launcher.js` | `launcher_custom_skins.json` への追記 |
| `electron/auth.js` | MS認証 → スキンアップロード（任意） |

スキンPNG・生成物（`*.png` / `skins-data.js` / `skins.json`）は `.gitignore` 済み。
