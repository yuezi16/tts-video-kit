// build.mjs —— 出片总控：角色抠图 → 幻灯片 → 配音 → 字幕 → 合成
// 用法： node build.mjs [all|char|slides|tts|subs|video] [sceneId]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { SCENES } from "./deck.mjs";
import { renderScene } from "./draw.mjs";
import { registerFonts, save, text, rr } from "./lib.mjs";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const ROOT = "C:\\Users\\tsuki\\Documents\\hasumi021\\out\\nansha_video";
const FF = "C:\\Users\\tsuki\\Desktop\\YoutubeDownloader.win-x64\\ffmpeg.exe";
const CHAR_SRC = "C:\\Users\\tsuki\\Documents\\hasumi021\\图片\\dsh的样子.png";
const D = (p) => path.join(ROOT, p);
const STEP = (process.argv[2] || "all").toLowerCase();
const ONLY = process.argv[3];
const VOICE = process.env.NS_VOICE || "zh-CN-YunjianNeural";
const RATE = process.env.NS_RATE || "+4%";
const ADIR = process.env.NS_AUDIO_DIR || "audio";   // 音轨目录（换配音时指向 audio_clone）
const OUTMP4 = process.env.NS_OUT || "nansha.mp4";
const GAP = 0.5;           // 每段之间的静音
const TAIL = 0.4;          // 每段尾巴留白
const FONT = "Microsoft YaHei";

for (const d of ["slides", "audio", "assets", "clips"]) fs.mkdirSync(D(d), { recursive: true });

function run(args) {
  const r = spawnSync(FF, args, { stdio: "inherit" });
  if (r.error) throw new Error("spawn: " + r.error.message);
  if (r.status !== 0) throw new Error("ffmpeg exit " + r.status + " :: " + args.join(" "));
}

// ── 1. 角色抠图（白底 → 透明，边界泛洪避免掏空白围裙）─────────
async function stepChar() {
  const img = await loadImage(CHAR_SRC);
  const [c, x] = [createCanvas(img.width, img.height), null];
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const { data, width: w, height: h } = id;
  const isWhite = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return (r + g + b) / 3 > 226 && mx - mn < 34;
  };
  const seen = new Uint8Array(w * h);
  const q = [];
  for (let px = 0; px < w; px++) { q.push(px, (h - 1) * w + px); }
  for (let py = 0; py < h; py++) { q.push(py * w, py * w + w - 1); }
  while (q.length) {
    const p = q.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isWhite(p * 4)) continue;
    data[p * 4 + 3] = 0;
    const px = p % w, py = (p - px) / w;
    if (px > 0) q.push(p - 1);
    if (px < w - 1) q.push(p + 1);
    if (py > 0) q.push(p - w);
    if (py < h - 1) q.push(p + w);
  }
  // 边缘柔化：紧邻透明且偏白的像素降透明度
  const orig = Uint8ClampedArray.from(data);
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
    const p = py * w + px, i = p * 4;
    if (orig[i + 3] === 0) continue;
    const nearClear = orig[(p - 1) * 4 + 3] === 0 || orig[(p + 1) * 4 + 3] === 0 || orig[(p - w) * 4 + 3] === 0 || orig[(p + w) * 4 + 3] === 0;
    if (!nearClear) continue;
    const lum = (orig[i] + orig[i + 1] + orig[i + 2]) / 3;
    const mx = Math.max(orig[i], orig[i + 1], orig[i + 2]), mn = Math.min(orig[i], orig[i + 1], orig[i + 2]);
    if (mx - mn < 40 && lum > 190) data[i + 3] = Math.round(255 * Math.max(0, (236 - lum) / 46));
  }
  ctx.putImageData(id, 0, 0);
  save(c, D("assets/char.png"));
  console.log("char ok " + img.width + "x" + img.height);
  return D("assets/char.png");
}

// ── 2. 幻灯片 ─────────────────────────────────────────────
async function stepSlides() {
  registerFonts();
  const char = fs.existsSync(D("assets/char.png")) ? await loadImage(D("assets/char.png")) : null;
  const list = ONLY ? SCENES.filter((s) => s.id === ONLY) : SCENES;
  for (const s of list) {
    save(renderScene(s, char), D(`slides/${s.id}.png`));
    console.log("slide " + s.id);
  }
}

