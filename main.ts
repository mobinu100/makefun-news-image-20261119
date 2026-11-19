// THE WORLD — front page of Thursday 19 November 2026.
// A newspaper front page drawn in code: masthead + date, one dominant lead
// story with a drawn hero scene, secondary stories in ruled columns with
// small drawn illustrations, and an "Also Today" band. Node 22 stdlib only,
// no network, deterministic: the same bytes every run.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const PAPER = [245, 240, 225];
const INK = [26, 26, 26];
const BLACK = [10, 10, 10];
const RED = [185, 28, 28];
const TEAL = [15, 118, 110];
const GRAY = [74, 74, 74];
const DARKGRAY = [51, 51, 51];
const CREAM = [245, 240, 225];
const MOON = [253, 230, 138];

// ---------- PNG encoding (stdlib only) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  parts.push(chunk('IHDR', ihdr));
  parts.push(chunk('IDAT', deflateSync(raw, { level: 9 })));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// ---------- Canvas ----------
const img = Buffer.alloc(W * H * 4);
function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
}
function fillRect(x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function hline(x, y, w, c, t = 1) { fillRect(x, y, w, t, c); }
function vline(x, y, h, c, t = 1) { fillRect(x, y, t, h, c); }
function rect(x, y, w, h, c, t = 1) {
  hline(x, y, w, c, t); hline(x, y + h - t, w, c, t);
  vline(x, y, h, c, t); vline(x + w - t, y, h, c, t);
}
function line(x0, y0, x1, y1, c, t = 1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    if (t === 1) setPx(x, y, c);
    else fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function fillCircle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -dx; x <= dx; x++) setPx(cx + x, cy + y, c);
  }
}
function circleOutline(cx, cy, r, c) {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPx(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}
// Deterministic pseudo-random from coordinates (no Math.random anywhere).
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}
function halftone(x0, y0, w, h, spacing, threshold, c, r = 1) {
  for (let y = y0; y < y0 + h; y += spacing)
    for (let x = x0; x < x0 + w; x += spacing)
      if (hash2(x, y) < threshold) fillCircle(x, y, r, c);
}

