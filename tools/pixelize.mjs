#!/usr/bin/env node
/**
 * 把「高解析度的像素畫 PNG」轉成遊戲用的小尺寸貼圖。
 *
 *   node tools/pixelize.mjs <輸入> <輸出> [--scale N] [--no-trim] [--info]
 *
 * 做三件事：
 *   1. 自動偵測原圖的像素網格（例如 600x600 其實是 20x20 放大 30 倍）
 *   2. 裁掉四周透明留白（--no-trim 可關閉）
 *   3. 以整數倍重新輸出（--scale 是「每個邏輯像素輸出幾個實際像素」，預設 2）
 *
 * 整數倍縮放 = 不會有取樣糊掉或閃爍，Phaser 開 pixelArt:true 就是脆的。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

// --- PNG 解碼 -------------------------------------------------------------

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 檔');

  let pos = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'PLTE') palette = Buffer.from(body);
    else if (type === 'tRNS') transparency = Buffer.from(body);
    else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const { width, height, depth, colorType, interlace } = ihdr;
  if (interlace) throw new Error('不支援交錯式 (interlaced) PNG');
  if (!(colorType in CHANNELS)) throw new Error(`不支援的 colorType ${colorType}`);
  if (colorType !== 3 && depth !== 8) throw new Error(`只支援 8-bit（此檔 ${depth}-bit）`);

  const channels = CHANNELS[colorType];
  const bitsPerPixel = channels * depth;
  const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));

  // 逐列反過濾
  const lines = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bytesPerPixel ? line[i - bytesPerPixel] : 0;
      const b = prev[i];
      const c = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
      switch (filter) {
        case 1: line[i] = (line[i] + a) & 255; break;
        case 2: line[i] = (line[i] + b) & 255; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 255; break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
      }
    }
    line.copy(lines, y * stride);
    prev = line;
  }

  // 統一攤平成 RGBA
  const rgba = Buffer.alloc(width * height * 4);
  const readIndex = (line, x) => {
    if (depth === 8) return line[x];
    const perByte = 8 / depth;
    const shift = (perByte - 1 - (x % perByte)) * depth;
    return (line[(x / perByte) | 0] >> shift) & ((1 << depth) - 1);
  };

  for (let y = 0; y < height; y++) {
    const line = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 3) {
        const i = readIndex(line, x);
        rgba[o] = palette[i * 3];
        rgba[o + 1] = palette[i * 3 + 1];
        rgba[o + 2] = palette[i * 3 + 2];
        rgba[o + 3] = transparency && i < transparency.length ? transparency[i] : 255;
      } else if (colorType === 6) {
        line.copy(rgba, o, x * 4, x * 4 + 4);
      } else if (colorType === 2) {
        line.copy(rgba, o, x * 3, x * 3 + 3);
        rgba[o + 3] = 255;
      } else if (colorType === 0) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = line[x];
        rgba[o + 3] = 255;
      } else {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = line[x * 2];
        rgba[o + 3] = line[x * 2 + 1];
      }
    }
  }
  return { width, height, rgba };
}

// --- PNG 編碼 -------------------------------------------------------------

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(payload));
  return Buffer.concat([len, payload, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- 分析 -----------------------------------------------------------------

/** 找出最大的「每格顏色一致」的方塊大小，也就是原圖的像素網格 */
function detectGrid(width, height, rgba) {
  const px = (x, y) => rgba.readUInt32BE((y * width + x) * 4);
  const candidates = [];
  for (let bs = Math.min(width, height); bs >= 1; bs--) {
    if (width % bs === 0 && height % bs === 0) candidates.push(bs);
  }
  for (const bs of candidates) {
    let uniform = true;
    for (let by = 0; uniform && by < height / bs; by++) {
      for (let bx = 0; uniform && bx < width / bs; bx++) {
        const c = px(bx * bs, by * bs);
        for (let y = by * bs; uniform && y < (by + 1) * bs; y++) {
          for (let x = bx * bs; x < (bx + 1) * bs; x++) {
            if (px(x, y) !== c) { uniform = false; break; }
          }
        }
      }
    }
    if (uniform) return bs;
  }
  return 1;
}

function alphaBounds(w, h, get) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (get(x, y)[3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

// --- 主流程 ---------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) =>
  !a.startsWith('--') && !(i > 0 && args[i - 1] === '--scale'));

const [input, output] = positional;
if (!input) {
  console.error('用法: node tools/pixelize.mjs <輸入.png> [輸出.png] [--scale N] [--no-trim] [--info]');
  process.exit(1);
}

const src = decodePng(readFileSync(input));
const block = detectGrid(src.width, src.height, src.rgba);
const logicalW = src.width / block;
const logicalH = src.height / block;
const cell = (x, y) => src.rgba.subarray(((y * block) * src.width + x * block) * 4).subarray(0, 4);

const trim = !flag('--no-trim');
const b = alphaBounds(logicalW, logicalH, cell);
if (b.maxX < 0) { console.error('整張圖都是透明的'); process.exit(1); }
const box = trim ? b : { minX: 0, minY: 0, maxX: logicalW - 1, maxY: logicalH - 1 };
const cropW = box.maxX - box.minX + 1;
const cropH = box.maxY - box.minY + 1;

console.log(`來源      ${src.width} x ${src.height}`);
console.log(`像素網格  ${block}px → 邏輯解析度 ${logicalW} x ${logicalH}`);
console.log(`內容範圍  x ${b.minX}..${b.maxX}, y ${b.minY}..${b.maxY} (${cropW} x ${cropH} 邏輯像素)`);

if (flag('--info') || !output) process.exit(0);

const scale = Number(opt('--scale', 2));
if (!Number.isInteger(scale) || scale < 1) {
  console.error('--scale 必須是 >= 1 的整數（整數倍才不會糊掉）');
  process.exit(1);
}
const outW = cropW * scale;
const outH = cropH * scale;
const out = Buffer.alloc(outW * outH * 4);
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const c = cell(box.minX + ((x / scale) | 0), box.minY + ((y / scale) | 0));
    c.copy(out, (y * outW + x) * 4);
  }
}
writeFileSync(output, encodePng(outW, outH, out));
console.log(`輸出      ${output}  ${outW} x ${outH}  (每邏輯像素 ${scale}px)`);
