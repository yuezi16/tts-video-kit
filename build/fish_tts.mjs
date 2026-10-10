// fish_tts.mjs —— 用 Fish Audio API（免费档 s2.1-pro-free）逐段合成旁白
// 用法：node fish_tts.mjs              全部合成
//       FISH_LIMIT=2 node fish_tts.mjs 只跑前两段（试听）
// 需要：把 API Key 放进 fishkey.txt（一行，别加引号）
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:\\Users\\tsuki\\Documents\\hasumi021\\out\\nansha_video";
const KEYFILE = process.env.FISH_KEY_FILE || path.join(ROOT, "fishkey.txt");
const REF = process.env.FISH_REF || "80da4ba28f3e4eb39b8c309180a1763c";
const MODEL = process.env.FISH_MODEL || "s2.1-pro-free";
const SPEED = parseFloat(process.env.FISH_SPEED || "1");
const OUTDIR = process.env.FISH_OUT || path.join(ROOT, "audio_fish");
const LIMIT = parseInt(process.env.FISH_LIMIT || "0", 10);
const CONC = parseInt(process.env.FISH_CONC || "2", 10);
const API = "https://api.fish.audio/v1/tts";

if (!fs.existsSync(KEYFILE)) {
  console.error(`找不到 API Key 文件：${KEYFILE}`);
  console.error("请把 Fish Audio 的 API Key 存进去（一行，不要加引号或空格）。");
  process.exit(2);
}
const lines = fs.readFileSync(KEYFILE, "utf8").split(/\r?\n/).map((s) => s.trim());
const KEY = lines.find((s) => s && !s.startsWith("#") && /^[\x21-\x7e]{16,}$/.test(s));
if (!KEY) {
  console.error("Key 文件里没有找到有效的 API Key。");
  console.error(`文件：${KEYFILE}`);
  console.error("要求：单独一行、纯英文数字符号、长度 16 以上、不要加引号和空格。");
  console.error("以 # 开头的行会被忽略。");
  process.exit(2);
}

fs.mkdirSync(OUTDIR, { recursive: true });
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "narr.json"), "utf8"));
let ids = Object.keys(jobs);
if (LIMIT) ids = ids.slice(0, LIMIT);

function wavDur(f) {
  const b = fs.readFileSync(f);
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34);
  const bps = sr * ch * (bits / 8);
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    let sz = b.readUInt32LE(off + 4);
    if (id === "data") {
      const avail = b.length - (off + 8);
      if (sz <= 0 || sz > avail) sz = avail;   // 流式 wav 的 size 字段是占位值，按实际长度算
      return { dur: sz / bps, sr };
    }
    if (sz > b.length) break;
    off += 8 + sz + (sz % 2);
  }
  return { dur: Math.max(0, b.length - 44) / bps, sr };
}

async function synth(sid, text, attempt = 0) {
  const body = {
    text,
    reference_id: REF,
    format: "wav",
    sample_rate: 44100,
    normalize: true,
    chunk_length: 300,
    min_chunk_length: 50,
    latency: "normal",
    prosody: { speed: SPEED, volume: 0, normalize_loudness: true },
  };
  const t0 = Date.now();
  const r = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      model: MODEL,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 4) {
      const wait = 4000 * (attempt + 1);
      console.log(`  ${sid} HTTP ${r.status}，${wait / 1000}s 后重试…`);
      await new Promise((res) => setTimeout(res, wait));
      return synth(sid, text, attempt + 1);
    }
    throw new Error(`${sid} HTTP ${r.status}: ${txt.slice(0, 300)}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const out = path.join(OUTDIR, sid + ".wav");
  fs.writeFileSync(out, buf);
  const { dur, sr } = wavDur(out);
  console.log(`[${sid}] ${text.length}字 -> ${dur.toFixed(2)}s @${sr}Hz  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return dur;
}

const results = [];
let idx = 0;
async function worker() {
  while (idx < ids.length) {
    const sid = ids[idx++];
    try {
      results.push(await synth(sid, jobs[sid]));
    } catch (e) {
      console.error("失败:", e.message);
      results.push(0);
    }
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));
const total = results.reduce((a, b) => a + b, 0);
console.log(`\n合计 ${ids.length} 段，音频 ${total.toFixed(1)}s（${Math.floor(total / 60)}分${(total % 60).toFixed(1)}秒），耗时 ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log(`模型 ${MODEL}　语速 ${SPEED}　音色 ${REF}`);
