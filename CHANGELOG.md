# 更新日志

本文件记录本插件的所有重要变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

## [0.2.1+dreasye.2] - 2026-10-29

> 数字段与上游保持一致（`0.2.1`），只用 `+dreasye.N` 递增区分本 fork 的构建。

### 修复

- **`material` 在缺 ffmpeg 时静默产出空结果**：yt-dlp 需要合并音视频流，拿不到 ffmpeg 时
  **不报错**（退出码 0），只把格式号插进扩展名，留下 `video.f100026.mp4` + `video.f30280.m4a`；
  而 `pickMedia` 只认 `video.mp4`，于是 `media` 为空 → 抽帧、拼图、提音轨、转写**全部跳过**，
  最终返回一个「成功但什么都没生成」的结果。修复三处：
  1. `downloadMedia` 增加 `--ffmpeg-location <目录>`，把插件已探测到的 ffmpeg 传给 yt-dlp，
     用户在设置页填好路径就等于 yt-dlp 也能用；
  2. `pickMedia` 增加 `<stem>.f<格式号><ext>` 回退匹配，即使没合并也能用上分离流；
  3. 找不到任何媒体文件时抛带指引的错误，不再返回空结果；音频也会尝试
     `video.f*.m4a` 这条分离流命名。
- **`probe` 无条件承诺「将使用语音识别」**：ASR 不可用时误导用户。现在先探测，无 ASR 时
  明确说「只会产出画面素材」。
- **`material` 不说明为什么没有转写**：现在把「站方无字幕 + 无可用 ASR / 已关闭转写」
  写进 `missingTools`，会出现在工具的 `hint` 里。
- **标题与产物目录名编码错乱**：`probeTitle` 用 `--print` 读 yt-dlp 的 stdout，而 Windows 下
  `yt-dlp.exe`（PyInstaller 打包）的 stdout 是系统码页（cp936），`PYTHONIOENCODING` 对它无效，
  中文与 emoji 会被按 UTF-8 解码成 `U+FFFD` 并写进目录名；工具把这条乱码路径返回给调用方，
  读文件必然 ENOENT。修复：
  1. 产物目录改用视频 id（ASCII、稳定），标题只作兜底，`meta.json` 里仍保留完整标题；
  2. 取元数据改用 `probe()` 的 `--dump-single-json`（`json.dumps` 默认 `ensure_ascii`，
     中文转义成 `\uXXXX`，不依赖子进程 stdout 编码），删除 `probeTitle`；
  3. `slugify` 剔除 `U+FFFD` 与非空白控制字符，任何来源的坏字符都进不了文件名。

## [0.2.1+dreasye.1] - 2026-10-29

> fork 自 `Aurum807/dsh-bilibili-video-summary`。`+dreasye.N` 是语义化版本里的
> build metadata，不改变版本优先级（`0.2.1+dreasye.1` 与上游 `0.2.1` 同级），
> 只用来标记这是本 fork 的构建。

### 新增

- **插件设置页**：在「设置 → 插件 → dsh-bilibili-video-summary」里填写 yt-dlp / ffmpeg /
  ffprobe / yt_dlp 模块目录 / Python 解释器五个路径，不用再配环境变量。五项都是 volatile
  字段，保存后立即生效，不需要重启宿主。
- `lib/client.js`：浏览器侧设置卡片，注册到宿主的 `plugins.bundle.config` 槽位。
- **转写设置进设置页**：自定义 ASR 命令、faster-whisper 模型、模型缓存目录、转写线程数、
  关闭转写五项，分别对应 `VIDEOSUM_ASR_CMD` / `VIDEOSUM_ASR_MODEL` / `HF_HOME` /
  `VIDEOSUM_ASR_THREADS` / `VIDEOSUM_ASR_DISABLE`。
  缓存目录进设置页是因为它原本靠 `WORKSPACE_DIR` 自动探测，宿主不注入该变量时会让插件
  重新下载整个模型（实测 484 MB）。
- **`faster_whisper_asr.py` 新增 `--threads`**：默认 0（交给 CTranslate2 自动决定），
  实测 4 核机器上自动只用到约 1.2 核；显式 4 线程让 291.7 秒音频从 294 秒降到 241 秒。

### 修复

- **工具返回值过不了宿主的输出校验**（两段都实测踩到，修好第一段才露出第二段）：
  1. 值为 `undefined` 的键被判「无损 JSON」失败：
     `tool "video_material" returned invalid output: value is not lossless JSON`；
  2. 值为 `null` 的键被判类型不符：
     `"value.transcriptFile" must be a string`（sheetsDir / framesDir 等同理）。
     `video-material` 用 `null` 表示「没有」，而 schema 把这些字段声明成 string。
  根因是之前一直卡在「找不到 yt-dlp」，`material` 从没进入成功分支，依赖配好后连续暴露。
  新增 `compact()`，在返回前剔除 `undefined` / `null` / `NaN` / `Infinity` / `-0`，
  probe 与 material 两条路径都过一遍；schema 里除 `ok` 外均非必填，缺键是合法表达。
