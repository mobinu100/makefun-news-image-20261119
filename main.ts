// news-image-20261119: "The World in One Day" — Thursday 19 November 2026.
// V2: premium news-infographic front page. Same 8 verified stories and wording
// as V1 (facts unchanged); the craft is upgraded per the visual-concept-designer
// Bento-grid rules and data-visualization hierarchy rules:
//  - One dominant visual metaphor (the Vice City sunset hero) carrying the lead.
//  - Bento grid: story panels in varied widths by importance (IPO widest, Gaza
//    wide, ICJ/Voyager narrower), one accent colour per beat, consistent headers.
//  - Type hierarchy: navy masthead band behind the huge date, gold + red rules,
//    big lead headline, clear kickers, generous spacing; nothing below scale 2.
//  - Intentional colour: warm paper base, navy/red/gold accents, one colour per
//    panel header; decorative elements (texture, shadows, glow) stay subordinate
//    to the stories and never touch the text.
// A self-contained Node 22 program (standard library only, no network) that draws
// the page and writes it to $MAKEFUN_OUTPUT_DIR/entry.png (1024x1024 PNG,
// deterministic across runs).
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
const SHADOW: RGB = [206, 196, 176];
const GLOW1: RGB = [255, 170, 90];
const GLOW2: RGB = [255, 190, 120];
const GLOW3: RGB = [255, 210, 140];
const SUNCORE: RGB = [255, 240, 200];
const BLDG: RGB = [28, 18, 58];
const WINLIT: RGB = [255, 205, 110];
const WINDARK: RGB = [70, 58, 100];

function lerp(a: number, b: number, t: number): number { return Math.round(a + (b - a) * t); }
function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

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
// Layout: premium news-infographic front page, 1024x1024, paper background.
//   Masthead: THE WORLD TODAY / date on a navy band / gold + red rules
//   Hero: GTA VI global launch, rich layered Vice City sunset beside headline
//   Bento panels (varied widths): Anthropic IPO / ICJ Rohingya / Voyager 1 /
//     Gaza+Crimea, each with its own drawn illustration and accent colour
//   Also-today strip: EU Ukraine loan / Cyclone Akvan / US-Iran / Fed minutes
// ---------------------------------------------------------------------------
const M = 28; // outer margin
const CW = W - 2 * M; // content width = 968

function drawMasthead(): void {
  hline(M, 22, CW, INK, 3);
  hline(M, 28, CW, INK, 1);
  drawTextCentered(W / 2, 38, 'THE WORLD TODAY', 3, INK);
  // Navy band carries the date in paper-white: the day is unmissable.
  fillRect(M, 60, CW, 52, NAVY);
  drawTextCentered(W / 2, 69, 'THURSDAY 19 NOVEMBER 2026', 5, WHITE);
  fillRect(M, 112, CW, 3, GOLD);
  fillRect(M, 115, CW, 4, RED);
  drawTextCentered(W / 2, 126, 'ONE DAY IN ONE PICTURE - THE NEWS THAT MATTERED', 2, NAVY);
  hline(M, 146, CW, INK, 2);
}

function drawPalm(x: number, baseY: number, h: number, c: RGB): void {
  const topX = x + 12, topY = baseY - h;
  // Slightly curved trunk in two segments.
  line(x, baseY, x + 6, baseY - Math.floor(h * 0.55), c, 5);
  line(x + 6, baseY - Math.floor(h * 0.55), topX, topY, c, 4);
  const fronds: Array<[number, number]> = [
    [-38, -4], [-30, -20], [-14, -32], [4, -34], [20, -28], [34, -14], [38, 4],
  ];
  for (const [dx, dy] of fronds) line(topX, topY, topX + dx, topY + dy, c, 3);
  fillCircle(topX - 4, topY + 3, 4, GOLD);
  fillCircle(topX + 5, topY + 4, 4, GOLD);
}

function drawBird(x: number, y: number, c: RGB): void {
  line(x - 8, y + 4, x, y, c, 2);
  line(x, y, x + 8, y + 4, c, 2);
}

