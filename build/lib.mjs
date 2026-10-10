// lib.mjs —— 画面绘制原语（1920x1080）
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";

export const W = 1920, H = 1080;

export const COL = {
  bg0: "#061726", bg1: "#0B2A45", bg2: "#14456F",
  ink: "#EAF2F8", dim: "#8FB8D8", faint: "#5A7E9E",
  accent: "#4FA8D8", deep: "#0B2A45", cream: "#F5F1E8",
  green: "#3FB27F", yellow: "#E8B33C", orange: "#E2803A", red: "#D9534F",
  panel: "rgba(255,255,255,0.045)", panel2: "rgba(255,255,255,0.09)",
};

export function registerFonts() {
  const F = "C:\\Windows\\Fonts\\";
  const ok = [];
  try { GlobalFonts.registerFromPath(F + "msyh.ttc", "YH"); ok.push("YH"); } catch { }
  try { GlobalFonts.registerFromPath(F + "msyhbd.ttc", "YHB"); ok.push("YHB"); } catch { }
  try { GlobalFonts.registerFromPath(F + "consola.ttf", "MONO"); ok.push("MONO"); } catch { }
  try { GlobalFonts.registerFromPath(F + "consolab.ttf", "MONOB"); ok.push("MONOB"); } catch { }
  return ok;
}

export const font = (size, weight = "", mono = false) =>
  `${weight === "bold" ? "bold " : ""}${size}px ${mono ? (weight === "bold" ? "MONOB" : "MONO") : (weight === "bold" ? "YHB" : "YH")}`;

export function newCanvas() {
  const c = createCanvas(W, H);
  return [c, c.getContext("2d")];
}

