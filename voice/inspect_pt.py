import torch, collections

p = r"C:\Users\tsuki\Documents\hasumi021\out\nansha_video\voice\model_28000.pt"
obj = torch.load(p, map_location="cpu", weights_only=True)
sd = obj["model"]
ks = list(sd.keys())

print("=== 模块路径统计（第 3 层）===")
c = collections.Counter(".".join(k.split(".")[:3]) for k in ks)
for k, v in sorted(c.items()):
    print("  %-56s %d tensors" % (k, v))

print("\n=== reflow_model 全部键 ===")
for k in ks:
    if k.startswith("reflow"):
        v = sd[k]
        print("  %-56s %s" % (k, tuple(v.shape) if hasattr(v, "shape") else type(v).__name__))

print("\n=== 关键超参数（标量）===")
for k in ks:
    v = sd[k]
    if hasattr(v, "shape") and v.shape == torch.Size([]):
        print("  %-56s %s" % (k, v.item()))

print("\n=== 是否含 时长/音高/声码器/说话人 模块 ===")
for tag in ["dur", "pitch", "linguistic", "vocoder", "spk", "speaker", "lang", "text", "phoneme", "energy", "breath", "hifigan", "nsf", "mel"]:
    hits = [k for k in ks if tag in k.lower()]
    print("  %-10s -> %d %s" % (tag, len(hits), hits[:3]))