// ── 3. 配音 ───────────────────────────────────────────────
// 读 WAV 头拿真实参数——在线配音 24 kHz、GPT-SoVITS 32 kHz、Fish Audio 44.1 kHz
// 注意：Fish Audio 返回的是流式 WAV，RIFF/data 的 size 字段是占位值，必须按实际文件长度算
function wavInfo(f) {
  const b = fs.readFileSync(f);
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34);
  const bps = sr * ch * (bits / 8);
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    let sz = b.readUInt32LE(off + 4);
    if (id === "data") {
      const avail = b.length - (off + 8);
      if (sz <= 0 || sz > avail) sz = avail;
      return { dur: sz / bps, sr, ch, bits };
    }
    if (sz > b.length) break;
    off += 8 + sz + (sz % 2);
  }
  return { dur: Math.max(0, b.length - 44) / bps, sr, ch, bits };
}
const wavDur = (f) => wavInfo(f).dur;

async function ttsOne(scene, attempt = 0) {
  const out = D("audio/" + scene.id);
  fs.mkdirSync(out, { recursive: true });
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    await tts.toFile(out, scene.narr, { rate: RATE });
    tts.close();
    const mp3 = path.join(out, "audio.mp3");
    if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 2000) throw new Error("tiny mp3");
    run(["-hide_banner", "-loglevel", "error", "-y", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", D(`audio/${scene.id}.wav`)]);
    return wavDur(D(`audio/${scene.id}.wav`));
  } catch (e) {
    try { tts.close(); } catch { }
    if (attempt < 3) { await new Promise((r) => setTimeout(r, 1500 + attempt * 2000)); return ttsOne(scene, attempt + 1); }
    throw new Error(scene.id + ": " + (e.message || e));
  }
}

async function stepTTS() {
  const list = ONLY ? SCENES.filter((s) => s.id === ONLY) : SCENES;
  const man = fs.existsSync(D("manifest.json")) ? JSON.parse(fs.readFileSync(D("manifest.json"), "utf8")) : {};
  for (const s of list) {
    if (process.env.NS_SKIP && fs.existsSync(D(`audio/${s.id}.wav`))) { man[s.id] = { dur: wavDur(D(`audio/${s.id}.wav`)), chars: s.narr.length }; continue; }
    const dur = await ttsOne(s);
    man[s.id] = { dur, chars: s.narr.length };
    console.log(`tts ${s.id}  ${dur.toFixed(2)}s  ${s.narr.length}字  ${(s.narr.length / dur * 60).toFixed(0)}字/分`);
  }
  fs.writeFileSync(D("manifest.json"), JSON.stringify(man, null, 2));
  const total = SCENES.reduce((a, s) => a + ((man[s.id]?.dur || 0) + GAP + TAIL), 0);
  console.log(`\n总时长 ${Math.floor(total / 60)}分${(total % 60).toFixed(1)}秒　字数 ${SCENES.reduce((a, s) => a + s.narr.length, 0)}`);
}

// ── 4. 字幕（.ass）───────────────────────────────────────
function splitSentences(t) {
  const out = [];
  let cur = "";
  const hard = "。！？";
  const soft = "；，、：";
  for (const ch of t) {
    cur += ch;
    if (hard.includes(ch)) { out.push(cur); cur = ""; }
    else if (soft.includes(ch) && cur.length >= 26) { out.push(cur); cur = ""; }
    else if (cur.length >= 34) { out.push(cur); cur = ""; }
  }
  if (cur.trim()) out.push(cur);
  // 合并过短的片段
  const merged = [];
  for (const s of out) {
    if (merged.length && (merged[merged.length - 1].length < 12 || s.length < 10)) merged[merged.length - 1] += s;
    else merged.push(s);
  }
  return merged;
}
const ts = (t) => {
  const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  return `${hh}:${String(mm).padStart(2, "0")}:${ss.toFixed(2).padStart(5, "0")}`;
};