// ---------- 5x7 bitmap font (written fresh) ----------
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01001', '01000', '11110', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '00010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '11110', '10001', '10001', '11110', '10000', '10000'],
  q: ['00000', '00000', '01111', '10001', '10001', '01111', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['01000', '01000', '11110', '01000', '01000', '01000', '00110'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10101', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  '•': ['00000', '00000', '01100', '01100', '01100', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '€': ['00111', '01000', '10000', '11110', '10000', '01000', '00111'],
};
const CHAR_W = 6; // advance per character at scale 1 (5 px glyph + 1 px gap)
function textWidth(s, scale) { return s.length * CHAR_W * scale - scale; }
function drawGlyph(ch, x, y, scale, c) {
  const g = FONT[ch] || FONT[' '];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === '1') fillRect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(s, x, y, scale, c, align = 'left') {
  let sx = x;
  if (align === 'center') sx = x - Math.floor(textWidth(s, scale) / 2);
  if (align === 'right') sx = x - textWidth(s, scale);
  for (const ch of s) { drawGlyph(ch, sx, y, scale, c); sx += CHAR_W * scale; }
  return sx;
}
function wrap(s, maxW, scale) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(s, x, y, maxW, scale, c, lineH) {
  const lines = wrap(s, maxW, scale);
  for (let i = 0; i < lines.length; i++) drawText(lines[i], x, y + i * lineH, scale, c);
  return lines.length;
}

// ---------- Hero: Vice City at night, flat woodcut style (no gradient) ----------
function drawHero(x, y, w, h) {
  fillRect(x, y, w, h, INK);
  // Stars: halftone dots in the upper sky.
  halftone(x + 8, y + 8, w - 16, 120, 15, 0.14, CREAM, 1);
  halftone(x + 8, y + 8, w - 16, 120, 34, 0.5, MOON, 1);
  // Moon.
  fillCircle(x + w - 150, y + 46, 30, MOON);
  fillCircle(x + w - 162, y + 38, 5, [230, 200, 110]);
  fillCircle(x + w - 138, y + 56, 4, [230, 200, 110]);
  fillCircle(x + w - 152, y + 60, 3, [230, 200, 110]);
  const groundY = y + h - 36;
  // Far skyline.
  let bx = x + 10;
  let i = 0;
  while (bx < x + w - 30) {
    const bw = 34 + Math.floor(hash2(i, 7) * 40);
    const bh = 46 + Math.floor(hash2(i, 11) * 46);
    fillRect(bx, groundY - bh, bw, bh, DARKGRAY);
    // Lit windows.
    for (let wy = groundY - bh + 8; wy < groundY - 8; wy += 12)
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 10)
        if (hash2(wx, wy) < 0.4) fillRect(wx, wy, 3, 4, MOON);
    bx += bw + 6;
    i++;
  }
  // Near skyline (darker, lower).
  bx = x + 2;
  i = 100;
  while (bx < x + w - 20) {
    const bw = 44 + Math.floor(hash2(i, 13) * 46);
    const bh = 26 + Math.floor(hash2(i, 17) * 30);
    fillRect(bx, groundY - bh, bw, bh, BLACK);
    for (let wy = groundY - bh + 7; wy < groundY - 7; wy += 11)
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 11)
        if (hash2(wx, wy) < 0.35) fillRect(wx, wy, 3, 4, CREAM);
    bx += bw + 4;
    i++;
  }
  // Neon sign: VICE CITY.
  const sx = x + Math.floor(w / 2) - 108, sy = y + 52;
  fillRect(sx - 4, sy - 4, 224, 52, INK);
  rect(sx - 4, sy - 4, 224, 52, RED, 2);
  drawText('VICE CITY', sx + 108, sy + 8, 3, RED, 'center');
  for (let d = 0; d <= 224; d += 12) { setPx(sx - 4 + d, sy - 7, MOON); setPx(sx - 4 + d, sy + 51, MOON); }
  vline(sx + 20, sy + 48, 40, GRAY, 3);
  vline(sx + 196, sy + 48, 40, GRAY, 3);
  // Palm silhouettes (cream woodcut shapes against the night sky).
  drawPalm(x + 66, groundY, 52, CREAM);
  drawPalm(x + w - 66, groundY, 46, CREAM);
  // Street.
  fillRect(x, groundY, w, 36, BLACK);
  hline(x, groundY, w, GRAY, 1);
  for (let d = x + 30; d < x + w - 30; d += 90) fillRect(d, groundY + 22, 44, 3, CREAM);
  // Red car.
  const cx = x + Math.floor(w / 2) - 78, cy = groundY + 6;
  fillRect(cx, cy + 8, 156, 12, RED);
  fillRect(cx + 22, cy, 112, 10, RED);
  fillRect(cx + 30, cy + 2, 26, 8, CREAM);
  fillRect(cx + 96, cy + 2, 26, 8, CREAM);
  fillCircle(cx + 34, cy + 20, 7, INK); fillCircle(cx + 34, cy + 20, 3, CREAM);
  fillCircle(cx + 122, cy + 20, 7, INK); fillCircle(cx + 122, cy + 20, 3, CREAM);
  // Crowd figures on the pavement.
  for (let f = 0; f < 5; f++) {
    const fx = x + 150 + f * 160 + Math.floor(hash2(f, 3) * 30);
    fillCircle(fx, groundY - 16, 4, GRAY);
    fillRect(fx - 4, groundY - 12, 8, 12, GRAY);
  }
}
function drawPalm(x, groundY, hgt, c) {
  line(x, groundY, x + 4, groundY - hgt, c, 3);
  const tx = x + 4, ty = groundY - hgt;
  const fronds = [[-26, -6], [-20, -16], [-8, -22], [6, -22], [18, -16], [26, -6], [0, -24]];
  for (const [dx, dy] of fronds) line(tx, ty, tx + dx, ty + dy, c, 2);
  fillCircle(tx - 4, ty + 2, 3, c);
  fillCircle(tx + 4, ty + 2, 3, c);
}

