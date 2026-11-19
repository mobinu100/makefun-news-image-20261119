// news-image-20261119: "The World in One Day" — Thursday 19 November 2026.
// A self-contained Node 22 program (standard library only, no network) that draws
// a one-page newspaper front page summarising the day's world news and writes it
// to $MAKEFUN_OUTPUT_DIR/entry.png (1024x1024 PNG, deterministic across runs).
//
// Stories were researched fresh on 19 Nov 2026 from live news reports:
//  - Grand Theft Auto VI global midnight launch (Reuters / Polygon / AP)
//  - Anthropic prices a record $81.3bn IPO at $83/share, trading starts 19 Nov (CNN / Bloomberg)
//  - ICJ delivers its judgment in Gambia v Myanmar (Rohingya genocide case) on 19 Nov
//  - NASA's Voyager 1 reaches one light-day from Earth; NASA confirms 19 Nov
//  - EU proposes a 45bn euro Ukraine loan, repaid from Russian reparations (FT)
//  - Israeli ground operation in central Gaza; Crimea bridge attacked again
//  - Cyclone Akvan nears India's east coast; US-Iran exchange fire widens in the Gulf;
//    Fed minutes point to more rate rises.
//
// Rendering: a hand-built 5x7 bitmap font (all text set in capitals, newspaper style),
// a small RGBA canvas, and a from-scratch PNG encoder (zlib deflate + CRC32).
// Nothing is read from disk and no randomness is used, so two runs are byte-identical.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits ('#' = ink). Uppercase,
// digits and common punctuation only; drawText uppercases its input.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
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
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '>': ['10000', '01000', '00100', '00010', '00100', '01000', '10000'],
  '<': ['00001', '00010', '00100', '01000', '00100', '00010', '00001'],
};

// ---------------------------------------------------------------------------
// Canvas: 1024x1024 RGBA buffer with simple drawing primitives.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4);

type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [22, 19, 14];
const RED: RGB = [179, 39, 30];
const NAVY: RGB = [23, 54, 93];
const TEAL: RGB = [14, 107, 107];
const GOLD: RGB = [217, 164, 65];
const WHITE: RGB = [250, 248, 242];
const DUSK: RGB = [123, 45, 139];
const SUNSET: RGB = [232, 106, 51];
const PINK: RGB = [232, 140, 160];
const SKY: RGB = [43, 32, 86];
const SEA: RGB = [16, 90, 110];

function setPixel(x: number, y: number, c: RGB): void {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void { fillRect(x, y, w, t, c); }
function vline(x: number, y: number, h: number, c: RGB, t = 1): void { fillRect(x, y, t, h, c); }
function frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  hline(x, y, w, c, t); hline(x, y + h - t, w, c, t);
  vline(x, y, h, c, t); vline(x + w - t, y, h, c, t);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy))));
    for (let xx = cx - dx; xx <= cx + dx; xx++) setPixel(xx, yy, c);
  }
}
// Bresenham line, thickness 1..3.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs), b = Math.max(...xs);
      for (let x = Math.ceil(a); x <= Math.floor(b); x++) setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Text: draw one glyph, one line, and word-wrapped paragraphs.
// charW(scale) = 6*scale (5 px glyph + 1 px gap); line height = 9*scale.
// ---------------------------------------------------------------------------
function charW(scale: number): number { return 6 * scale; }
function textWidth(s: string, scale: number): number { return s.length * charW(scale) - scale; }
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT['?'];
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if (g[r][col] === '1') fillRect(x + col * scale, y + r * scale, scale, scale, c);
  }
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  x = Math.floor(x); y = Math.floor(y);
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) drawChar(x + i * charW(scale), y, up[i], scale, c);
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(Math.floor(cx - textWidth(s, scale) / 2), y, s, scale, c);
}
// Word-wrap into lines that fit maxW; returns lines (already uppercased by drawText).
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, leading?: number): number {
  const lh = leading ?? Math.round(9.4 * scale);
  const lines = wrap(s, scale, maxW);
  lines.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, c));
  return y + lines.length * lh;
}