function stepSubs() {
  const man = JSON.parse(fs.readFileSync(D("manifest.json"), "utf8"));
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Def,${FONT},50,&H00F8F2EA,&H000000FF,&H0012385C,&HA0000000,0,0,0,0,100,100,0.4,0,1,3.4,1.6,2,110,110,46,134

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ev = [];
  let clock = 0;
  for (const s of SCENES) {
    const m = man[s.id];
    if (!m) { clock += GAP + TAIL; continue; }
    const lines = splitSentences(s.narr);
    const totalChars = lines.reduce((a, l) => a + l.length, 0);
    let t = clock;
    lines.forEach((ln, i) => {
      const dur = m.dur * (ln.length / totalChars);
      const end = i === lines.length - 1 ? clock + m.dur : t + dur;
      ev.push(`Dialogue: 0,${ts(t)},${ts(end)},Def,,0,0,0,,${ln.replace(/[{}\\]/g, "")}`);
      t = end;
    });
    clock += m.dur + GAP + TAIL;
  }
  fs.writeFileSync(D("subs.ass"), head + ev.join("\n") + "\n", "utf8");
  console.log(`subs ok  ${ev.length} 条　总长 ${clock.toFixed(1)}s`);
  return clock;
}

// ── 4b. 换了配音后，按新音轨重算每段时长 ───────────────────
function stepRemanifest() {
  const man = {};
  for (const s of SCENES) {
    const w = D(`${ADIR}/${s.id}.wav`);
    if (!fs.existsSync(w)) { console.log("缺音频:", s.id); continue; }
    man[s.id] = { dur: wavDur(w), chars: s.narr.length };
  }
  fs.writeFileSync(D("manifest.json"), JSON.stringify(man, null, 2));
  const total = SCENES.reduce((a, s) => a + ((man[s.id]?.dur || 0) + GAP + TAIL), 0);
  console.log(`remanifest ${Object.keys(man).length} 段  总时长 ${Math.floor(total / 60)}分${(total % 60).toFixed(1)}秒  音轨目录 ${ADIR}`);
}

