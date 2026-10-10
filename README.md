# tts-video-kit

**配音讲解视频工具包** —— 一套「画幻灯片 + 配音 + 字幕 + 合片」的流水线，用来做**有旁白讲解、画面是图表/版式**的那类视频（不是 AMV）。

2026-10-06 整理成独立工具包，从 nansha 项目里留下来的通用部分。

## 需要什么环境

- **Node.js**（跑 `.mjs` 脚本）
- **Python 3**（只在用 GPT-SoVITS 本地配音时才需要，见 `voice/inspect_pt.py`）

在 `build/` 目录下装依赖：

```bash
cd build
npm install
```

依赖只有两个：

| 包 | 用途 |
|---|---|
| `@napi-rs/canvas` | 画图（1920×1080 画面渲染） |
| `msedge-tts` | 微软 Edge 的免费 TTS（配音方案之外的备选） |

## 怎么出片

```bash
cd build
node build.mjs            # 全流程：角色抠图 → 幻灯片 → 配音 → 字幕 → 合成
node build.mjs slides     # 只出幻灯片
node build.mjs tts        # 只做配音
node build.mjs video      # 只做合成
node build.mjs 3          # 只跑第 3 个场景
```

不传参数就是 `all`，全流程跑一遍。

## 每个文件干什么

```
build/build.mjs      出片总控：角色抠图 → 幻灯片 → 配音 → 字幕 → 合成
build/deck.mjs       场景数据（口播词 + 画面版式）
                     ← 换项目时主要改这个，结构照抄，内容换掉
build/draw.mjs       把场景数据翻译成画面
build/lib.mjs        画面绘制原语（1920×1080）
build/fish_tts.mjs   配音方案 A：Fish Audio API，逐段合成旁白
build/get.mjs        经代理下载文件（Node 的 NODE_USE_ENV_PROXY + fetch）
build/gs_tts.py      配音方案 B：GPT-SoVITS 本地克隆配音
build/gs_batch.py    配音方案 B 的批量版
voice/inspect_pt.py  检查 .pt 模型文件的工具
```

## 配音的两条路

| 方案 | 脚本 | 需要什么 |
|---|---|---|
| A · 快 | `build/fish_tts.mjs` | 联网 + 自备 Fish Audio 的 Key，写进 `build/fishkey.txt`（一行，不加引号） |
| B · 用自己的声音 | `build/gs_tts.py` | 本地装好 GPT-SoVITS，配一个训练过的语音模型 |

## 仓库里没有的东西（要自己补）

为了不把仓库撑爆，下面两个文件**没有上传**，需要时自己放回 `voice/` 目录：

- `model_28000.pt` —— 训练好的语音模型（267 MB，超过 GitHub 单文件 100 MB 上限）
- `标准录音 2.wav` —— 用来训练那个模型的参考录音（5.7 MB）

`voice/放这里-README.txt` 里有挑选声音样本的说明。

## 已知的注意点

- `fish_tts.mjs` 走 Fish Audio 免费档，Key 要自备，且**不要提交上来**。
- `get.mjs` 依赖 `NODE_USE_ENV_PROXY` 环境变量 + 系统代理才能出网。
- `deck.mjs` 是唯一需要按项目改的文件；其余都是通用逻辑。
