// V4: news-image-20261119 — dense news digest on a newspaper front page.
// Node 22, standard library only. No network. Deterministic: the same bytes
// on every run. Draws the whole image in code and writes entry.png.
// Layout: masthead + dateline, GTA VI lead hero, 6 column stories,
// then a numbered index of 33 more briefs = 40 stories in all.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const PAPER = [244, 237, 218];
const INK = [26, 26, 26];
const RED = [192, 57, 43];
const TEAL = [31, 122, 110];
const BLACK = [12, 12, 16];
const SKY2 = [42, 42, 54];
const MOON = [242, 214, 138];
const GOLD = [212, 175, 55];
const WHITE = [248, 246, 238];

// ---------------------------------------------------------------- font 5x7
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost column).
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  '—': [0, 0, 0, 0x1f, 0, 0, 0],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '€': [0x07, 0x08, 0x1e, 0x08, 0x1e, 0x08, 0x07],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '·': [0, 0, 0, 0x0c, 0x0c, 0, 0],
};

// ---------------------------------------------------------------- png encode
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
const px = Buffer.alloc(W * H * 3);
function setPx(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function hline(x0, x1, y, c, t = 1) { for (let t2 = 0; t2 < t; t2++) for (let x = x0; x <= x1; x++) setPx(x, y + t2, c); }
function vline(x, y0, y1, c, t = 1) { for (let t2 = 0; t2 < t; t2++) for (let y = y0; y <= y1; y++) setPx(x + t2, y, c); }
function rect(x, y, w, h, c, t = 1) {
  hline(x, x + w - 1, y, c, t); hline(x, x + w - 1, y + h - 1, c, t);
  vline(x, y, y + h - 1, c, t); vline(x + w - 1, y, y + h - 1, c, t);
}
function line(x0, y0, x1, y1, c) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) setPx(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), c);
}
function disc(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) setPx(x, cy + dy, c);
  }
}
function ring(cx, cy, rx, ry, c) {
  for (let a = 0; a < 360; a += 3) {
    const t = (a * Math.PI) / 180;
    setPx(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), c);
    setPx(Math.round(cx + rx * Math.cos(t)) + 1, Math.round(cy + ry * Math.sin(t)), c);
  }
}
// Deterministic pseudo-random from coordinates (no Math.random anywhere).
function hash2(a, b) {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- text
function textWidth(s, scale) { return s.length * 6 * scale; }
function drawChar(ch, x, y, scale, c) {
  const g = FONT[ch];
  if (!g) throw new Error('missing glyph: ' + ch);
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if ((g[r] >> (4 - col)) & 1)
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) setPx(x + col * scale + dx, y + r * scale + dy, c);
}
function drawText(s, x, y, scale, c, align = 'l') {
  const u = s.toUpperCase();
  let sx = x;
  if (align === 'c') sx = x - Math.floor(textWidth(u, scale) / 2);
  if (align === 'r') sx = x - textWidth(u, scale);
  for (let i = 0; i < u.length; i++) drawChar(u[i], sx + i * 6 * scale, y, scale, c);
  return sx;
}
// Greedy wrap; throws if a line would exceed maxW (fail loud, never clip).
function wrap(s, maxW, scale) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (textWidth(next, scale) <= maxW) { cur = next; continue; }
    if (!cur) throw new Error('word too wide: ' + w);
    lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- content
