#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""版権クリーンな完全オリジナルのサンプル用 Minecraft スキン(64x64)を生成する。
スクリーンショット用の「テスト子」。標準ライブラリのみ（PIL不要）。
  使い方:  python tools/make_sample_skin.py  -> docs/sample-skin.png
"""
import os, zlib, struct

W = H = 64
# 透明で初期化（RGBA）
px = [(0, 0, 0, 0)] * (W * H)

def fill(x, y, w, h, c):
    for j in range(y, y + h):
        for i in range(x, x + w):
            if 0 <= i < W and 0 <= j < H:
                px[j * W + i] = c

# パレット（アプリのテーマに寄せたオリジナル配色）
SKIN  = (232, 214, 190, 255)
HAIR  = (74, 60, 50, 255)
SHIRT = (194, 168, 120, 255)   # サンド（アクセント）
PANTS = (52, 52, 60, 255)
SHOE  = (32, 32, 38, 255)
EYE   = (40, 38, 44, 255)
MOUTH = (150, 110, 96, 255)

# 頭(8x8x8)
fill(8, 0, 8, 8, HAIR)         # top
fill(16, 0, 8, 8, SKIN)        # bottom
fill(0, 8, 32, 8, SKIN)        # right/front/left/back
fill(0, 8, 32, 2, HAIR)        # 前髪バンド（側面上2列）
# 顔（front = 8,8 の 8x8）
fill(10, 11, 2, 2, EYE)
fill(14, 11, 2, 2, EYE)
fill(11, 14, 3, 1, MOUTH)

# 胴
fill(16, 16, 24, 16, SHIRT)
# 右腕
fill(40, 16, 16, 16, SHIRT)
fill(40, 28, 16, 4, SKIN)      # 手
# 右脚
fill(0, 16, 16, 16, PANTS)
fill(0, 28, 16, 4, SHOE)       # 靴
# 左脚
fill(16, 48, 16, 16, PANTS)
fill(16, 60, 16, 4, SHOE)
# 左腕
fill(32, 48, 16, 16, SHIRT)
fill(32, 60, 16, 4, SKIN)

def write_png(path):
    raw = bytearray()
    for y in range(H):
        raw.append(0)  # filter type 0
        for x in range(W):
            raw += bytes(px[y * W + x])
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'docs', 'sample-skin.png')
    write_png(out)
    print('wrote', out)