- **探测缓存把「没找到」也缓存了**：装好 yt-dlp、或在设置页填了路径之后，只要宿主进程不
  重启就会一直返回旧的「未找到」。现在只缓存命中的结果，且配置一变就清空缓存。
- `whichSync` 不再缓存「PATH 上没找到」的否定结果。

### 变更

- 外部依赖的查找顺序改为 **设置页 > 环境变量 > 自动发现**；旧的 `VIDEOSUM_*` 环境变量仍然有效。
- 「未找到 yt-dlp / ffmpeg」的提示文案改为先指向设置页。

## [0.2.1] - 2026-10-19

### 修复

- **README 的转写说明和实现对不上**：原文写「ASR 不内置，只能靠 `VIDEOSUM_ASR_CMD` 自己配」，
  但 0.2.0 起已经会自动探测本机 faster-whisper，照原文读会以为必须手动配置。
  改为三级回退的真实描述：站方字幕 → 本机 faster-whisper → 自定义命令。
- 删掉一个并不存在的模块示例 `python -m faster_whisper_cli`，换成插件自带脚本的真实参数。
- `外部依赖` 表补上可选的 faster-whisper 一行，并说明缺了它会退回到「只有画面」。

### 变更

- `.gitignore` 增加 `__pycache__/`、`*.pyc`：在仓库里跑过一次
  `lib/asr/faster_whisper_asr.py` 就会生成 `lib/asr/__pycache__/`，
  而 `files` 里包含 `lib`，不排除会被一起发布。

## [0.2.0] - 2026-10-19

### 新增

- **自动探测本机 faster-whisper 做转写**：不用再自己拼 `VIDEOSUM_ASR_CMD`。
  装了 `pip install faster-whisper` 就能直接跑，插件会同时找到解释器与模型缓存目录
  （`HF_HOME`），默认 `small` 模型、CPU、`int8`，复用已下载的模型不重复下载。
- 新增 `lib/asr/faster_whisper_asr.py`：零依赖的调用脚本，输出 `[起-止] 文本` 行，
  参数 `--audio --out --model --lang --beam-size`。

### 变更

- 转写引擎改为三级回退：站方字幕 → 本机 faster-whisper → `VIDEOSUM_ASR_CMD`。
  三者都没有时仍产出画面素材，只是缺少逐字内容。
- `doctor` 输出新增 `asr` 字段，直接显示命中的是哪一级，例如 `faster-whisper/python.EXE`。

## [0.1.0] - 2026-10-16

首次发布。

### 新增

- **`video_material` 工具**：两个动作。
  `action=probe` 只取元数据（标题、作者、时长），用来确认链接是不是用户想说的那个视频；
  `action=material` 下载视频并准备全部总结素材——转写稿 `transcript.txt` / `.srt`、
  关键帧 `frames/`、拼图 `sheets/`、`meta.json`。
- **`bilibili-video-summary` 技能**：固化总结方法论——结论先行、
  两遍法读画面（先用 `sheets/` 通读全片，再回读 `frames/` 单张核对型号/重量/价格等细节）、
  ASR 识别的人名与型号必须回画面核对、静止文档类视频以画面文字为准。
- **自动启用**：通过 `agent/pre-step` 钩子，只在「用户消息里除了链接没有别的要求」时
  注入技能说明。消息里带「总结」「字幕」「怎么样」等明确要求时不会重复注入。
- **零依赖素材流水线** `lib/video-material.mjs`：也可单独当命令行用，
  子命令 `probe`、`material`、`frames`、`transcribe`、`doctor`。

### 说明

- **yt-dlp 探测会真的执行 `--version`**：按 显式路径 → PATH → `python -m yt_dlp`
  （自动尝试若干 `PYTHONPATH` 候选目录）的顺序验证，只有真能跑起来才算找到。
  这样 `doctor` 不会再把"文件存在但 import 不了"报成正常。
- **B 站走直连**：yt-dlp 会继承系统代理，而代理往往连不上 B 站 CDN，
  表现为 `HTTP Error 567`。插件对 `bilibili.com`、`bilivideo.com`、`hdslb.com`、`b23.tv`
  设置 `NO_PROXY` 直连，其他站点仍然走代理。
- **cookie 文件不会被改写**：yt-dlp 退出时会回写 cookie jar，
  因此插件先把 cookie 复制到插件数据目录再交给它，避免对只读位置写入失败。
- **索引文件表头用 ASCII**：`frames_index.txt`、`sheets_index.txt` 的表头是英文，
  避免不同编码下变成乱码影响模型读时间点。
- CI：`.github/workflows/check.yml` 在 Node 22 / 24 上跑语法检查、
  清单元数据检查、入口检查，并确认打包内容不含 cookie 等敏感文件。
