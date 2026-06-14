# 依存関係（Dependencies）

このプロジェクトが何に依存しているかの一覧と理由。バージョンは `package.json` / `package-lock.json` が正。

## 1. 同梱（ベンダ）— npm 管理外

| 依存 | 用途 | 形態 |
|---|---|---|
| **skinview3d**（`skinview3d.bundle.js`） | Minecraft スキンの 3D 描画（プレイヤーモデル・アニメ・OrbitControls）。内部に **three.js** をバンドル。 | 単一JSをリポジトリに同梱。`<script>` で読み込み。npm 取得していない。 |

> three.js は skinview3d バンドル内に含まれるため別途インストール不要。慣性/ポーズ実装は `viewer.camera` 等のインスタンスメソッドのみ使い、THREE グローバルには依存しない。

## 2. ブラウザ版（サーバ不要・`index.html` 直開き）

- **追加依存なし。** 必要なのは上記 `skinview3d.bundle.js` と、`gen.py` が生成する `skins-data.js`（base64 同梱スキン）だけ。
- 利用するブラウザ標準API: WebGL / Canvas2D / IntersectionObserver / localStorage / FileReader / Blob・URL / Pointer Events。

## 3. スキン生成スクリプト `gen.py`

- **Python 3**（3.8+ 目安）。**外部パッケージなし**＝標準ライブラリのみ：
  `glob, os, sys, time, shutil, hashlib, struct, base64, json, datetime`。
- `pip install` 不要。

## 4. Electron アプリ（`npm install` で取得）

`package.json` の `devDependencies`：

| パッケージ | バージョン | 用途 |
|---|---|---|
| **electron** | `^31.x` | デスクトップ実行環境。ライブ走査・Downloads監視・設定の自動保存・ランチャー連携・MS認証・namemc webview を提供。 |
| **electron-builder** | `^24.x` | Windows 配布物（portable / NSIS インストーラ）のビルド。`npm run dist`。 |

Electron 同梱の Chromium バイナリは `electron` の postinstall でDLされる（ローカルで失敗する場合は配布は CI ビルドを利用）。

### Electron / Node の組み込みモジュール（インストール不要）
- Electron: `app, BrowserWindow, ipcMain, shell, session`（＋ `<webview>` タグ）
- Node 標準: `fs, path, os, crypto`

## 5. 外部サービス（コード依存ではなく実行時の通信先）

| 宛先 | いつ使うか | 必須か |
|---|---|---|
| `login.microsoftonline.com`（MS OAuth デバイスコード） | `☁` アップロードのログイン | 任意機能 |
| `user.auth.xboxlive.com` / `xsts.auth.xboxlive.com` | Xbox/XSTS 認証チェーン | 任意機能 |
| `api.minecraftservices.com` | Minecraft プロフィールへのスキン適用 | 任意機能 |
| `ja.namemc.com`（webview） | namemc スキンブラウザ | 任意機能 |
| `www.minecraft.net/profile`（`↗`） | 手動アップロード用に開く | 任意機能 |

> `☁` には **Azure のパブリッククライアントID** が別途必要（同梱しない）。設定は `electron/auth.js` 冒頭参照。

## 6. CI（GitHub Actions・`.github/workflows/release.yml`）

| Action | 用途 |
|---|---|
| `actions/checkout@v4` | チェックアウト |
| `actions/setup-node@v4` | Node セットアップ＋npmキャッシュ |
| `actions/upload-artifact@v4` | ビルド成果物のアップロード |
| `softprops/action-gh-release@v2` | `v*` タグ時に Release へ exe を添付 |

ランナーは `windows-latest`。`npm ci` → `electron-builder --win` でビルド。

## 7. 連携先のローカルファイル（依存“先”）

- `%APPDATA%\.minecraft\launcher_custom_skins.json` … `⊕` ランチャー追加が追記（書込前に `.bak` バックアップ）。
- 親フォルダ（ダウンロード想定）… `--pull` / 監視での取り込み元。

---
更新時は `package.json` を変更し `npm install` で `package-lock.json` を同期すること。
