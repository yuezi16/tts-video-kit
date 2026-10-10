"""gs_tts.py —— 用 GPT-SoVITS 预训练底模 + 参考音频做零样本声音克隆朗读。

用法：
  python gs_tts.py --ref 参考音频.wav --text "要念的文字" --out 输出.wav
  可选：--prompt-text "参考音频里说的原话"   （不给就自动走 ref_free 模式）
        --speed 1.0  --language zh
"""
import os
import sys
import argparse
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # .../nansha_video
GS = os.path.join(ROOT, "gptsovits")               # 仓库根
GSI = os.path.join(GS, "GPT_SoVITS")               # 内层包目录

os.environ.setdefault("version", "v2")
os.environ["MPLCONFIGDIR"] = os.path.join(ROOT, "pyenv", "mplcache")
os.environ.setdefault("HF_HOME", os.path.join(ROOT, "pyenv", "hfhome"))
os.environ.setdefault("NLTK_DATA", os.path.join(ROOT, "pyenv", "nltk_data"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

sys.path.insert(0, GSI)
sys.path.insert(0, GS)
os.chdir(GS)          # 仓库根：cnhubert / bert 用的是相对路径 GPT_SoVITS/pretrained_models/...

import numpy as np            # noqa: E402
import soundfile as sf        # noqa: E402
from GPT_SoVITS.inference_webui import (   # noqa: E402
    change_gpt_weights, change_sovits_weights, get_tts_wav, dict_language,
)

# GPT-SoVITS 的 dict_language 键是 i18n 显示名（如「中文」），值才是代码（如 all_zh）。
# 这里建一张 代码 -> 显示名 的反查表，脚本对外只暴露代码。
_CODE2KEY = {}
for _k, _v in dict_language.items():
    _CODE2KEY.setdefault(_v, _k)

PRET = os.path.join(GSI, "pretrained_models")
V2 = os.path.join(PRET, "gsv-v2final-pretrained")
GPT_PATH = os.path.join(V2, "s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt")
SOVITS_PATH = os.path.join(V2, "s2G2333k.pth")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="参考音频（5-10 秒最合适）")
    ap.add_argument("--text", required=True, help="要合成的文字")
    ap.add_argument("--out", required=True, help="输出 wav 路径")
    ap.add_argument("--prompt-text", default="", help="参考音频里说的原话；不给则用 ref_free")
    ap.add_argument("--language", default="all_zh",
                    help="all_zh 全中文 / zh 中英混合 / en / ja / auto")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--top-k", type=int, default=15)
    ap.add_argument("--top-p", type=float, default=1.0)
    ap.add_argument("--temperature", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    import torch
    torch.manual_seed(args.seed)

    lang_key = _CODE2KEY.get(args.language)
    if lang_key is None:
        print("不认识的语言代码 %r，可选：%s" % (args.language, sorted(_CODE2KEY)))
        sys.exit(2)

    ref = os.path.abspath(args.ref)
    if not os.path.exists(ref):
        print("参考音频不存在:", ref)
        sys.exit(2)

    t0 = time.time()
    change_sovits_weights(SOVITS_PATH, prompt_language=lang_key, text_language=lang_key)
    change_gpt_weights(GPT_PATH)
    print("底模加载完成 %.1fs" % (time.time() - t0))

    ref_free = len(args.prompt_text.strip()) == 0
    t1 = time.time()
    gen = get_tts_wav(
        ref_wav_path=ref,
        prompt_text=args.prompt_text,
        prompt_language=lang_key,
        text=args.text,
        text_language=lang_key,
        top_k=args.top_k,
        top_p=args.top_p,
        temperature=args.temperature,
        ref_free=ref_free,
        speed=args.speed,
    )
    audio = None
    sr = None
    for sr, chunk in gen:
        audio = chunk if audio is None else np.concatenate([audio, chunk])
    if audio is None:
        print("合成失败：没有产出音频")
        sys.exit(1)

    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sf.write(out, audio, sr)
    dur = len(audio) / sr
    print("OK %s  %.1f kHz  %.2f 秒  合成耗时 %.1fs  ref_free=%s" % (out, sr / 1000, dur, time.time() - t1, ref_free))


if __name__ == "__main__":
    main()