function drawHero(): void {
  const x0 = M, y0 = 156, x1 = 560, y1 = 478;
  // Drop shadow, then the scene frame.
  fillRect(x0 + 5, y0 + 6, x1 - x0, y1 - y0, SHADOW);
  frame(x0, y0, x1 - x0, y1 - y0, INK, 2);
  // Layered gradient sky: deep dusk at the top melting into sunset gold.
  const skyTop = y0 + 2, skyBot = y0 + 212;
  const stops: Array<[number, RGB]> = [
    [0, SKY], [0.35, [90, 38, 120]], [0.6, [160, 55, 130]], [0.82, SUNSET], [1, [240, 150, 70]],
  ];
  for (let y = skyTop; y < skyBot; y++) {
    const t = (y - skyTop) / (skyBot - skyTop);
    let c: RGB = stops[0][1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        c = lerpColor(stops[s][1], stops[s + 1][1], (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0]));
        break;
      }
    }
    fillRect(x0 + 2, y, x1 - x0 - 4, 1, c);
  }
  // Sun with a warm glow, low over the skyline.
  fillCircle(294, 282, 78, GLOW1);
  fillCircle(294, 282, 64, GLOW2);
  fillCircle(294, 282, 50, GLOW3);
  fillCircle(294, 282, 38, [255, 228, 165]);
  fillCircle(294, 282, 30, SUNCORE);
  // Birds crossing the dusk.
  drawBird(120, 205, BLDG);
  drawBird(430, 182, BLDG);
  drawBird(368, 222, BLDG);
  // Skyline: varied towers with lit and dark windows, two antennas.
  const skyline: Array<[number, number, number]> = [
    [30, 368, 48], [82, 348, 38], [124, 376, 58], [186, 340, 44], [234, 364, 54],
    [292, 330, 42], [338, 366, 50], [392, 348, 40], [436, 374, 52], [482, 356, 38],
  ];
  skyline.forEach(([bx, top, bw], bi) => {
    fillRect(x0 + bx, top, bw, 412 - top, BLDG);
    for (let wy = top + 10; wy < 404; wy += 14) {
      for (let wx = bx + 7; wx < bx + bw - 6; wx += 14) {
        const lit = ((bx + wy * 3 + wx * 7) % 4) < 2;
        fillRect(x0 + wx, wy, 5, 7, lit ? WINLIT : WINDARK);
      }
    }
    if (bi === 3 || bi === 7) {
      vline(x0 + bx + Math.floor(bw / 2), top - 16, 16, BLDG, 3);
      fillCircle(x0 + bx + Math.floor(bw / 2), top - 18, 3, RED);
    }
  });
  // Neon sign with a pink glow halo.
  fillRect(x0 + 60, 312, 412, 52, [170, 70, 110]);
  fillRect(x0 + 66, 318, 400, 40, [24, 12, 40]);
  frame(x0 + 66, 318, 400, 40, PINK, 2);
  drawTextCentered(294, 328, 'VICE CITY', 3, PINK);
  // Water with a shimmering sun reflection and white glints.
  fillRect(x0 + 2, 412, x1 - x0 - 4, y1 - 412 - 2, SEA);
  for (let i = 0; i < 8; i++) {
    const ry = 420 + i * 7;
    const rw = 110 - i * 10;
    fillRect(294 - Math.floor(rw / 2), ry, rw, 3, i % 2 === 0 ? [255, 200, 110] : [255, 222, 150]);
  }
  const glints = [70, 150, 430, 490, 120, 380, 460];
  glints.forEach((gx, i) => fillRect(x0 + gx, 428 + (i % 3) * 14, 34, 3, WHITE));
  // Palms framing the scene.
  drawPalm(x0 + 44, 412, 96, [20, 40, 26]);
  drawPalm(x1 - 66, 412, 82, [20, 40, 26]);

  // Right-hand story text.
  const tx = 584, tw = 996 - tx;
  drawText(tx, 172, 'CULTURE - THE LEAD STORY', 2, RED);
  drawText(tx, 198, 'GTA VI', 8, INK);
  drawText(tx, 258, 'IS HERE', 8, INK);
  fillRect(tx, 322, tw, 3, INK);
  fillRect(tx, 327, 120, 4, GOLD);
  drawPara(tx, 340, "AFTER 13 YEARS, ROCKSTAR'S GRAND THEFT AUTO VI UNLOCKS AROUND THE WORLD AT MIDNIGHT - NEW ZEALAND FIRST. PS5 AND XBOX, $79.99. PRE-ORDERS TOP $1.5BN.", 2, tw, INK, 19);
  drawText(tx, 448, 'ROLLING MIDNIGHT LAUNCH', 2, RED);
}