export function paintBg(x, seed = 0) {
  const g = x.createLinearGradient(0, 0, W * 0.75, H);
  g.addColorStop(0, COL.bg1);
  g.addColorStop(1, COL.bg2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 底部深海暗角
  const g2 = x.createRadialGradient(W * 0.5, H * 1.15, 100, W * 0.5, H * 1.15, H * 1.1);
  g2.addColorStop(0, "rgba(6,23,38,0.85)"); g2.addColorStop(1, "rgba(6,23,38,0)");
  x.fillStyle = g2; x.fillRect(0, 0, W, H);
  // 细网格
  x.strokeStyle = "rgba(143,184,216,0.055)"; x.lineWidth = 1;
  for (let gx = 80; gx < W; gx += 80) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
  for (let gy = 80; gy < H; gy += 80) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
}

export function rr(x, px, py, pw, ph, r, fill, stroke, lw = 2) {
  x.beginPath(); x.roundRect(px, py, pw, ph, r);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

export function text(x, s, px, py, o = {}) {
  // 等宽字体（Consolas）没有中文字形，含中文时自动回退到雅黑
  const mono = o.mono && !CJK.test(s);
  x.font = font(o.size || 32, o.weight || "", mono);
  x.fillStyle = o.color || COL.ink;
  x.textAlign = o.align || "left";
  x.textBaseline = o.base || "alphabetic";
  if (o.alpha != null) { const a = x.globalAlpha; x.globalAlpha = a * o.alpha; x.fillText(s, px, py); x.globalAlpha = a; }
  else x.fillText(s, px, py);
}

export function measure(x, s, size, mono = false, weight = "") {
  x.font = font(size, weight, mono && !CJK.test(s));
  return x.measureText(s).width;
}

// 逐字换行（中文友好）
export function wrap(x, s, maxW, size, weight = "", mono = false) {
  x.font = font(size, weight, mono && !CJK.test(s));
  const out = []; let cur = "";
  for (const ch of s) {
    if (ch === "\n") { out.push(cur); cur = ""; continue; }
    const t = cur + ch;
    if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = ch; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

export function para(x, s, px, py, maxW, o = {}) {
  const lh = o.lh || (o.size || 32) * 1.55;
  const lines = wrap(x, s, maxW, o.size || 32, o.weight || "", o.mono || false);
  lines.forEach((l, i) => text(x, l, px, py + i * lh, o));
  return py + lines.length * lh;
}

export function dot(x, px, py, r, color) {
  x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = color; x.fill();
}

export function hline(x, px, py, pw, color = "rgba(143,184,216,0.35)", lw = 2, dash = null) {
  x.beginPath(); if (dash) x.setLineDash(dash);
  x.moveTo(px, py); x.lineTo(px + pw, py);
  x.strokeStyle = color; x.lineWidth = lw; x.stroke(); x.setLineDash([]);
}

export function vline(x, px, py, ph, color = "rgba(143,184,216,0.35)", lw = 2, dash = null) {
  x.beginPath(); if (dash) x.setLineDash(dash);
  x.moveTo(px, py); x.lineTo(px, py + ph);
  x.strokeStyle = color; x.lineWidth = lw; x.stroke(); x.setLineDash([]);
}

export const TONE = { green: COL.green, yellow: COL.yellow, orange: COL.orange, red: COL.red, blue: COL.accent, dim: COL.faint };

// 通用卡片
export function card(x, px, py, pw, ph, o = {}) {
  rr(x, px, py, pw, ph, o.r == null ? 16 : o.r, o.fill || COL.panel, o.stroke || "rgba(143,184,216,0.18)", o.lw || 2);
  if (o.accent) { rr(x, px, py, 6, ph, 3, TONE[o.accent] || o.accent); }
  let cy = py + (o.pad == null ? 30 : o.pad);
  if (o.title) {
    text(x, o.title, px + (o.pad == null ? 30 : o.pad) + (o.accent ? 12 : 0), cy + (o.titleSize || 30), { size: o.titleSize || 30, weight: "bold", color: o.titleColor || COL.ink });
    cy += (o.titleSize || 30) + 16;
    if (o.titleRule !== false) { hline(x, px + (o.pad == null ? 30 : o.pad) + (o.accent ? 12 : 0), cy + 4, pw - (o.pad == null ? 60 : o.pad * 2) - (o.accent ? 12 : 0), "rgba(143,184,216,0.22)", 2); cy += 26; }
  }
  o._cy = cy;
  return cy;
}

// ⚪ 数据缺口卡：半透明虚线 + 问号
export function gapCard(x, px, py, pw, ph, label, o = {}) {
  x.save();
  x.setLineDash([12, 9]); rr(x, px, py, pw, ph, 14, "rgba(255,255,255,0.035)", "rgba(143,184,216,0.5)", 2.5); x.setLineDash([]);
  x.globalAlpha = 0.10; text(x, "?", px + pw - 88, py + 96, { size: 130, weight: "bold", color: COL.cream });
  x.globalAlpha = 1;
  para(x, label, px + 26, py + (o.top || 46), pw - 52, { size: o.size || 25, color: "rgba(234,242,248,0.80)", lh: (o.size || 25) * 1.45 });
  x.restore();
}

// 横向条形
export function hbar(x, px, py, pw, o) {
  const max = o.max || 100, bh = o.bh || 26;
  const w = Math.max(3, pw * Math.abs(o.value) / max);
  rr(x, px, py, pw, bh, bh / 2, "rgba(255,255,255,0.07)");
  rr(x, px, py, w, bh, bh / 2, o.color || COL.accent);
  if (o.label) text(x, o.label, px - 16, py + bh * 0.78, { size: o.size || 25, color: COL.dim, align: "right" });
  if (o.valueText) text(x, o.valueText, px + pw + 18, py + bh * 0.78, { size: o.size || 26, weight: "bold", color: o.valueColor || COL.ink, mono: true });
  return py + bh;
}

// 表格
export function table(x, px, py, pw, o) {
  const cols = o.cols, rows = o.rows, fs = o.size || 27;
  const widths = o.widths || cols.map(() => pw / cols.length);
  const rowH = o.rowH || 58;
  let cy = py;
  if (o.head !== false) {
    x.fillStyle = "rgba(79,168,216,0.18)"; x.beginPath(); x.roundRect(px, cy, pw, rowH, 10); x.fill();
    let cx = px + 20;
    cols.forEach((c, i) => { text(x, c, cx, cy + rowH * 0.68, { size: fs, weight: "bold", color: COL.accent, align: o.aligns ? o.aligns[i] : "left" }); cx += widths[i]; });
    cy += rowH + 4;
  }
  rows.forEach((r, ri) => {
    if (ri % 2 === 1) { x.fillStyle = "rgba(255,255,255,0.035)"; x.fillRect(px, cy, pw, rowH); }
    let cx = px + 20;
    r.forEach((cell, i) => {
      const cd = (typeof cell === "object" && cell) ? cell : { s: String(cell) };
      const align = o.aligns ? o.aligns[i] : "left";
      if (cd.tone) { const bw = widths[i] - 26; rr(x, cx - 4, cy + rowH * 0.5 - 17, Math.min(bw, Math.max(90, measure(x, cd.s, fs - 3, cd.mono) + 30)), 34, 17, TONE[cd.tone] || cd.tone); }
      text(x, cd.s, cx, cy + rowH * 0.68, {
        size: cd.size || (cd.tone ? fs - 3 : fs), weight: cd.weight || (cd.tone ? "bold" : ""),
        color: cd.tone ? "#08243A" : (cd.color || COL.ink), mono: cd.mono, align,
      });
      if (i < r.length - 1) cx += widths[i];
    });
    cy += rowH;
    if (o.grid !== false) hline(x, px, cy, pw, "rgba(143,184,216,0.13)", 1.5);
  });
  return cy;
}

export function header(x, o) {
  rr(x, 0, 0, W, 8, 0, COL.accent);
  text(x, o.idx, 80, 108, { size: 40, weight: "bold", color: COL.accent, mono: true });
  text(x, o.title, 190, 110, { size: 46, weight: "bold", color: COL.ink });
  if (o.sub) text(x, o.sub, 190 + measure(x, o.title, 46, false, "bold") + 28, 108, { size: 28, color: COL.dim });
  hline(x, 80, 142, W - 160, "rgba(143,184,216,0.30)", 2);
  return 190;
}

export function footer(x, o = {}) {
  hline(x, 80, 928, W - 160, "rgba(143,184,216,0.18)", 2);
  text(x, o.left || "大肥鱼女仆 · 南沙地质风险", 80, 968, { size: 22, color: COL.faint });
  if (o.right) text(x, o.right, W - 80, 968, { size: 22, color: COL.faint, align: "right" });
  if (o.right2) text(x, o.right2, W - 80, 1000, { size: 21, color: "rgba(143,184,216,0.55)", align: "right" });
}

// 角色贴图（透明 PNG）
export function drawChar(x, img, px, py, targetH, flip = false) {
  if (!img) return;
  const s = targetH / img.height, w = img.width * s;
  x.save();
  if (flip) { x.translate(px + w, py); x.scale(-1, 1); x.drawImage(img, 0, 0, w, targetH); }
  else x.drawImage(img, px, py, w, targetH);
  x.restore();
}

export function arrow(x, x1, y1, x2, y2, color = COL.orange, lw = 4, head = 16) {
  x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.strokeStyle = color; x.lineWidth = lw; x.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  x.beginPath(); x.moveTo(x2, y2);
  x.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
  x.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
  x.closePath(); x.fillStyle = color; x.fill();
}

export function polyline(x, pts, color, lw = 5, dash = null) {
  x.beginPath(); if (dash) x.setLineDash(dash);
  pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]));
  x.strokeStyle = color; x.lineWidth = lw; x.stroke(); x.setLineDash([]);
}

export function save(c, path) {
  fs.writeFileSync(path, c.toBuffer("image/png"));
}

export async function loadPNG(p) { try { return await loadImage(p); } catch { return null; } }