// ---------- Small column illustrations (flat, bordered) ----------
function drawStrip(kind, x, y, w, h) {
  fillRect(x, y, w, h, PAPER);
  rect(x, y, w, h, INK, 1);
  const cy = y + Math.floor(h / 2);
  if (kind === 'flags') {
    const px = [x + 70, x + 156, x + 242];
    for (let k = 0; k < 3; k++) vline(px[k], y + 8, 22, INK, 2);
    // Flag 1: red-white-red stripes.
    fillRect(px[0] + 2, y + 8, 26, 5, RED);
    fillRect(px[0] + 2, y + 13, 26, 4, PAPER);
    fillRect(px[0] + 2, y + 17, 26, 5, RED);
    rect(px[0] + 2, y + 8, 26, 14, INK, 1);
    // Flag 2: red field, cream stars.
    fillRect(px[1] + 2, y + 8, 26, 14, RED);
    for (const [dx, dy] of [[6, 4], [13, 7], [20, 4], [9, 11], [17, 11]]) fillRect(px[1] + dx, y + dy, 2, 2, CREAM);
    rect(px[1] + 2, y + 8, 26, 14, INK, 1);
    // Flag 3: blue-white-red bands.
    fillRect(px[2] + 2, y + 8, 26, 5, TEAL);
    fillRect(px[2] + 2, y + 13, 26, 4, PAPER);
    fillRect(px[2] + 2, y + 17, 26, 5, RED);
    rect(px[2] + 2, y + 8, 26, 14, INK, 1);
    hline(x + 8, y + 30, w - 16, INK, 1);
  } else if (kind === 'chart') {
    const bars = [8, 14, 20, 27];
    for (let k = 0; k < 4; k++) {
      const bw = 26, bx = x + 40 + k * 62;
      fillRect(bx, y + h - 6 - bars[k], bw, bars[k], k === 3 ? RED : INK);
    }
    hline(x + 16, y + h - 6, w - 32, INK, 2);
    line(x + 46, y + h - 12, x + w - 40, y + 8, RED, 3);
    line(x + w - 40, y + 8, x + w - 56, y + 14, RED, 3);
    line(x + w - 40, y + 8, x + w - 56, y + 2, RED, 3);
  } else if (kind === 'court') {
    const cx = x + Math.floor(w / 2);
    line(cx - 52, y + 14, cx, y + 3, INK, 2);
    line(cx, y + 3, cx + 52, y + 14, INK, 2);
    hline(cx - 52, y + 14, 104, INK, 2);
    for (const dx of [-38, 0, 38]) {
      vline(cx + dx - 2, y + 16, 14, INK, 3);
      hline(cx + dx - 6, y + 16, 12, INK, 2);
      hline(cx + dx - 6, y + 30, 12, INK, 2);
    }
    hline(cx - 58, y + 32, 116, INK, 2);
  } else if (kind === 'burst') {
    const cx = x + 90, cyy = cy;
    for (let a = 0; a < 8; a++) {
      const rad = (a * Math.PI) / 4;
      line(cx, cyy, Math.round(cx + 26 * Math.cos(rad)), Math.round(cyy + 26 * Math.sin(rad)), RED, 2);
    }
    fillCircle(cx, cyy, 5, INK);
    for (let a = 0; a < 360; a += 18) {
      const rad = (a * Math.PI) / 180;
      setPx(Math.round(cx + 34 * Math.cos(rad)), Math.round(cyy + 34 * Math.sin(rad)), INK);
    }
    drawText('GAZA · CRIMEA', x + 150, cy - 7, 2, INK);
  } else if (kind === 'planet') {
    fillCircle(x + 84, cy, 12, TEAL);
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      setPx(Math.round(x + 84 + 22 * Math.cos(rad)), Math.round(cy + 6 * Math.sin(rad)), INK);
    }
    for (const [sx, sy] of [[40, 8], [150, 6], [200, 12], [250, 8]]) fillCircle(x + sx, y + sy, 1, INK);
    // Probe: small body + dish + antenna.
    fillRect(x + 210, cy - 4, 18, 8, INK);
    line(x + 228, cy, x + 240, cy - 8, INK, 2);
    fillCircle(x + 242, cy - 9, 2, RED);
    line(x + 210, cy + 4, x + 198, cy + 10, INK, 2);
  } else if (kind === 'eustars') {
    fillRect(x + 1, y + 1, w - 2, h - 2, TEAL);
    const cx = x + 70, cyy = cy;
    for (let k = 0; k < 12; k++) {
      const rad = (k * Math.PI) / 6;
      fillCircle(Math.round(cx + 13 * Math.cos(rad)), Math.round(cyy + 13 * Math.sin(rad)), 2, MOON);
    }
    drawText('€45BN', x + 100, cy - 7, 2, CREAM);
    drawText('UKRAINE', x + 176, cy - 7, 2, CREAM);
  }
}

// ---------- Page ----------
function drawStory(x, y, w, kind, label, headline, body) {
  drawStrip(kind, x, y, w, 36);
  drawText(label, x, y + 42, 2, RED);
  const hl = wrap(headline, w, 3);
  for (let i = 0; i < hl.length; i++) drawText(hl[i], x, y + 60 + i * 22, 3, INK);
  drawWrapped(body, x, y + 60 + hl.length * 22 + 4, w, 2, INK, 15);
}

function drawLeadItem(x, y, w, lead, rest) {
  // Line 1: red lead-in + ink body words; line 2: remaining body words.
  const words = rest.split(' ');
  const leadW = textWidth(lead + ' ', 2);
  let line1 = '', i = 0;
  while (i < words.length) {
    const t = line1 ? line1 + ' ' + words[i] : words[i];
    if (leadW + textWidth(t, 2) <= w) { line1 = t; i++; } else break;
  }
  let sx = drawText(lead, x, y, 2, RED);
  drawText(line1, sx + 12, y, 2, INK);
  const line2 = words.slice(i).join(' ');
  if (line2) drawText(line2, x, y + 15, 2, INK);
}