// Lead + 6 column stories (verified fresh 19 Nov 2026; see report).
const COLUMNS = [
  { kind: 'flags', label: 'DIPLOMACY — SHENZHEN', headline: 'TRUMP, XI AND PUTIN MEET',
    body: 'First-ever trilateral — nuclear arms and the Iran war top the agenda.' },
  { kind: 'court', label: 'LAW — THE HAGUE', headline: 'WORLD COURT DECIDES TODAY',
    body: 'The ICJ rules on Myanmar — a genocide verdict, a first for any state.' },
  { kind: 'planet', label: 'SPACE', headline: 'VOYAGER 1, ONE LIGHT-DAY AWAY',
    body: "First human-made object a light-day from Earth — NASA's signals take a day." },
  { kind: 'chart', label: 'MARKETS', headline: "ANTHROPIC'S $81.3BN IPO",
    body: 'Priced at $83 — the biggest IPO ever. Trading starts today as ANT.' },
  { kind: 'burst', label: 'CONFLICT', headline: 'GAZA AND CRIMEA UNDER FIRE',
    body: 'Rare Israeli ground operation in Gaza. The Crimean Bridge hit again.' },
  { kind: 'eu', label: 'EUROPE', headline: "EU'S €45BN UKRAINE LOAN",
    body: 'Brussels proposes a €45bn loan for Kyiv, repaid from Russian reparations.' },
];
// 33 numbered briefs: [number, tag, text] — every line must fit its column.
const BRIEFS_A = [
  ['01', 'US', 'Jeffries nominated for Speaker'],
  ['02', 'US', 'Lieu elected caucus chair'],
  ['03', 'ISRAEL', 'Eisenkot tapped to form govt'],
  ['04', 'FRANCE', '4th weekend of cost protests'],
  ['05', 'FRANCE', 'Melenchon could win'],
  ['06', 'CANADA', 'Carney resets China ties'],
  ['07', 'ESTONIA', 'Border with Russia to close'],
  ['08', 'CZECHIA', 'March for media freedom'],
  ['09', 'SPAIN', 'General strike hits ports'],
  ['10', 'UKRAINE', 'Drones amid Abu Dhabi talks'],
  ['11', 'INDIA-JAPAN', '2+2 defence talks open'],
  ['12', 'VENEZUELA', 'US reports $12bn in oil'],
  ['13', 'PAKISTAN', 'Fatah-3 missile tested'],
  ['14', 'US-IRAN', 'Fresh fire in the Gulf'],
  ['15', 'GAZA', 'Four nations demand aid'],
  ['16', 'GAZA', "1,100 amputees' care limited"],
  ['17', 'NVIDIA', 'Pay rises; H-chips halted'],
];
const BRIEFS_B = [
  ['18', 'MICROSOFT', 'AI talks with ByteDance'],
  ['19', 'SENATE', 'AI threats outpace defences'],
  ['20', 'OIL', 'Prices fall as risk rises'],
  ['21', 'AMAZON', '$7bn for India renewables'],
  ['22', 'INDIA', 'Solar at 175 GW, world No. 2'],
  ['23', 'CYCLONE AKVAN', 'Landfall due in India'],
  ['24', 'HEALTH', 'COPD Day: diagnose early'],
  ['25', 'FAITH', 'Largest faith by 2035: Pew'],
  ['26', 'ART', 'Van Gogh sets record $190.4m'],
  ['27', 'FILM', 'Stacy Keach dies at 85'],
  ['28', 'CRICKET', 'Bumrah strikes first ball'],
  ['29', 'CRICKET', 'England win ODI series 2-1'],
  ['30', 'CRICKET', 'Litton Das sets Test record'],
  ['31', 'FOOTBALL', 'India win 10th SAFF title'],
  ['32', 'CRICKET', 'India U19 win by 1 wicket'],
  ['33', 'BADMINTON', 'Sindhu back to No. 5'],
];

// ---------------------------------------------------------------- icons
function iconFlags(x, y) {
  const flags = [
    [[192, 57, 43], [248, 246, 238], [192, 57, 43], [248, 246, 238], [192, 57, 43], [248, 246, 238], [192, 57, 43]],
    [[222, 41, 16], [222, 41, 16], [222, 41, 16], [222, 41, 16], [222, 41, 16], [222, 41, 16], [222, 41, 16]],
    [[248, 246, 238], [248, 246, 238], [31, 90, 180], [31, 90, 180], [192, 57, 43], [192, 57, 43], [192, 57, 43]],
  ];
  for (let f = 0; f < 3; f++) {
    const fx = x + f * 16;
    vline(fx, y, y + 15, INK);
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 13; c++) setPx(fx + 1 + c, y + r, flags[f][r]);
    setPx(fx + 3, y + 2, GOLD); setPx(fx + 4, y + 2, GOLD);
  }
}
function iconCourt(x, y) {
  line(x + 2, y + 6, x + 16, y + 6, INK);
  line(x + 2, y + 6, x + 9, y + 1, INK);
  line(x + 16, y + 6, x + 9, y + 1, INK);
  hline(x + 1, x + 17, y + 7, INK);
  for (const cx of [4, 9, 14]) vline(x + cx, y + 8, y + 14, INK);
  hline(x + 1, x + 17, y + 15, INK);
}
function iconPlanet(x, y) {
  disc(x + 9, y + 8, 5, TEAL);
  ring(x + 9, y + 8, 9, 3, GOLD);
  disc(x + 18, y + 3, 1, RED);
}
function iconChart(x, y) {
  const bars = [5, 9, 13];
  for (let i = 0; i < 3; i++) fillRect(x + 2 + i * 6, y + 16 - bars[i], 4, bars[i], INK);
  line(x + 1, y + 10, x + 17, y + 2, RED);
  line(x + 17, y + 2, x + 13, y + 2, RED);
  line(x + 17, y + 2, x + 17, y + 6, RED);
}
function iconBurst(x, y) {
  const cx = x + 9, cy = y + 8;
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    line(cx, cy, Math.round(cx + 8 * Math.cos(t)), Math.round(cy + 8 * Math.sin(t)), RED);
  }
  disc(cx, cy, 2, INK);
}
function iconEU(x, y) {
  fillRect(x, y, 18, 16, TEAL);
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    disc(Math.round(x + 9 + 6 * Math.cos(t)), Math.round(y + 8 + 6 * Math.sin(t)), 1, GOLD);
  }
}
function drawIcon(kind, x, y) {
  if (kind === 'flags') iconFlags(x, y);
  else if (kind === 'court') iconCourt(x, y);
  else if (kind === 'planet') iconPlanet(x, y);
  else if (kind === 'chart') iconChart(x, y);
  else if (kind === 'burst') iconBurst(x, y);
  else if (kind === 'eu') iconEU(x, y);
}

