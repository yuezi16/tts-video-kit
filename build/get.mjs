// get.mjs —— 经代理下载文件（Node 24 的 NODE_USE_ENV_PROXY + fetch）
import fs from "node:fs";

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) { console.error("usage: node get.mjs <url> <outfile>"); process.exit(2); }

const res = await fetch(url, { redirect: "follow" });
if (!res.ok) { console.error("HTTP " + res.status + " " + url); process.exit(1); }
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(out, buf);
console.log("OK " + out + " " + buf.length + " bytes");