// ---------------------------------------------------------------------------
// PNG encoder: signature, IHDR, IDAT (zlib deflate, filter 0), IEND.
// Deterministic: fixed compression level, no timestamps anywhere in the file.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Layout: a newspaper front page, 1024x1024, paper background.
//   Masthead: THE WORLD TODAY / THURSDAY 19 NOVEMBER 2026
//   Hero: GTA VI global launch, drawn Vice City sunset beside the headline
//   Four panels: Anthropic IPO / ICJ Rohingya ruling / Voyager 1 / Gaza+Crimea
//   Also-today strip: EU Ukraine loan / Cyclone Akvan / US-Iran / Fed minutes
// ---------------------------------------------------------------------------
const M = 28; // outer margin
const CW = W - 2 * M; // content width = 968

function drawMasthead(): void {
  hline(M, 22, CW, INK, 3);
  hline(M, 28, CW, INK, 1);
  drawTextCentered(W / 2, 40, 'THE WORLD TODAY', 3, INK);
  drawTextCentered(W / 2, 68, 'THURSDAY 19 NOVEMBER 2026', 5, INK);
  fillRect(M, 112, CW, 5, RED);
  drawTextCentered(W / 2, 126, 'ONE DAY IN ONE PICTURE - THE NEWS THAT MATTERED', 2, NAVY);
  hline(M, 146, CW, INK, 2);
}

function drawPalm(x: number, baseY: number, h: number, c: RGB): void {
  const topX = x + 10, topY = baseY - h;
  line(x, baseY, topX, topY, c, 4);
  const fronds: Array<[number, number]> = [[-34, -6], [-24, -22], [-6, -30], [14, -26], [30, -12], [34, 4]];
  for (const [dx, dy] of fronds) line(topX, topY, topX + dx, topY + dy, c, 3);
  fillCircle(topX - 3, topY + 2, 4, GOLD);
  fillCircle(topX + 4, topY + 3, 4, GOLD);
}

function drawHero(): void {
  const x0 = M, y0 = 156, x1 = 560, y1 = 478;
  frame(x0, y0, x1 - x0, y1 - y0, INK, 2);
  // Sunset sky in horizontal bands.
  fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, 78, SKY);
  fillRect(x0 + 2, y0 + 80, x1 - x0 - 4, 70, DUSK);
  fillRect(x0 + 2, y0 + 150, x1 - x0 - 4, 62, SUNSET);
  fillRect(x0 + 2, y0 + 212, x1 - x0 - 4, 46, GOLD);
  // Sun, low over the skyline.
  fillCircle(294, 288, 46, [255, 214, 130]);
  fillCircle(294, 288, 34, [255, 232, 170]);
  // Skyline silhouettes.
  const skyline: Array<[number, number, number]> = [
    [36, 372, 52], [92, 352, 40], [136, 380, 62], [202, 344, 46], [252, 368, 58],
    [314, 336, 44], [362, 372, 54], [420, 352, 42], [466, 378, 56], [508, 360, 40],
  ];
  for (const [bx, top, bw] of skyline) {
    fillRect(x0 + bx, top, bw, 412 - top, [30, 20, 60]);
    fillRect(x0 + bx + 8, top + 10, 6, 8, GOLD);
    fillRect(x0 + bx + bw - 16, top + 26, 6, 8, GOLD);
  }
  // Neon sign.
  fillRect(x0 + 66, 318, 400, 40, [24, 12, 40]);
  frame(x0 + 66, 318, 400, 40, PINK, 2);
  drawTextCentered(294, 328, 'VICE CITY', 3, PINK);
  // Water with glints.
  fillRect(x0 + 2, 412, x1 - x0 - 4, y1 - 412 - 2, SEA);
  const glints = [70, 150, 240, 330, 420, 490, 120, 290, 380, 460];
  glints.forEach((gx, i) => fillRect(x0 + gx, 428 + (i % 3) * 14, 34, 3, WHITE));
  // Palms framing the scene.
  drawPalm(x0 + 44, 412, 92, [20, 40, 26]);
  drawPalm(x1 - 66, 412, 78, [20, 40, 26]);

  // Right-hand story text.
  const tx = 584, tw = 996 - tx;
  drawText(tx, 172, 'CULTURE - THE LEAD STORY', 2, RED);
  drawText(tx, 198, 'GTA VI', 8, INK);
  drawText(tx, 258, 'IS HERE', 8, INK);
  fillRect(tx, 322, tw, 3, INK);
  drawPara(tx, 338, "AFTER 13 YEARS, ROCKSTAR'S GRAND THEFT AUTO VI UNLOCKS AROUND THE WORLD AT MIDNIGHT - NEW ZEALAND FIRST. PS5 AND XBOX, $79.99. PRE-ORDERS TOP $1.5BN.", 2, tw, INK, 19);
  drawText(tx, 448, 'ROLLING MIDNIGHT LAUNCH', 2, RED);
}