function main() {
  fillRect(0, 0, W, H, PAPER);
  // Frame: outer double rule.
  rect(8, 8, W - 16, H - 16, INK, 3);
  rect(14, 14, W - 28, H - 28, INK, 1);
  const L = 24, R = 1000;

  // Masthead.
  drawText('VOL. CXLIV', L, 52, 2, INK);
  drawText('No. 287', R, 52, 2, INK, 'right');
  drawText('THE WORLD', 512, 20, 10, INK, 'center');
  hline(L, 98, R - L, INK, 3);
  hline(L, 103, R - L, INK, 1);
  // Dateline.
  drawText('EST. 1882', L, 112, 2, INK);
  drawText('ONE DOLLAR', R, 112, 2, INK, 'right');
  drawText('THURSDAY, 19 NOVEMBER 2026', 512, 108, 3, INK, 'center');
  hline(L, 132, R - L, INK, 1);

  // Lead story.
  drawText('CULTURE — THE LEAD STORY', L, 140, 2, RED);
  drawText('GRAND THEFT AUTO VI', 512, 160, 7, INK, 'center');
  drawText('IS HERE', 512, 216, 7, INK, 'center');
  drawText("AFTER 13 YEARS, ROCKSTAR'S GRAND THEFT AUTO VI UNLOCKS AT MIDNIGHT —", 512, 274, 2, INK, 'center');
  drawText('NEW ZEALAND FIRST. PS5 AND XBOX, $79.99. PRE-ORDERS TOP $1.5BN. 99 OF 100.', 512, 292, 2, INK, 'center');
  drawHero(L, 310, R - L, 212);
  drawText('Midnight queues from Auckland to Los Angeles as the epic unlocks worldwide.', 512, 530, 2, INK, 'center');
  hline(L, 550, R - L, INK, 1);

  // Ruled columns: 3 columns, 2 stories each.
  const cols = [L, 356, 688];
  const colW = 312;
  vline(346, 558, 330, INK, 1);
  vline(678, 558, 330, INK, 1);
  const stories = [
    { kind: 'flags', label: 'DIPLOMACY — SHENZHEN', headline: 'TRUMP, XI AND PUTIN MEET',
      body: 'The three leaders meet in Shenzhen at APEC summit — unprecedented trilateral.' },
    { kind: 'chart', label: 'MARKETS', headline: "ANTHROPIC'S $81.3BN IPO",
      body: "Claude's maker prices at $83 a share — the biggest IPO ever. Trading starts today as ANT." },
    { kind: 'court', label: 'LAW — THE HAGUE', headline: 'WORLD COURT DECIDES TODAY',
      body: 'The ICJ rules today on Myanmar and the Rohingya — a genocide verdict, a first for any state.' },
    { kind: 'burst', label: 'CONFLICT', headline: 'GAZA AND CRIMEA UNDER FIRE',
      body: 'Israeli troops launch a rare ground operation in central Gaza. The Crimean Bridge is hit again.' },
    { kind: 'planet', label: 'SPACE', headline: 'VOYAGER 1, ONE LIGHT-DAY AWAY',
      body: "NASA's 1977 probe is the first human-made object a light-day from Earth — its signals take a day." },
    { kind: 'eustars', label: 'EUROPE', headline: "EU'S €45BN UKRAINE LOAN",
      body: 'Brussels proposes a €45BN loan for Kyiv, to be repaid from Russian reparations.' },
  ];
  for (let c = 0; c < 3; c++) {
    drawStory(cols[c], 558, colW, stories[c * 2].kind, stories[c * 2].label, stories[c * 2].headline, stories[c * 2].body);
    hline(cols[c], 722, colW, INK, 1);
    drawStory(cols[c], 726, colW, stories[c * 2 + 1].kind, stories[c * 2 + 1].label, stories[c * 2 + 1].headline, stories[c * 2 + 1].body);
  }
  hline(L, 896, R - L, INK, 1);

  // Also Today band: 2 rows x 2 columns.
  fillRect(L, 902, R - L, 22, INK);
  drawText('ALSO TODAY', L + 8, 907, 2, CREAM);
  drawText('THURSDAY 19 NOVEMBER 2026', R - 8, 907, 2, CREAM, 'right');
  drawLeadItem(L, 932, 470, 'CYCLONE AKVAN —', "Landfall due between Machilipatnam and Puri, India.");
  drawLeadItem(512, 932, 470, 'US-IRAN —', 'The two sides exchange fire again; Tehran widens Gulf strikes.');
  drawLeadItem(L, 966, 470, 'FED MINUTES —', 'Most officials expect more rate rises ahead.');
  drawLeadItem(512, 966, 470, 'VAN GOGH —', "'Chestnut Trees in Blossom' sells for a record $190.4M.");
  drawText("THURSDAY 19 NOVEMBER 2026 — THE WORLD'S NEWS IN ONE IMAGE", 512, 1000, 1, INK, 'center');

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG(img, W, H));
}

main();