// ---------------------------------------------------------------- hero scene
function drawHero(x0, y0, w, h) {
  fillRect(x0, y0, w, h, BLACK);
  for (let i = 0; i < 260; i++) {
    const sx = x0 + (hash2(i, 7) % w);
    const sy = y0 + (hash2(i, 13) % Math.floor(h * 0.55));
    const b = hash2(i, 29) % 3;
    setPx(sx, sy, b === 0 ? GOLD : WHITE);
  }
  disc(x0 + w - 90, y0 + 26, 15, MOON);
  disc(x0 + w - 96, y0 + 22, 3, [214, 186, 110]);
  disc(x0 + w - 84, y0 + 30, 2, [214, 186, 110]);
  // Skyline, two layers.
  let bx = x0 + 8;
  let bi = 0;
  while (bx < x0 + w - 10) {
    const bw = 26 + (hash2(bi, 3) % 30);
    const bh = 26 + (hash2(bi, 5) % 42);
    fillRect(bx, y0 + h - 34 - bh, bw, bh, SKY2);
    for (let wy = y0 + h - 30 - bh; wy < y0 + h - 38; wy += 7)
      for (let wx = bx + 4; wx < bx + bw - 3; wx += 8)
        if (hash2(wx, wy) % 3 === 0) fillRect(wx, wy, 2, 3, GOLD);
    bx += bw + 4;
    bi++;
  }
  // Neon sign.
  const sw = 150, sh = 26, sx = x0 + Math.floor((w - sw) / 2), sy = y0 + 34;
  fillRect(sx, sy, sw, sh, [40, 8, 12]);
  rect(sx, sy, sw, sh, RED, 2);
  drawText('VICE CITY', sx + Math.floor(sw / 2), sy + 6, 2, RED, 'c');
  // Palms at the edges (silhouette gray so they read against the night sky).
  const PALM = [96, 96, 110];
  for (const px0 of [x0 + 26, x0 + w - 30]) {
    line(px0, y0 + h - 34, px0 + 4, y0 + h - 66, PALM);
    for (let a = 0; a < 5; a++) {
      const t = Math.PI * (0.15 + a * 0.18);
      line(px0 + 4, y0 + h - 66, Math.round(px0 + 4 + 20 * Math.cos(t + 2.4)), Math.round(y0 + h - 66 - 14 * Math.sin(t)), PALM);
    }
  }
  // Street + red car.
  fillRect(x0, y0 + h - 26, w, 26, [16, 16, 20]);
  for (let dx = x0 + 10; dx < x0 + w - 10; dx += 44) hline(dx, dx + 22, y0 + h - 13, WHITE);
  const cx = x0 + Math.floor(w / 2) - 24;
  fillRect(cx, y0 + h - 24, 48, 10, RED);
  fillRect(cx + 10, y0 + h - 31, 26, 8, RED);
  disc(cx + 10, y0 + h - 13, 4, BLACK);
  disc(cx + 38, y0 + h - 13, 4, BLACK);
  disc(cx + 10, y0 + h - 13, 2, [120, 120, 120]);
  disc(cx + 38, y0 + h - 13, 2, [120, 120, 120]);
  // Fireworks.
  for (const fx of [x0 + 70, x0 + w - 74]) {
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4;
      line(fx, y0 + 52, Math.round(fx + 12 * Math.cos(t)), Math.round(y0 + 52 + 12 * Math.sin(t)), WHITE);
    }
  }
}

