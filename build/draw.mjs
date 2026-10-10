// draw.mjs —— 把场景数据翻译成画面
import {
  W, H, COL, TONE, text, para, wrap, measure, rr, card, gapCard, hbar, table,
  header, footer, drawChar, hline, vline, dot, arrow, polyline, newCanvas, paintBg,
} from "./lib.mjs";

const PAD = 80;

// ── 自定义图形 ─────────────────────────────────────────────

function drawMap(x, a) {              // 南沙位置分区示意
  const { px, py, pw, ph } = a;
  rr(x, px, py, pw, ph, 18, "rgba(79,168,216,0.10)", "rgba(143,184,216,0.35)", 2);
  // 珠江口海面
  x.save(); x.beginPath(); x.roundRect(px, py, pw, ph, 18); x.clip();
  x.fillStyle = "rgba(20,69,111,0.75)"; x.fillRect(px, py + ph * 0.62, pw, ph * 0.38);
  x.restore();
  text(x, "珠 江 口", px + pw - 26, py + ph - 24, { size: 26, color: "rgba(143,184,216,0.55)", align: "right" });
  // 中部片区
  rr(x, px + 40, py + 46, pw - 80, ph * 0.34, 14, "rgba(232,179,60,0.16)", "rgba(232,179,60,0.6)", 2);
  text(x, "中部 · 蕉门河 / 金洲 / 黄阁", px + 64, py + 92, { size: 27, weight: "bold", color: COL.yellow });
  text(x, "软土 20–40 m，属次一级", px + 64, py + 132, { size: 24, color: COL.dim });
  // 南沙湾
  rr(x, px + pw - 300, py + ph * 0.30, 250, 64, 12, "rgba(232,179,60,0.16)", "rgba(232,179,60,0.6)", 2);
  text(x, "南沙湾 · 沉降中心之一", px + pw - 176, py + ph * 0.30 + 42, { size: 22, color: COL.yellow, align: "center" });
  // 南部高易发区
  rr(x, px + 40, py + ph * 0.50, pw - 80, ph * 0.36, 14, "rgba(217,83,79,0.18)", "rgba(217,83,79,0.75)", 3);
  text(x, "南部 · 万顷沙 / 新垦 / 龙穴岛", px + 64, py + ph * 0.50 + 52, { size: 30, weight: "bold", color: COL.red });
  text(x, "官方认定的地面沉降高易发区 ｜ 软土 >40 m，最厚 55–58 m", px + 64, py + ph * 0.50 + 96, { size: 24, color: "rgba(255,255,255,0.82)" });
  text(x, "风险从这里长出来", px + 64, py + ph * 0.50 + 140, { size: 24, color: COL.orange });
  arrow(x, px + pw - 90, py + ph * 0.50 + 30, px + pw - 90, py + ph * 0.86, COL.red, 4, 14);
}

function drawProfile(x, a) {          // 地层剖面柱状
  const { px, py, pw, ph } = a;
  const layers = [
    { n: "素填土", t: "0.3–10.2 m", c: "#8A7A63", h: 0.09 },
    { n: "淤泥（流塑）", t: "0.7–30.1 m", c: "#3E6B8C", h: 0.30, hot: true },
    { n: "淤泥（软塑）", t: "0.7–20.0 m", c: "#4E7FA3", h: 0.20, hot: true },
    { n: "淤泥质粉砂 / 粉质黏土 / 砂", t: "—", c: "#6E92A8", h: 0.16 },
    { n: "残积粉质黏土", t: "—", c: "#9A8A6E", h: 0.10 },
    { n: "全 / 强 / 弱风化花岗片麻岩（基岩）", t: "全风化顶板平均埋深 31.96 m", c: "#B8A98C", h: 0.15, bed: true },
  ];
  text(x, "南沙港区典型地层剖面", px, py - 16, { size: 28, weight: "bold", color: COL.accent });
  let cy = py + 8;
  layers.forEach((L) => {
    const hh = ph * L.h;
    rr(x, px, cy, pw, hh, 4, L.c);
    if (L.hot) { rr(x, px, cy, 6, hh, 3, COL.orange); }
    if (L.bed) { rr(x, px, cy, 6, hh, 3, COL.cream); }
    const tw = wrap(x, L.n, pw - 40, 23);
    tw.forEach((ln, i) => text(x, ln, px + 18, cy + 30 + i * 28, { size: 23, weight: "bold", color: "#0A1A26" }));
    text(x, L.t, px + pw - 16, cy + hh - 12, { size: 20, color: "rgba(10,26,38,0.82)", align: "right", mono: true });
    cy += hh + 3;
  });
  // 深度标尺
  vline(x, px - 26, py + 8, ph + 8, "rgba(143,184,216,0.5)", 2);
  [0, 20, 40, 60, 76.1].forEach((d, i) => {
    const yy = py + 8 + (ph + 8) * (d / 76.1);
    hline(x, px - 34, yy, 10, "rgba(143,184,216,0.5)", 2);
    text(x, d + " m", px - 42, yy + 8, { size: 20, color: COL.faint, align: "right", mono: true });
  });
}

