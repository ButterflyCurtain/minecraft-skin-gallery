# Skin Gallery

Minecraft スキンの 3D ビューア兼ライブラリ。ダーク基調のミニマルUIで、閲覧・整理・
ランチャー連携・プロフィールへのアップロードまで。描画は `skinview3d`。

## 主な機能

- **3Dビューア** — 歩く/走る/待機/手振り/飛行/静止。外装レイヤー・自動回転・背景変更。動作切替はクロスフェードで滑らか。
- **慣性（二次モーション）** — カメラを振ると頭/体/腕/脚が遅れて追従し揺り戻す。角加速度キック・遠心力・体→四肢への伝播つき。
  - **接地 / 空中モード**（設定で切替・初期値=接地）。接地はお尻/腰を重心にしたボトムヘビーな揺れ＋足はソフト接地。空中は全身フロート。
- **視線追従** — レンダリング領域のマウスへ頭が自然に向く。待機中はごく僅かな呼吸。
- **ポーズ/インスペクト（✋）** — 部位を掴んで動かす。離すとびよん復帰／Shift離しで固定／Ctrl二度押しで全解除。
- **整理** — お気に入り★・フォルダ分け。行をドラッグで移動／重ねてフォルダ化。検索・キーボード操作対応。
- **背景の自動調整** — スキンの明暗に合わせて背景色を最適化。
- **設定の持ち出し** — ★・フォルダ・設定を `skin-gallery-userdata.json` に書き出し/読み込み（md5キーでファイル名変更にも追従）。
- **サイドバー幅** をドラッグで調整。全UIに `aria` とショートカット（tooltipにも表示）。

## 使い方

**ブラウザ（サーバ不要）** — フォルダにスキンPNGを置き、`python gen.py` → `index.html` を開く。
`python gen.py --pull`（既定7日 / `--pull=14`）で親=ダウンロードフォルダの直近スキンを取り込み。

**アプリ（Electron）**
```
npm install
npm start
```
gen.py 不要でライブ走査。ダウンロード監視で自動取り込み、設定の自動保存、
ランチャーの保存済みスキンへの追加（`⊕`・認証不要）、プロフィールへの直接アップロード（`☁`）、
**namemc ブラウザ**（`◍ namemc`・DLでこのフォルダへ自動取り込み・任意で広告ブロック）。

**配布版** — [Releases](../../releases) の `SkinGallery-*-portable.exe` をスキン用フォルダに置いて起動、
または `*-setup.exe` でインストール。`v*` タグ push で CI が自動ビルド（`.github/workflows/release.yml`）。

## 主なショートカット

| キー | 動作 |
|---|---|
| `↑` / `↓` | スキン送り（長押しは一定間隔） |
| `WASD` | カメラ回転 ／ `+` `-` ズーム |
| `Shift+S` / `Ctrl+S` | 現在のスキンをお気に入り★ |
| `,` | 設定を開く ／ `Esc` 戻る・閉じる |
| ドラッグ | 回転 ／ 右ドラッグ 移動 ／ ホイール ズーム |

## `☁` アップロードの設定（任意）

Azure でパブリッククライアントを登録（個人MSアカウント対応・「パブリッククライアントフローを許可」=はい）し、
取得したIDを `MS_CLIENT_ID` 環境変数か `electron/auth-config.json` の `{ "clientId": "..." }` に設定。
詳細は `electron/auth.js` 冒頭。トークンは `electron/auth-tokens.json` にローカル保存（`.gitignore` 済み）。

ランチャーへの追加（`⊕`）は `%APPDATA%\.minecraft\launcher_custom_skins.json` に追記する方式で認証不要
（書き込み前に自動バックアップ）。アカウントへの適用はランチャー側で選ぶか `☁` を使用。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | UI・3Dビューア・慣性・ポーズ・整理・設定（単一ファイル） |
| `gen.py` | PNG走査 → `skins-data.js`/`skins.json` 生成（`--pull` で取り込み） |
| `electron/main.js` | Electronメイン。走査・監視・IPC・namemc/広告ブロック・DL取り込み |
| `electron/skins.js` | フォルダ走査（gen.py の JS 版） |
| `electron/launcher.js` | `launcher_custom_skins.json` への追記 |
| `electron/auth.js` | MS認証 → スキンアップロード（任意） |

スキンPNG・生成物（`*.png` / `skins-data.js` / `skins.json`）・個人データ・トークンは `.gitignore` 済み。

依存関係の詳細は [DEPENDENCIES.md](DEPENDENCIES.md) を参照。

## ライセンス

[MIT](LICENSE)