function drawIcon(kind: string, cxIn: number, y: number): void {
  const cx = Math.floor(cxIn);
  if (kind === 'ipo') {
    // Rising bar chart with an arrow.
    const base = y + 44;
    const heights = [14, 24, 34, 44];
    heights.forEach((h, i) => fillRect(cx - 44 + i * 24, base - h, 16, h, NAVY));
    hline(cx - 50, base, 104, INK, 2);
    line(cx - 48, base - 12, cx + 48, base - 46, RED, 3);
    fillTriangle(cx + 48, base - 46, cx + 34, base - 46, cx + 48, base - 32, RED);
  } else if (kind === 'law') {
    // Scales of justice.
    vline(cx, y + 4, 40, TEAL, 3);
    hline(cx - 30, y + 8, 60, TEAL, 3);
    fillCircle(cx, y + 4, 4, TEAL);
    line(cx - 30, y + 8, cx - 38, y + 28, TEAL, 2);
    line(cx - 30, y + 8, cx - 22, y + 28, TEAL, 2);
    line(cx + 30, y + 8, cx + 22, y + 28, TEAL, 2);
    line(cx + 30, y + 8, cx + 38, y + 28, TEAL, 2);
    fillTriangle(cx - 46, y + 28, cx - 14, y + 28, cx - 30, y + 40, TEAL);
    fillTriangle(cx + 14, y + 28, cx + 46, y + 28, cx + 30, y + 40, TEAL);
    hline(cx - 14, y + 44, 28, TEAL, 3);
  } else if (kind === 'space') {
    // Dish beaming at a distant probe, under stars.
    fillCircle(cx - 22, y + 26, 12, DUSK);
    line(cx - 22, y + 26, cx - 34, y + 42, DUSK, 3);
    line(cx - 22, y + 26, cx - 10, y + 42, DUSK, 3);
    line(cx - 12, y + 18, cx + 34, y + 6, GOLD, 2);
    line(cx - 12, y + 22, cx + 36, y + 14, GOLD, 2);
    fillCircle(cx + 42, y + 10, 4, GOLD);
    drawText(cx + 26, y + 30, '*', 2, DUSK);
    drawText(cx - 46, y + 2, '*', 2, DUSK);
    drawText(cx + 8, y + 38, '*', 2, DUSK);
  } else {
    // Conflict: warning burst.
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      line(cx, y + 22, cx + Math.round(Math.cos(ang) * 34), y + 22 + Math.round(Math.sin(ang) * 20), RED, 3);
    }
    fillCircle(cx, y + 22, 9, RED);
    drawText(cx - 4, y + 14, '!', 2, WHITE);
  }
}