function drawRace(x, a) {             // 沉降 vs 海平面 赛跑图
  const { px, py, pw, ph } = a;
  const years = 50, y0 = py + ph, x0 = px;
  const sx = (yr) => x0 + pw * (yr / years);
  const sy = (mm) => y0 - (ph * mm / 500);
  // 网格 + 刻度
  [0, 100, 200, 300, 400, 500].forEach((mm) => {
    hline(x, x0, sy(mm), pw, "rgba(143,184,216,0.16)", 1.5);
    text(x, mm + " mm", x0 - 14, sy(mm) + 8, { size: 20, color: COL.faint, align: "right", mono: true });
  });
  [0, 10, 20, 30, 40, 50].forEach((yr) => {
    vline(x, sx(yr), y0, 12, "rgba(143,184,216,0.4)", 2);
    text(x, yr + (yr === 0 ? "" : " 年"), sx(yr), y0 + 40, { size: 20, color: COL.faint, align: "center", mono: true });
  });
  vline(x, x0, py - 10, ph + 10, "rgba(143,184,216,0.45)", 2.5);
  // 海平面 3.5mm/年
  polyline(x, [[sx(0), sy(0)], [sx(50), sy(175)]], COL.accent, 6);
  dot(x, sx(50), sy(175), 10, COL.accent);
  text(x, "海平面上升 3.5 mm/年", sx(50) - 16, sy(175) - 24, { size: 27, weight: "bold", color: COL.accent, align: "right" });
  text(x, "50 年 ≈ 175 mm", sx(50) - 16, sy(175) + 34, { size: 22, color: "rgba(79,168,216,0.85)", align: "right", mono: true });
  // 沉降 9.45mm/年
  polyline(x, [[sx(0), sy(0)], [sx(50), sy(472.5)]], COL.red, 7);
  dot(x, sx(50), sy(472.5), 12, COL.red);
  text(x, "地面沉降 9.45 mm/年", sx(50) + 6, sy(472.5) - 20, { size: 30, weight: "bold", color: COL.red });
  text(x, "50 年 ≈ 470 mm（47 cm）", sx(50) + 6, sy(472.5) + 30, { size: 24, color: "rgba(217,83,79,0.9)", mono: true });
  // 2.7 倍标注
  const midY = (sy(175) + sy(472.5)) / 2;
  vline(x, sx(34), sy(119), sy(321) - sy(119), "rgba(255,255,255,0.5)", 2, [9, 7]);
  rr(x, sx(34) - 78, midY - 44, 156, 62, 14, COL.cream);
  text(x, "快 2.7 倍", sx(34), midY - 2, { size: 30, weight: "bold", color: "#0B2A45", align: "center" });
}