// ---------------------------------------------------------------- layout
function drawColumn(col, x, cy) {
  drawIcon(col.kind, x + 2, cy + 2);
  drawText(col.label, x, cy + 24, 2, RED);
  const head = wrap(col.headline, 322, 3);
  if (head.length > 2) throw new Error('headline wraps to ' + head.length + ': ' + col.headline);
  head.forEach((ln, i) => drawText(ln, x, cy + 42 + i * 23, 3, INK));
  const body = wrap(col.body, 322, 2);
  if (body.length > 3) throw new Error('body wraps to ' + body.length + ': ' + col.body);
  body.forEach((ln, i) => drawText(ln, x, cy + 88 + i * 16, 2, INK));
}
function drawBrief(num, tag, text, x, y, colW) {
  let cx = x;
  drawText(num, cx, y, 2, RED);
  cx += textWidth(num + ' ', 2);
  drawText(tag, cx, y, 2, RED);
  cx += textWidth(tag + ' ', 2);
  const line = '— ' + text;
  if (cx + textWidth(line, 2) > x + colW) throw new Error('brief overflows: ' + num + ' ' + tag + ' ' + text);
  drawText(line, cx, y, 2, INK);
}

function render() {
  for (let i = 0; i < W * H; i++) { px[i * 3] = PAPER[0]; px[i * 3 + 1] = PAPER[1]; px[i * 3 + 2] = PAPER[2]; }
  // Frame.
  rect(6, 6, W - 12, H - 12, INK, 2);
  rect(11, 11, W - 22, H - 22, INK, 1);
  // Masthead.
  drawText('THE WORLD', 512, 18, 12, INK, 'c');
  drawText('VOL. CXLIV', 18, 56, 2, INK);
  drawText('No. 287', 1006, 56, 2, INK, 'r');
  hline(18, 1006, 106, INK, 2);
  drawText('EST. 1882', 18, 112, 2, INK);
  drawText('THURSDAY, 19 NOVEMBER 2026', 512, 110, 3, INK, 'c');
  drawText('40 STORIES', 1006, 112, 2, RED, 'r');
  hline(18, 1006, 132, INK, 2);
  // Lead.
  drawText('CULTURE — THE LEAD STORY', 512, 140, 2, RED, 'c');
  drawText('GRAND THEFT AUTO VI', 512, 162, 6, INK, 'c');
  drawText('IS HERE', 512, 206, 6, INK, 'c');
  const deck = wrap("AFTER 13 YEARS, ROCKSTAR'S GRAND THEFT AUTO VI UNLOCKS AT MIDNIGHT — NEW ZEALAND FIRST. PS5 AND XBOX, $79.99. PRE-ORDERS TOP $1.5BN. 99 OF 100.", 980, 2);
  deck.forEach((ln, i) => drawText(ln, 512, 252 + i * 18, 2, INK, 'c'));
  // Hero.
  drawHero(18, 290, 988, 110);
  drawText('MIDNIGHT QUEUES FROM AUCKLAND TO LOS ANGELES AS THE EPIC UNLOCKS WORLDWIDE.', 512, 404, 2, INK, 'c');
  // Columns, two rows of three.
  const colX = [18, 353, 688];
  const colY = [422, 566];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) drawColumn(COLUMNS[r * 3 + c], colX[c], colY[r]);
  vline(345, 422, 702, INK);
  vline(680, 422, 702, INK);
  hline(18, 1006, 560, INK);
  // Brief index header.
  fillRect(18, 706, 988, 24, INK);
  drawText('THE DAY IN BRIEF — 33 MORE STORIES', 26, 711, 2, WHITE);
  drawText('01 — 33', 998, 711, 2, WHITE, 'r');
  // Briefs, two columns of 17 and 16.
  const briefY0 = 738, lead = 15;
  BRIEFS_A.forEach(([n, t, s], i) => drawBrief(n, t, s, 18, briefY0 + i * lead, 489));
  BRIEFS_B.forEach(([n, t, s], i) => drawBrief(n, t, s, 520, briefY0 + i * lead, 486));
  // Footer.
  hline(18, 1006, 996, INK);
  drawText("THURSDAY 19 NOVEMBER 2026 — THE WORLD'S NEWS IN ONE IMAGE", 512, 998, 2, INK, 'c');
}

function main() {
  render();
  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(out, { recursive: true });
  const png = encodePNG(px, W, H);
  writeFileSync(join(out, 'entry.png'), png);
  console.log('wrote entry.png', png.length, 'bytes');
}
main();