interface Panel { tag: string; color: RGB; icon: string; head: string; body: string }
const PANELS: Panel[] = [
  {
    tag: 'MARKETS', color: NAVY, icon: 'ipo', head: "ANTHROPIC'S $81.3BN IPO",
    body: "CLAUDE MAKER PRICES AT $83 A SHARE - THE LARGEST IPO EVER. TRADING STARTS TODAY AS ANT. VALUED NEAR $1.5TN.",
  },
  {
    tag: 'LAW - THE HAGUE', color: TEAL, icon: 'law', head: 'WORLD COURT RULES ON ROHINGYA',
    body: 'THE ICJ RULES TODAY IN GAMBIA V MYANMAR. IT MAY BE THE FIRST STATE GENOCIDE RULING EVER.',
  },
  {
    tag: 'SPACE', color: DUSK, icon: 'space', head: 'VOYAGER 1, A LIGHT-DAY AWAY',
    body: "NEARLY 50 YEARS AFTER LAUNCH, NASA'S PROBE REACHES ONE LIGHT-DAY FROM EARTH - CONFIRMED TODAY.",
  },
  {
    tag: 'CONFLICT', color: RED, icon: 'burst', head: 'GAZA AND CRIMEA UNDER FIRE',
    body: 'ISRAELI TROOPS LAUNCH A GROUND OPERATION IN CENTRAL GAZA. THE CRIMEA BRIDGE IS HIT AGAIN.',
  },
];

function drawPanels(): void {
  const y0 = 492, ph = 296, pw = 233, gap = 12;
  PANELS.forEach((p, i) => {
    const x = M + i * (pw + gap);
    fillRect(x, y0, pw, ph, WHITE);
    frame(x, y0, pw, ph, INK, 2);
    fillRect(x + 2, y0 + 2, pw - 4, 30, p.color);
    drawTextCentered(x + pw / 2, y0 + 10, p.tag, 2, WHITE);
    drawIcon(p.icon, x + pw / 2, y0 + 38);
    const headLines = wrap(p.head, 3, pw - 24);
    headLines.forEach((ln, j) => drawText(x + 12, y0 + 92 + j * 26, ln, 3, INK));
    drawPara(x + 12, y0 + 92 + headLines.length * 26 + 8, p.body, 2, pw - 24, INK, 17);
  });
}

function drawAlsoToday(): void {
  const y0 = 800, bh = 194;
  fillRect(M, y0, CW, bh, WHITE);
  frame(M, y0, CW, bh, INK, 2);
  fillRect(M + 2, y0 + 2, CW - 4, 30, INK);
  drawText(M + 14, y0 + 10, 'ALSO TODAY', 2, WHITE);
  const items: Array<[string, string]> = [
    ['EUROPE', 'EU PROPOSES A 45BN EURO LOAN FOR UKRAINE, TO BE REPAID FROM RUSSIAN REPARATIONS.'],
    ['INDIA', 'CYCLONE AKVAN NEARS THE EAST COAST; LANDFALL EXPECTED BETWEEN MACHILIPATNAM AND PURI.'],
    ['GULF', 'US AND IRAN EXCHANGE FIRE AS TEHRAN WIDENS STRIKES TO GULF BASES.'],
    ['ECONOMY', 'FED MINUTES: MOST OFFICIALS EXPECT MORE RATE RISES AHEAD.'],
  ];
  items.forEach(([kicker, text], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + 14 + col * 484;
    const y = y0 + 42 + row * 76;
    drawText(x, y, kicker + ' -', 2, RED);
    drawPara(x, y + 20, text, 2, 452, INK, 17);
  });
}

function drawFooter(): void {
  drawTextCentered(W / 2, 1004, "THURSDAY 19 NOVEMBER 2026 - THE WORLD'S NEWS IN ONE IMAGE", 2, NAVY);
}

// ---------------------------------------------------------------------------
// Entry point: paint the page, encode, write entry.png deterministically.
// ---------------------------------------------------------------------------
function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawHero();
  drawPanels();
  drawAlsoToday();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}
main();