function drawElevation(x, a) {        // 高程 / 高潮位标尺
  const { px, py, pw, ph } = a;
  rr(x, px, py, pw, ph, 18, "rgba(255,255,255,0.04)", "rgba(143,184,216,0.3)", 2);
  const top = py + 76, bot = py + ph - 54;
  const yOf = (m) => bot - (bot - top) * ((m + 1.2) / 8.2);   // −1.2 … 7.0 m
  // 海面（右侧，填到高潮位）
  x.save(); x.beginPath(); x.roundRect(px, py, pw, ph, 18); x.clip();
  x.fillStyle = "rgba(79,168,216,0.26)";
  x.fillRect(px + pw * 0.66, yOf(5.66), pw * 0.34, bot - yOf(5.66));
  x.restore();
  // 左侧刻度
  [-1, 0, 1, 2, 3, 4, 5, 6].forEach((m) => {
    hline(x, px + 74, yOf(m), pw - 100, m === 0 ? "rgba(143,184,216,0.38)" : "rgba(143,184,216,0.13)", m === 0 ? 2.5 : 1.5);
    text(x, (m > 0 ? "+" : "") + m, px + 60, yOf(m) + 8, { size: 20, color: COL.faint, align: "right", mono: true });
  });
  text(x, "珠基高程 (m)", px + 16, py + 44, { size: 22, color: COL.dim });
  // 陆地剖面：平原区 +5 m 缓降到围垦区 −0.55 m
  x.beginPath();
  x.moveTo(px + 74, yOf(2.0)); x.lineTo(px + pw * 0.34, yOf(1.2));
  x.lineTo(px + pw * 0.62, yOf(-0.55)); x.lineTo(px + pw * 0.66, yOf(-0.55));
  x.lineTo(px + pw * 0.66, bot + 16); x.lineTo(px + 74, bot + 16);
  x.closePath(); x.fillStyle = "rgba(184,169,140,0.85)"; x.fill();
  // 堤防（细墙）
  x.fillStyle = "rgba(245,241,232,0.94)";
  x.fillRect(px + pw * 0.62, yOf(6.2), pw * 0.045, bot + 16 - yOf(6.2));
  text(x, "堤防", px + pw * 0.585, yOf(3.4), { size: 22, weight: "bold", color: COL.cream, align: "right" });
  // 陆面标注
  text(x, "南沙平原区", px + 96, yOf(1.35), { size: 23, weight: "bold", color: "#0A1A26" });
  text(x, "珠基 −1 ~ +2 m", px + 96, yOf(0.55), { size: 21, color: "rgba(10,26,38,0.8)", mono: true });
  text(x, "围垦区田面 −0.4 ~ −0.7 m", px + pw * 0.60, yOf(-0.55) + 40, { size: 23, weight: "bold", color: "#FFFFFF", align: "right" });
  // 高潮位线
  hline(x, px + 74, yOf(5.66), pw - 100, COL.accent, 4);
  text(x, "平均高潮位 5.66 m", px + pw - 24, yOf(5.66) - 14, { size: 24, weight: "bold", color: COL.accent, align: "right" });
  // 落差箭头
  arrow(x, px + pw * 0.72, yOf(5.66) + 10, px + pw * 0.72, yOf(-0.4) - 10, COL.orange, 3.5, 13);
  text(x, "田面比高潮位低 6 米多", px + pw * 0.75, (yOf(5.66) + yOf(-0.4)) / 2, { size: 22, weight: "bold", color: COL.orange });
  text(x, "设防标准 不低于 200 年一遇", px + pw - 24, py + 52, { size: 22, color: COL.dim, align: "right" });
}