function drawIcon(kind: string, cxIn: number, y: number): void {
  const cx = Math.floor(cxIn);
  if (kind === 'ipo') {
    // Rising bar chart with gold-capped bars and a red trend arrow.
    const base = y + 52;
    const heights = [16, 28, 40, 52];
    heights.forEach((h, i) => {
      fillRect(cx - 48 + i * 26, base - h, 18, h, NAVY);
      fillRect(cx - 48 + i * 26, base - h, 18, 4, GOLD);
    });
    hline(cx - 54, base, 112, INK, 2);
    line(cx - 52, base - 16, cx + 52, base - 56, RED, 3);
    fillTriangle(cx + 52, base - 56, cx + 36, base - 56, cx + 52, base - 40, RED);
  } else if (kind === 'law') {
    // Scales of justice between two court pillars.
    vline(cx - 46, y + 6, 42, TEAL, 5);
    vline(cx + 41, y + 6, 42, TEAL, 5);
    hline(cx - 50, y + 2, 100, TEAL, 3);
    vline(cx, y + 6, 40, TEAL, 3);
    hline(cx - 30, y + 10, 60, TEAL, 3);
    fillCircle(cx, y + 6, 4, TEAL);
    line(cx - 30, y + 10, cx - 38, y + 30, TEAL, 2);
    line(cx - 30, y + 10, cx - 22, y + 30, TEAL, 2);
    line(cx + 30, y + 10, cx + 22, y + 30, TEAL, 2);
    line(cx + 30, y + 10, cx + 38, y + 30, TEAL, 2);
    fillTriangle(cx - 46, y + 30, cx - 14, y + 30, cx - 30, y + 42, TEAL);
    fillTriangle(cx + 14, y + 30, cx + 46, y + 30, cx + 30, y + 42, TEAL);
    hline(cx - 16, y + 46, 32, TEAL, 3);
    hline(cx - 50, y + 48, 100, TEAL, 3);
  } else if (kind === 'space') {
    // Ringed planet, orbit path, and a probe beaming home.
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      setPixel(cx + Math.round(Math.cos(a) * 42), y + 24 + Math.round(Math.sin(a) * 13), GOLD);
    }
    fillCircle(cx + 40, y + 12, 7, GOLD);
    line(cx + 33, y + 8, cx + 47, y + 16, [200, 140, 40], 2);
    fillCircle(cx - 24, y + 28, 11, DUSK);
    line(cx - 24, y + 28, cx - 36, y + 44, DUSK, 3);
    line(cx - 24, y + 28, cx - 12, y + 44, DUSK, 3);
    line(cx - 14, y + 20, cx + 26, y + 8, GOLD, 2);
    line(cx - 14, y + 24, cx + 28, y + 16, GOLD, 2);
    drawText(cx - 50, y + 2, '*', 2, DUSK);
    drawText(cx + 6, y + 40, '*', 2, DUSK);
    drawText(cx - 6, y + 44, '*', 2, GOLD);
  } else {
    // Conflict: warning burst inside a dashed ring.
    for (let a = 0; a < 12; a++) {
      const ang = (a * Math.PI) / 6;
      setPixel(cx + Math.round(Math.cos(ang) * 44), y + 22 + Math.round(Math.sin(ang) * 26), RED);
    }
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
// Bento widths by importance: IPO widest, Gaza wide, ICJ and Voyager narrower.
const PANEL_WIDTHS = [260, 220, 224, 240];

function drawPanels(): void {
  const y0 = 492, ph = 296, gap = 8;
  let x = M;
  PANELS.forEach((p, i) => {
    const pw = PANEL_WIDTHS[i];
    // Soft drop shadow for depth.
    fillRect(x + 4, y0 + 5, pw, ph, SHADOW);
    fillRect(x, y0, pw, ph, WHITE);
    frame(x, y0, pw, ph, INK, 2);
    fillRect(x + 2, y0 + 2, pw - 4, 30, p.color);
    fillRect(x + 2, y0 + 32, pw - 4, 3, GOLD);
    drawTextCentered(x + pw / 2, y0 + 10, p.tag, 2, WHITE);
    drawIcon(p.icon, x + pw / 2, y0 + 38);
    const headLines = wrap(p.head, 3, pw - 24);
    headLines.forEach((ln, j) => drawText(x + 12, y0 + 92 + j * 26, ln, 3, INK));
    drawPara(x + 12, y0 + 92 + headLines.length * 26 + 8, p.body, 2, pw - 24, INK, 16);
    x += pw + gap;
  });
}

function drawAlsoToday(): void {
  const y0 = 800, bh = 194;
  fillRect(M + 4, y0 + 5, CW, bh, SHADOW);
  fillRect(M, y0, CW, bh, WHITE);
  frame(M, y0, CW, bh, INK, 2);
  fillRect(M + 2, y0 + 2, CW - 4, 30, INK);
  fillRect(M + 2, y0 + 32, CW - 4, 3, GOLD);
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
    fillRect(x, y + 2, 8, 8, GOLD);
    drawText(x + 14, y, kicker + ' -', 2, RED);
    drawPara(x + 14, y + 20, text, 2, 438, INK, 17);
  });
}

function drawFooter(): void {
  // Sits in the 2 px slot between the Also Today panel and the outer frame.
  drawTextCentered(W / 2, 996, "THURSDAY 19 NOVEMBER 2026 - THE WORLD'S NEWS IN ONE IMAGE", 2, NAVY);
}

// ---------------------------------------------------------------------------
// Entry point: paint the page, encode, write entry.png deterministically.
// ---------------------------------------------------------------------------
function main(): void {
  fillRect(0, 0, W, H, PAPER);
  // Subtle paper texture: sparse darker dots, deterministic.
  for (let yy = 24; yy < H; yy += 11) {
    for (let xx = 24; xx < W; xx += 11) {
      if ((xx * 3 + yy * 7) % 23 === 0) setPixel(xx, yy, [236, 230, 214]);
    }
  }
  // Single outer frame (a second inner frame would cross the footer line).
  frame(10, 10, W - 20, H - 20, INK, 2);
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
