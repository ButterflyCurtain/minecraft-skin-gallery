# Skin Gallery

Minecraft スキンを眺めて整理するための、静かなデスクトップ／ブラウザビューア。
3D 表示は [skinview3d](https://github.com/bs-community/skinview3d)。

## できること

- スキンの 3D 表示（各種モーション・外装レイヤー・自動回転・背景）
- カメラ操作に体が遅れてついてくる慣性（接地／空中モード）
- 部位をつかんで動かすポーズ操作
- お気に入り・フォルダで整理（設定はファイルに持ち出し可）

## 使う

ブラウザ：スキンの PNG を置いて `python gen.py` → `index.html` を開く。

アプリ（Electron）：
```
npm install
npm start
```

配布版は [Releases](../../releases) から。`SkinGallery-*-portable.exe` をスキン用フォルダに置いて起動、
または `*-setup.exe` でインストール（スキンフォルダはアプリ内の「変更」で指定）。

## メモ

- `python gen.py` がスキンを走査して `skins-data.js` を生成（アプリ版は不要）。
- ランチャー連携・プロフィールへのアップロードなど一部はアプリ版のみ。設定や依存は
  [DEPENDENCIES.md](DEPENDENCIES.md) を参照。

## ライセンス

[MIT](LICENSE)