function drawPile(x, a) {             // 桩基剖面
  const { px, py, pw, ph } = a;
  rr(x, px, py, pw, ph, 18, "rgba(255,255,255,0.04)", "rgba(143,184,216,0.3)", 2);
  text(x, "桩穿过什么", px + 24, py + 46, { size: 28, weight: "bold", color: "#4FA8D8" });
  arrow(x, px + 24, py + 74, px + 24, py + 96, COL.orange, 3.5, 13);
  text(x, "周围软土下沉，把桩身往下拽 —— 负摩阻力系数 0.15–0.24", px + 40, py + 94, { size: 22, weight: "bold", color: COL.orange });
  text(x, "勘察报告提示了 5 次", px + 40, py + 122, { size: 20, color: "rgba(226,128,58,0.85)" });

  const cx0 = px + 250, cw = 370, cy0 = py + 152, ch = ph - 224;
  const bands = [
    { h: 0.16, c: "#8A7A63", n: "素填土 / 回填土", d: "0.3–10.2 m" },
    { h: 0.32, c: "#3E6B8C", n: "淤泥（流塑）", d: "0.7–30.1 m" },
    { h: 0.20, c: "#4E7FA3", n: "淤泥（软塑）", d: "0.7–20.0 m" },
    { h: 0.14, c: "#6E92A8", n: "砂 / 残积土", d: "—" },
    { h: 0.18, c: "#B8A98C", n: "强 / 中风化花岗岩", d: "基岩" },
  ];
  let cy = cy0;
  bands.forEach((b) => {
    const hh = ch * b.h;
    rr(x, cx0, cy, cw, hh - 3, 4, b.c);
    text(x, b.n, cx0 - 18, cy + hh / 2 + 8, { size: 23, weight: "bold", color: COL.cream, align: "right" });
    text(x, b.d, cx0 + cw + 18, cy + hh / 2 + 8, { size: 21, color: COL.dim, mono: true });
    cy += hh;
  });
  // 桩体
  const pileX = cx0 + 150, pileW = 44;
  const bedTop = cy0 + ch * 0.82;
  rr(x, pileX, py + 132, pileW, bedTop - py - 132 + 118, 6, "#F5F1E8");
  text(x, "桩", pileX + pileW / 2, py + 122, { size: 30, weight: "bold", color: "#F5F1E8", align: "center" });
  // 基岩顶板线
  hline(x, cx0, bedTop, cw, "rgba(245,241,232,0.75)", 2.5, [9, 7]);
  text(x, "全风化顶板平均埋深 31.96 m", px + pw - 24, bedTop - 12, { size: 20, weight: "bold", color: COL.cream, align: "right" });
  // 桩长标注（放在地层柱下方空白区）
  text(x, "30–60 m", px + 24, py + ph - 62, { size: 26, weight: "bold", color: COL.cream, mono: true });
  text(x, "打到基岩或强/中风化层 = 刚性支撑", px + 24, py + ph - 28, { size: 21, color: "rgba(245,241,232,0.8)" });
}

function drawTimeline(x, a) {         // 案例时间轴
  const { px, py, pw, ph } = a;
  const y0 = py + 72;
  hline(x, px + 30, y0, pw - 60, "rgba(143,184,216,0.45)", 3);
  const years = [2012, 2013, 2015, 2018, 2020, 2022, 2023, 2024, 2025];
  years.forEach((yr) => {
    const tx = px + 30 + (pw - 60) * ((yr - 2012) / 13);
    vline(x, tx, y0 - 10, 20, "rgba(143,184,216,0.4)", 2);
    text(x, String(yr), tx, y0 - 26, { size: 21, color: COL.faint, align: "center", mono: true });
  });
  const marks = [
    { yr: 2012, t: "某小区", d: "省地质调查院：一年下沉 15 cm", c: COL.yellow, up: false },
    { yr: 2013, t: "临河小区", d: "商铺裂缝数百米、最宽近 20 cm", c: COL.red, up: true },
    { yr: 2024, t: "临河小区", d: "再次沉降，街道确认", c: COL.red, up: false },
    { yr: 2025, t: "新交付小区", d: "大门沉降近 30 cm、裂缝 >30 cm、墙砖脱落", c: COL.orange, up: true },
  ];
  marks.forEach((m) => {
    const tx = px + 30 + (pw - 60) * ((m.yr - 2012) / 13);
    const cy = m.up ? y0 - 74 : y0 + 34;
    if (m.up) vline(x, tx, cy + 58, y0 - cy - 58, m.c, 2.5, [7, 6]);
    else vline(x, tx, y0, cy - y0, m.c, 2.5, [7, 6]);
    dot(x, tx, y0, 9, m.c);
    const bw = 300, bx = Math.min(Math.max(tx - bw / 2, px), px + pw - bw);
    const by = m.up ? cy - 96 : cy;
    rr(x, bx, by, bw, 96, 12, "rgba(255,255,255,0.08)", m.c, 2.5);
    text(x, m.t + " · " + m.yr, bx + 16, by + 34, { size: 23, weight: "bold", color: m.c });
    wrap(x, m.d, bw - 32, 21).forEach((ln, i) => text(x, ln, bx + 16, by + 64 + i * 26, { size: 21, color: "rgba(255,255,255,0.86)" }));
  });
  text(x, "全部为媒体报道", px + pw - 30, py + ph - 18, { size: 20, color: COL.faint, align: "right" });
}

