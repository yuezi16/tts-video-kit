"""gs_batch.py —— 一次加载底模，批量克隆合成整个视频的所有段落。

用法：
  python gs_batch.py --ref 参考音频.wav [--prompt-text "参考音频原话"] [--jobs jobs.json] [--outdir 目录] [--limit N]
jobs.json 形如 {"s01": "第一段口播", "s02": "第二段口播", ...}
不加 --jobs 时自动读取 deck 导出的 narr.json。
"""
import os
import sys
import json
import time
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GS = os.path.join(ROOT, "gptsovits")
GSI = os.path.join(GS, "GPT_SoVITS")

os.environ.setdefault("version", "v2")
os.environ["MPLCONFIGDIR"] = os.path.join(ROOT, "pyenv", "mplcache")
os.environ.setdefault("HF_HOME", os.path.join(ROOT, "pyenv", "hfhome"))
os.environ.setdefault("NLTK_DATA", os.path.join(ROOT, "pyenv", "nltk_data"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

sys.path.insert(0, GSI)
sys.path.insert(0, GS)
os.chdir(GS)

import numpy as np            # noqa: E402
import soundfile as sf        # noqa: E402
from GPT_SoVITS.inference_webui import (   # noqa: E402
    change_gpt_weights, change_sovits_weights, get_tts_wav, dict_language,
)

_CODE2KEY = {}
for _k, _v in dict_language.items():
    _CODE2KEY.setdefault(_v, _k)

PRET = os.path.join(GSI, "pretrained_models")
V2 = os.path.join(PRET, "gsv-v2final-pretrained")
GPT_PATH = os.path.join(V2, "s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt")
SOVITS_PATH = os.path.join(V2, "s2G2333k.pth")


def synth(ref, prompt_text, text, lang_key, speed, seed):
    import torch
    torch.manual_seed(seed)
    gen = get_tts_wav(
        ref_wav_path=ref,
        prompt_text=prompt_text,
        prompt_language=lang_key,
        text=text,
        text_language=lang_key,
        top_k=15, top_p=1.0, temperature=1.0,
        ref_free=(len(prompt_text.strip()) == 0),
        speed=speed,
    )
    audio, sr = None, None
    for sr, chunk in gen:
        audio = chunk if audio is None else np.concatenate([audio, chunk])
    return sr, audio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True)
    ap.add_argument("--prompt-text", default="")
    ap.add_argument("--jobs", default=os.path.join(ROOT, "narr.json"))
    ap.add_argument("--outdir", default=os.path.join(ROOT, "audio_clone"))
    ap.add_argument("--language", default="all_zh")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    lang_key = _CODE2KEY.get(args.language)
    if lang_key is None:
        print("语言代码不对:", args.language, "可选", sorted(_CODE2KEY))
        sys.exit(2)

    jobs = json.load(open(args.jobs, encoding="utf-8"))
    ids = list(jobs.keys())
    if args.limit:
        ids = ids[:args.limit]
    os.makedirs(args.outdir, exist_ok=True)
    ref = os.path.abspath(args.ref)

    t0 = time.time()
    change_sovits_weights(SOVITS_PATH, prompt_language=lang_key, text_language=lang_key)
    change_gpt_weights(GPT_PATH)
    print("底模加载 %.1fs" % (time.time() - t0), flush=True)

    total_audio = 0.0
    started = time.time()
    for i, sid in enumerate(ids, 1):
        text = jobs[sid]
        t = time.time()
        sr, audio = synth(ref, args.prompt_text, text, lang_key, args.speed, args.seed)
        dur = len(audio) / sr
        out = os.path.join(args.outdir, sid + ".wav")
        sf.write(out, audio, sr)
        total_audio += dur
        el = time.time() - t
        print("[%d/%d] %s  %d字 -> %.2fs音频  用时%.1fs  (%.2fx实时)" % (
            i, len(ids), sid, len(text), dur, el, dur / el), flush=True)

    wall = time.time() - started
    print("\n合计：音频 %.1fs，耗时 %.1fs，平均 %.2fx 实时" % (total_audio, wall, total_audio / wall), flush=True)


if __name__ == "__main__":
    main()