// ── 5. 合成 ───────────────────────────────────────────────
function stepVideo() {
  const man = JSON.parse(fs.readFileSync(D("manifest.json"), "utf8"));
  // 画面拼接清单
  const cparts = [];
  let total = 0;
  for (const s of SCENES) {
    const m = man[s.id]; if (!m) continue;
    const dur = m.dur + GAP + TAIL;
    cparts.push(`file '${D(`slides/${s.id}.png`).replace(/\\/g, "/")}'\nduration ${dur.toFixed(3)}`);
    total += dur;
  }
  cparts.push(`file '${D(`slides/${SCENES[SCENES.length - 1].id}.png`).replace(/\\/g, "/")}'`);
  fs.writeFileSync(D("concat.txt"), cparts.join("\n"), "utf8");
  // 音轨清单（静音段要跟音轨同采样率，否则拼接会变速）
  const firstWav = SCENES.map((s) => D(`${ADIR}/${s.id}.wav`)).find((p) => fs.existsSync(p));
  const sr0 = firstWav ? wavInfo(firstWav).sr : 24000;
  const sil = D(`${ADIR}/sil.wav`);
  if (!fs.existsSync(sil) || wavInfo(sil).sr !== sr0) {
    run(["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=${sr0}:cl=mono`, "-t", String(GAP + TAIL), "-c:a", "pcm_s16le", sil]);
  }
  const aparts = [];
  for (const s of SCENES) { if (!man[s.id]) continue; aparts.push(`file '${D(`${ADIR}/${s.id}.wav`).replace(/\\/g, "/")}'`); aparts.push(`file '${sil.replace(/\\/g, "/")}'`); }
  fs.writeFileSync(D("aconcat.txt"), aparts.join("\n"), "utf8");
  run(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", D("aconcat.txt"), "-c:a", "pcm_s16le", D("narration.wav")]);
  console.log(`narration.wav ${wavDur(D("narration.wav")).toFixed(1)}s @${wavInfo(D("narration.wav")).sr}Hz`);

  const ass = D("subs.ass").replace(/\\/g, "/").replace(":", "\\:");
  const fd = "C\\:/Windows/Fonts";
  run([
    "-hide_banner", "-loglevel", "warning", "-stats", "-y",
    "-f", "concat", "-safe", "0", "-i", D("concat.txt"),
    "-i", D("narration.wav"),
    "-filter_complex", `[0:v]ass=filename='${ass}':fontsdir='${fd}',fps=30,format=yuv420p[v]`,
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "stillimage", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
    D(OUTMP4),
  ]);
  const mb = (fs.statSync(D(OUTMP4)).size / 1048576).toFixed(1);
  console.log(`\n✔ ${D(OUTMP4)}  ${mb} MB  ${Math.floor(total / 60)}分${(total % 60).toFixed(1)}秒`);
}

// ── 6. B站封面 ────────────────────────────────────────────
async function stepCover() {
  registerFonts();
  const char = fs.existsSync(D("assets/char.png")) ? await loadImage(D("assets/char.png")) : null;
  const W2 = 1600, H2 = 900;
  const c = createCanvas(W2, H2), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W2 * 0.85, H2);
  g.addColorStop(0, "#0A2740"); g.addColorStop(0.55, "#0E3355"); g.addColorStop(1, "#17507F");
  x.fillStyle = g; x.fillRect(0, 0, W2, H2);
  x.strokeStyle = "rgba(143,184,216,0.07)"; x.lineWidth = 1;
  for (let gx = 0; gx < W2; gx += 64) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H2); x.stroke(); }
  for (let gy = 0; gy < H2; gy += 64) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W2, gy); x.stroke(); }
  x.fillStyle = "#4FA8D8"; x.fillRect(0, 0, W2, 10);
  if (char) { const h = 690, w = char.width * (h / char.height); x.drawImage(char, W2 - w - 10, H2 - h - 10, w, h); }
  const T = (s, px, py, o) => text(x, s, px, py, o);
  rr(x, 80, 108, 430, 46, 23, "rgba(79,168,216,0.20)", "rgba(79,168,216,0.65)", 2);
  T("南沙地质风险 · 一次翻到底", 104, 140, { size: 24, color: "#4FA8D8" });
  T("南沙的地，", 78, 268, { size: 88, weight: "bold", color: "#F5F1E8" });
  T("是软的", 78, 388, { size: 116, weight: "bold", color: "#D9534F" });
  x.fillStyle = "#4FA8D8"; x.fillRect(80, 430, 320, 7);
  T("楼是牢的，地会沉", 80, 502, { size: 44, weight: "bold", color: "#EAF2F8" });
  T("官方规划原文 · InSAR 实测 · 规范逐条对照", 80, 556, { size: 27, color: "#8FB8D8" });
  const stats = [["5 年", "−47 mm", "#E8B33C"], ["20 年", "−190 mm", "#E2803A"], ["50 年", "−470 mm", "#D9534F"]];
  stats.forEach((s, i) => {
    const bx = 80 + i * 262;
    rr(x, bx, 620, 242, 132, 14, "rgba(255,255,255,0.06)", "rgba(143,184,216,0.22)", 2);
    T(s[0], bx + 22, 664, { size: 26, color: "#8FB8D8" });
    T(s[1], bx + 22, 728, { size: 46, weight: "bold", color: s[2], mono: true });
  });
  T("地面沉降累计（按 9.45 mm/年线性外推）", 80, 800, { size: 22, color: "#5A7E9E" });
  T("大肥鱼女仆", 80, 862, { size: 26, weight: "bold", color: "#4FA8D8" });
  save(c, D("cover.png"));
  console.log("cover ok 1600x900");
}

const steps = {
  char: stepChar, slides: stepSlides, tts: stepTTS, subs: stepSubs, video: stepVideo, cover: stepCover,
  remanifest: stepRemanifest,
};
if (STEP === "all") { await stepChar(); await stepSlides(); await stepTTS(); stepSubs(); stepVideo(); }
else if (steps[STEP]) { await steps[STEP](); }
else { console.error("unknown step: " + STEP); process.exit(2); }