function drawCorrosion(x, a) {        // 防护措施年限条
  const { px, py, pw } = a;
  const items = [
    { n: "阻锈剂", v: 20, t: "≤20 年", c: COL.orange },
    { n: "表面涂层", v: 10, t: "≥10 年", c: COL.red },
    { n: "硅烷浸渍", v: 20, t: "15–20 年", c: COL.orange },
    { n: "环氧涂层钢筋", v: 30, t: "20–30 年", c: COL.yellow },
    { n: "不锈钢钢筋", v: 30, t: "≥30 年", c: COL.green },
  ];
  let cy = py;
  items.forEach((it) => {
    text(x, it.n, px, cy + 22, { size: 24, color: COL.dim });
    hbar(x, px + 250, cy, pw - 420, { value: it.v, max: 50, color: it.c, valueText: it.t, bh: 24, size: 23 });
    cy += 46;
  });
  const ex = px + 250 + (pw - 420) * (50 / 50);
  vline(x, ex, py - 12, cy - py + 4, COL.cream, 3, [8, 6]);
  text(x, "50 年设计年限", ex, py - 22, { size: 24, weight: "bold", color: COL.cream, align: "right" });
  text(x, "没有任何单一措施能盖满", ex + 14, cy - 40, { size: 24, weight: "bold", color: COL.red });
}

const CUSTOM = { map: drawMap, profile: drawProfile, race: drawRace, elevation: drawElevation, pile: drawPile, timeline: drawTimeline, corrosion: drawCorrosion };

// ── 通用积木 ───────────────────────────────────────────────

