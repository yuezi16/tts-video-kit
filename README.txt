═══ tts-video-kit ═══
配音讲解视频工具包（从 nansha 项目里留下来的通用工具）
2026-10-06 整理

【这是什么】
一套「画幻灯片 + 配音 + 字幕 + 合片」的流水线，做的是
「有旁白讲解、画面是图表/版式」的那类视频（不是 AMV）。

【怎么用】
  1. 先装依赖（本目录的 build/ 下）：
       cd build
       npm install
     （node_modules 被我清掉了，但 package-lock.json 留着，装的版本一样）

  2. 出片总控：
       node build.mjs [all|char|slides|tts|subs|video] [场景号]
     不传参数就是 all，全流程跑一遍。

【每个文件干什么】

  build/build.mjs      出片总控：角色抠图 → 幻灯片 → 配音 → 字幕 → 合成
  build/deck.mjs       场景数据（口播词 + 画面版式）
                       ← 换项目时主要改这个，结构照抄，内容换掉
  build/draw.mjs       把场景数据翻译成画面
  build/lib.mjs        画面绘制原语（1920×1080）
  build/fish_tts.mjs   配音方案A：Fish Audio API，逐段合成旁白
                       需要把 API Key 写进 build/fishkey.txt（一行，不加引号）
                       ← 上次那个 key 已删，下次要重新填
  build/get.mjs        经代理下载文件（Node 的 NODE_USE_ENV_PROXY + fetch）
  build/gs_tts.py      配音方案B：GPT-SoVITS 本地克隆配音
  build/gs_batch.py    配音方案B的批量版
  voice/inspect_pt.py  检查 .pt 模型文件的工具
  voice/model_28000.pt 训练好的语音模型（267 MB，留着复用）
  voice/标准录音 2.wav  训练这个模型用的参考录音
  voice/放这里-README.txt  声音样本的挑选说明（原文，路径写的是老路径，
                        靠 out\nansha_video 那道兼容传送门仍能走到）

【运行环境（都是传送门，不占 C 盘）】
  pyenv      -> E:\hasumi021-big\pyenv        （Python 环境，7.2 GB）
  gptsovits  -> E:\hasumi021-big\gptsovits    （GPT-SoVITS，4.0 GB）
  老路径 out\nansha_video 仍指向本目录，兼容旧脚本。

【注意】
  · 依赖是 @napi-rs/canvas（画图）和 msedge-tts（微软 Edge 的免费 TTS）。
  · fish_tts.mjs 走的是 Fish Audio 免费档，需要自备 Key。
  · 配音两条路：想快用 fish_tts.mjs（要联网），想用自己练的声音用 gs_tts.py。