function blk(x, b) {
  switch (b.k) {
    case "custom": CUSTOM[b.fn](x, b); break;

    case "hero": {
      text(x, b.title, PAD, 400, { size: 108, weight: "bold", color: COL.cream });
      hline(x, PAD, 440, 420, COL.accent, 6);
      para(x, b.sub, PAD, 510, 900, { size: 38, color: COL.dim, lh: 58 });
      (b.pills || []).forEach((p, i) => {
        const w = measure(x, p.t, 26) + 44;
        const pxx = PAD + i * 0; // 纵向排
        rr(x, PAD, 640 + i * 62, w, 48, 24, "rgba(79,168,216,0.18)", "rgba(79,168,216,0.6)", 2);
        text(x, p.t, PAD + 22, 672 + i * 62, { size: 26, color: COL.accent });
      });
      break;
    }

    case "riskrows": {
      const rows = b.rows; let cy = b.py;
      text(x, "你担心的事", b.px, cy - 16, { size: 25, weight: "bold", color: COL.accent });
      text(x, "实际情况", b.px + 300, cy - 16, { size: 25, weight: "bold", color: COL.accent });
      text(x, "等级", b.px + b.pw - 170, cy - 16, { size: 25, weight: "bold", color: COL.accent });
      hline(x, b.px, cy + 2, b.pw, "rgba(143,184,216,0.3)", 2);
      cy += 26;
      rows.forEach((r) => {
        const h = r.h || 116;
        rr(x, b.px, cy, b.pw, h - 12, 12, "rgba(255,255,255,0.045)");
        rr(x, b.px, cy, 6, h - 12, 3, TONE[r.tone]);
        text(x, r.q, b.px + 30, cy + 44, { size: 30, weight: "bold", color: COL.ink });
        wrap(x, r.a, b.pw - 480, 25).forEach((ln, i) => text(x, ln, b.px + 330, cy + 42 + i * 32, { size: 25, color: "rgba(255,255,255,0.86)" }));
        if (r.note) text(x, r.note, b.px + 330, cy + h - 28, { size: 20, color: COL.faint });
        rr(x, b.px + b.pw - 180, cy + 22, 150, 48, 24, TONE[r.tone]);
        text(x, r.level, b.px + b.pw - 105, cy + 55, { size: 26, weight: "bold", color: "#08243A", align: "center" });
        cy += h;
      });
      break;
    }

    case "cards": {
      const gap = b.gap == null ? 24 : b.gap;
      const cols = b.cols || b.items.length;
      const rows = Math.ceil(b.items.length / cols);
      const cw = (b.pw - gap * (cols - 1)) / cols;
      const ch = (b.ph - gap * (rows - 1)) / rows;
      b.items.forEach((it, i) => {
        const cx = b.px + (i % cols) * (cw + gap);
        const cy0 = b.py + Math.floor(i / cols) * (ch + gap);
        card(x, cx, cy0, cw, ch, { accent: it.accent, title: it.title, titleSize: it.titleSize || 28, pad: 24, fill: it.fill });
        let cy = cy0 + (it.title ? (it.titleSize || 28) + 66 : 36);
        (it.lines || []).forEach((L) => {
          if (L.gap) { cy += L.gap; return; }
          const lines = wrap(x, L.t, cw - 56, L.size || 25);
          lines.forEach((ln) => { text(x, ln, cx + 28, cy + (L.size || 25), { size: L.size || 25, color: L.color || COL.ink, weight: L.weight || "", mono: L.mono }); cy += (L.size || 25) * 1.42; });
          cy += (L.after == null ? 8 : L.after);
        });
      });
      break;
    }

    case "table": table(x, b.px, b.py, b.pw, b); break;

    case "bars": {
      let cy = b.py;
      (b.items || []).forEach((it) => {
        if (it.gap) { cy += it.gap; return; }
        hbar(x, b.px + 250, cy, b.pw - 250 - 310, { value: it.value, max: b.max || 100, color: it.color || COL.accent, valueText: it.valueText, bh: b.bh || 26, size: 24 });
        text(x, it.label, b.px + 236, cy + (b.bh || 26) * 0.78, { size: 24, color: COL.dim, align: "right" });
        cy += (b.rowH || 52);
      });
      break;
    }

    case "bignums": {
      const gap = b.gap == null ? 24 : b.gap;
      const cw = (b.pw - gap * (b.items.length - 1)) / b.items.length;
      b.items.forEach((it, i) => {
        const cx = b.px + i * (cw + gap);
        rr(x, cx, b.py, cw, b.ph, 16, "rgba(255,255,255,0.05)", "rgba(143,184,216,0.2)", 2);
        text(x, it.l, cx + 26, b.py + 44, { size: 24, color: COL.dim });
        text(x, it.v, cx + 26, b.py + 118, { size: it.vsize || 64, weight: "bold", color: it.color || COL.ink, mono: true });
        if (it.u) text(x, it.u, cx + 26 + measure(x, it.v, it.vsize || 64, true, "bold") + 12, b.py + 118, { size: 28, color: it.color || COL.dim });
        if (it.sub) wrap(x, it.sub, cw - 52, 21).forEach((ln, k) => text(x, ln, cx + 26, b.py + 156 + k * 28, { size: 21, color: COL.faint }));
      });
      break;
    }

    case "quote": {
      rr(x, b.px, b.py, b.pw, b.ph, 14, "rgba(255,255,255,0.06)", "rgba(143,184,216,0.3)", 2);
      rr(x, b.px, b.py, 6, b.ph, 3, b.tone || COL.accent);
      text(x, "“", b.px + 26, b.py + 72, { size: 76, color: b.tone || COL.accent });
      let cy = b.py + (b.pad || 40);
      (b.lines || []).forEach((L) => {
        const lines = wrap(x, L.t, b.pw - 80, L.size || 26);
        lines.forEach((ln) => { text(x, ln, b.px + 40, cy + (L.size || 26), { size: L.size || 26, color: L.color || COL.ink, weight: L.weight || "" }); cy += (L.size || 26) * 1.45; });
        cy += 6;
      });
      if (b.by) text(x, b.by, b.px + 40, b.py + b.ph - 22, { size: 21, color: COL.faint });
      break;
    }

    case "gap": gapCard(x, b.px, b.py, b.pw, b.ph, b.label, { size: b.size, top: b.top }); break;

    case "chips": {
      let cx = b.px, cy = b.py;
      (b.items || []).forEach((it) => {
        const w = measure(x, it.t, b.size || 25) + 40;
        if (cx + w > b.px + (b.pw || 900)) { cx = b.px; cy += (b.size || 25) + 34; }
        rr(x, cx, cy, w, (b.size || 25) + 22, ((b.size || 25) + 22) / 2, it.tone ? TONE[it.tone] : "rgba(79,168,216,0.20)", it.tone ? null : "rgba(79,168,216,0.6)", 2);
        text(x, it.t, cx + 20, cy + (b.size || 25) + 2, { size: b.size || 25, color: it.tone ? "#08243A" : COL.accent, weight: it.tone ? "bold" : "" });
        cx += w + 14;
      });
      break;
    }

    case "steps": {
      let cy = b.py;
      (b.items || []).forEach((it, i) => {
        const h = it.h || 74;
        rr(x, b.px, cy, b.pw, h - 12, 12, "rgba(255,255,255,0.05)", "rgba(143,184,216,0.16)", 2);
        rr(x, b.px + 16, cy + (h - 12) / 2 - 22, 44, 44, 22, b.tone ? TONE[b.tone] : COL.accent);
        text(x, it.n || String(i + 1), b.px + 38, cy + (h - 12) / 2 + 10, { size: 25, weight: "bold", color: "#08243A", align: "center", mono: true });
        text(x, it.t, b.px + 80, cy + 40, { size: it.size || 26, color: COL.ink, weight: it.weight || "" });
        if (it.d) text(x, it.d, b.px + 80 + measure(x, it.t, it.size || 26, false, it.weight || "") + 20, cy + 40, { size: 22, color: COL.faint });
        cy += h;
      });
      break;
    }

    case "stackbar": {
      const sum = (b.segs || []).reduce((a, s) => a + s.pct, 0) || 100;
      let cx = b.px;
      (b.segs || []).forEach((s) => {
        const w = b.pw * s.pct / sum;
        rr(x, cx, b.py, w - 4, b.ph, 8, s.color);
        text(x, s.pct + "%", cx + 16, b.py + b.ph / 2 + 11, { size: 27, weight: "bold", color: "#08243A", mono: true });
        text(x, s.label, cx + 16, b.py + b.ph + 34, { size: 22, color: s.color });
        cx += w;
      });
      break;
    }

    case "note": {
      dot(x, b.px + 8, b.py - 8, 8, b.tone ? TONE[b.tone] : COL.faint);
      wrap(x, b.t, b.pw - 40, b.size || 23).forEach((ln, i) => text(x, ln, b.px + 28, b.py + i * ((b.size || 23) * 1.45), { size: b.size || 23, color: b.color || COL.dim }));
      break;
    }

    case "sign": {
      text(x, b.t, b.px, b.py, { size: b.size || 26, weight: b.weight || "", color: b.color || COL.ink, mono: b.mono, align: b.align });
      break;
    }
    default: break;
  }
}

export function renderScene(scene, charImg) {
  const [c, x] = newCanvas();
  paintBg(x);
  if (scene.header !== false) header(x, { idx: scene.idx, title: scene.title, sub: scene.sub });
  if (charImg && scene.header !== false) {          // 页眉圆形头像
    const r = 40, ax = W - 118, ay = 76;
    x.save();
    x.beginPath(); x.arc(ax, ay, r, 0, Math.PI * 2); x.clip();
    x.drawImage(charImg, charImg.width * 0.27, charImg.height * 0.22, charImg.width * 0.46, charImg.height * 0.38, ax - r, ay - r, r * 2, r * 2);
    x.restore();
    x.beginPath(); x.arc(ax, ay, r, 0, Math.PI * 2); x.strokeStyle = "rgba(79,168,216,0.85)"; x.lineWidth = 3; x.stroke();
  }
  (scene.blocks || []).forEach((b) => blk(x, b));
  if (scene.char) drawChar(x, charImg, W - 96 - 380, H - 96 - scene.char, scene.char, scene.flip);
  footer(x, scene.foot || {});
  return c;
}
