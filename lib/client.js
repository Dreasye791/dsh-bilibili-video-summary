/**
 * dsh-bilibili-video-summary —— 浏览器侧（设置页卡片）
 *
 * 只做一件事：在「设置 → 插件 → dsh-bilibili-video-summary」里给出外部依赖路径表，
 * 让用户不用改环境变量、也不用重启宿主就能填 yt-dlp / ffmpeg 的位置。
 *
 * 两个关键契约（与宿主 DSH 0.2.1-rc.3 实测一致）：
 *  1. 卡片出不出现，只看浏览器侧有没有按 `key: <包名>` 注册 `plugins.bundle.config` 槽位；
 *  2. 字段能不能在线改，只看宿主 Config schema 里该字段有没有 volatile——
 *     一个 volatile 字段都没有的条目会被 `volatileForm(schema)` 整条丢弃。
 *
 * 表单控制器取 `configForms.get('<profile 条目 id>')`：参数是宿主 profile 里的 `- id:`，
 * 不是包名。本插件两者同名，但概念要分清。
 */
window.__ModuleLoader__.load({
  id: "dsh-bilibili-video-summary",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");

    const NS = "bilibili-video-summary";
    /** 槽位 key：必须是包名。 */
    const PACKAGE_NAME = "dsh-bilibili-video-summary";
    /** configForms 命名空间：宿主 profile 条目 id。 */
    const ENTRY_ID = "dsh-bilibili-video-summary";

    const zh = {
      title: "B 站视频总结",
      description: "把视频链接变成可总结的素材。下面几项是外部工具路径，留空表示自动发现。",
      depsGroup: "外部依赖路径",
      depsNote: "留空 = 自动发现（PATH / 工作区 .pylibs / 解释器 site-packages）。保存后立即生效，不必重启。",
      ytdlpPath: "yt-dlp 可执行文件",
      ytdlpPathHint: "例如 D:\\tools\\yt-dlp.exe。填目录不算，这里必须是文件。",
      ffmpegPath: "ffmpeg",
      ffmpegPathHint: "用于抽帧与音频处理；缺它时只能下载到视频，无法生成关键帧。",
      ffprobePath: "ffprobe",
      ffprobePathHint: "通常与 ffmpeg 同目录，缺它时读不到媒体时长。",
      pylibsDir: "yt_dlp 模块目录",
      pylibsDirHint: "只装了 Python 包、没有 exe 时用这个：填含 yt_dlp 子目录的那一层。",
      pythonPath: "Python 解释器",
      pythonPathHint: "只在上面的模块目录方式下生效；留空则用 PATH 上的 python。",
      overridden: "已覆盖",
      reset: "恢复自动",
      placeholderAuto: "自动",
      saveFailed: "保存失败，已恢复为宿主当前值。",
      loading: "正在读取设置…",
      unavailable: "宿主未加载本插件的设置（该条目没有可在线修改的字段，或插件未挂载）。",
      summary: "外部依赖路径与转写设置可在插件详情页修改。",
      asrGroup: "语音转写（ASR）",
      asrNote: "站方有字幕时不会走 ASR；下面填的自定义命令优先于内置 faster-whisper。",
      asrCommand: "自定义 ASR 命令",
      asrCommandHint: "留空则用内置 faster-whisper。模板里 {audio} 换成音频路径、{out} 换成输出 txt；不含 {out} 时读 stdout。",
      asrModel: "faster-whisper 模型",
      asrModelHint: "留空用 small。模型越大越慢，首次使用会自动下载。",
      hfCacheDir: "模型缓存目录",
      hfCacheDirHint: "填 HF_HOME 那一层（里面有 hub 子目录）。留空依次回落到 HF_HOME 环境变量、工作区 .hf_cache、宿主临时目录；填错会导致重新下载整个模型。",
      asrThreads: "转写线程数",
      asrThreadsHint: "0 = 自动（实测 4 核机器上只用约 1.2 核）。填核数（如 4）可快约 18%，代价是转写期间 CPU 会跑满。填了上面的自定义命令时本项不会自动追加，需在命令里写 {threads} 引用它。",
      asrDisabled: "关闭语音转写",
      asrDisabledHint: "勾选后不再跑 ASR（站方字幕仍会用）。",
      on: "已关闭",
      off: "已启用",
    };

    const en = {
      title: "Bilibili Video Summary",
      description: "Turns a video link into summarizable material. The paths below are optional; empty means auto-discovery.",
      depsGroup: "External tool paths",
      depsNote: "Empty = auto-discovery (PATH / workspace .pylibs / interpreter site-packages). Changes apply immediately, no restart.",
      ytdlpPath: "yt-dlp executable",
      ytdlpPathHint: "For example D:\\tools\\yt-dlp.exe. A directory is not enough — must be the file.",
      ffmpegPath: "ffmpeg",
      ffmpegPathHint: "Used for frame extraction and audio; without it you only get the downloaded video.",
      ffprobePath: "ffprobe",
      ffprobePathHint: "Usually next to ffmpeg; without it media duration cannot be read.",
      pylibsDir: "yt_dlp module directory",
      pylibsDirHint: "For a Python-only install: the directory that contains the yt_dlp folder.",
      pythonPath: "Python interpreter",
      pythonPathHint: "Only used with the module directory above; empty means python from PATH.",
      overridden: "overridden",
      reset: "Reset to auto",
      placeholderAuto: "auto",
      saveFailed: "Save failed; reverted to the host value.",
      loading: "Loading settings…",
      unavailable: "The host does not serve settings for this plugin (no live-editable field, or the plugin is not mounted).",
      summary: "External tool paths and transcription settings can be edited on the plugin detail page.",
      asrGroup: "Speech transcription (ASR)",
      asrNote: "Uploader subtitles take precedence over ASR; a custom command below wins over the built-in faster-whisper.",
      asrCommand: "Custom ASR command",
      asrCommandHint: "Empty uses the built-in faster-whisper. {audio} is the audio path, {out} the output txt; without {out} stdout is read.",
      asrModel: "faster-whisper model",
      asrModelHint: "Empty means small. Larger models are slower; the first run downloads it.",
      hfCacheDir: "Model cache directory",
      hfCacheDirHint: "Point at the HF_HOME level (the one containing hub/). Empty falls back to the HF_HOME env var, workspace .hf_cache, then host temp; a wrong value re-downloads the whole model.",
      asrThreads: "Transcription threads",
      asrThreadsHint: "0 = automatic (measured: only ~1.2 cores used on a 4-core box). Set it to the core count for ~18% faster runs, at the cost of saturating the CPU. With a custom command above this value is not appended automatically — reference it as {threads} in the command.",
      asrDisabled: "Disable transcription",
      asrDisabledHint: "Skip ASR entirely (uploader subtitles are still used).",
      on: "disabled",
      off: "enabled",
    };

    /** 可在线改的路径字段。顺序即渲染顺序。 */
    const FIELDS = [
      { key: "ytdlpPath", group: "deps", kind: "text", placeholder: "D:\\tools\\yt-dlp.exe" },
      { key: "ffmpegPath", group: "deps", kind: "text", placeholder: "D:\\tools\\ffmpeg\\bin\\ffmpeg.exe" },
      { key: "ffprobePath", group: "deps", kind: "text", placeholder: "D:\\tools\\ffmpeg\\bin\\ffprobe.exe" },
      { key: "pylibsDir", group: "deps", kind: "text", placeholder: "D:\\tools\\pylibs" },
      { key: "pythonPath", group: "deps", kind: "text", placeholder: "D:\\tools\\python\\python.exe" },
      { key: "asrCommand", group: "asr", kind: "text", placeholder: "whisper-cli {audio} --out {out}" },
      { key: "asrModel", group: "asr", kind: "text", placeholder: "small" },
      { key: "hfCacheDir", group: "asr", kind: "text", placeholder: "D:\\tools\\hf_cache" },
      { key: "asrThreads", group: "asr", kind: "number", min: 0 },
      { key: "asrDisabled", group: "asr", kind: "bool" },
    ];

    const S = {
      card: { display: "flex", flexDirection: "column", gap: 18, padding: "4px 2px", maxWidth: 720 },
      title: { margin: 0, fontSize: 15, fontWeight: 600 },
      desc: { margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.72 },
      group: { display: "flex", flexDirection: "column", gap: 10 },
      groupHead: { fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", opacity: 0.55, textTransform: "uppercase" },
      note: { margin: 0, fontSize: 12, lineHeight: 1.6, opacity: 0.62 },
      row: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        border: "1px solid rgba(127,127,127,0.28)",
        borderRadius: 8,
      },
      rowHead: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
      label: { fontSize: 13, fontWeight: 600 },
      hint: { margin: 0, fontSize: 12, lineHeight: 1.55, opacity: 0.62 },
      controls: { display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" },
      input: {
        width: "100%",
        boxSizing: "border-box",
        borderRadius: 6,
        border: "1px solid rgba(127,127,127,0.45)",
        background: "transparent",
        color: "inherit",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 12,
        lineHeight: "20px",
        padding: "5px 8px",
      },
      badge: {
        fontSize: 11,
        lineHeight: "16px",
        padding: "1px 7px",
        borderRadius: 999,
        border: "1px solid rgba(127,127,127,0.45)",
        opacity: 0.8,
      },
      reset: {
        cursor: "pointer",
        borderRadius: 6,
        border: "1px solid rgba(127,127,127,0.45)",
        background: "transparent",
        color: "inherit",
        fontFamily: "inherit",
        fontSize: 12,
        lineHeight: "18px",
        padding: "3px 10px",
        whiteSpace: "nowrap",
      },
      number: {
        width: 84,
        boxSizing: "border-box",
        borderRadius: 6,
        border: "1px solid rgba(127,127,127,0.45)",
        background: "transparent",
        color: "inherit",
        fontFamily: "inherit",
        fontSize: 13,
        lineHeight: "20px",
        padding: "4px 8px",
        textAlign: "right",
      },
      error: { margin: 0, fontSize: 12, lineHeight: 1.6, color: "#e5484d" },
    };

    /** 一个路径字段：本地草稿 + 失焦/回车提交 + 「恢复自动」（写空即 unset）。 */
    function TextField(props) {
      const { field, value, overridden, t, onCommit, onReset } = props;
      const current = value === undefined || value === null ? "" : String(value);
      const [draft, setDraft] = React.useState(current);
      const [failed, setFailed] = React.useState(false);

      // 宿主值变化（保存成功、或多端同时改）时回到权威值。
      React.useEffect(() => {
        setDraft(current);
        setFailed(false);
      }, [current]);

      const revert = () => {
        setDraft(current);
        setFailed(false);
      };

      const commit = () => {
        const next = draft.trim();
        if (next === current) return;
        setFailed(false);
        // 清空输入等于「恢复自动发现」：写空串在宿主侧会留下一条无意义覆盖，所以走 unset。
        const action = next === "" ? onReset() : onCommit(next);
        Promise.resolve(action).then((ok) => {
          if (ok === false) {
            setDraft(current);
            setFailed(true);
          }
        });
      };

      const onKeyDown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          revert();
        }
      };

      return React.createElement(
        "div",
        { style: S.row },
        React.createElement(
          "div",
          { style: S.rowHead },
          React.createElement("span", { style: S.label }, t(field.key)),
          overridden ? React.createElement("span", { style: S.badge }, t("overridden")) : null,
          overridden
            ? React.createElement(
                "span",
                { style: S.controls },
                React.createElement("button", { type: "button", onClick: () => onReset(), style: S.reset }, t("reset")),
              )
            : null,
        ),
        React.createElement("input", {
          type: "text",
          spellCheck: false,
          autoComplete: "off",
          value: draft,
          placeholder: field.placeholder ?? t("placeholderAuto"),
          "aria-label": t(field.key),
          onChange: (event) => setDraft(event.target.value),
          onBlur: commit,
          onKeyDown,
          style: S.input,
        }),
        React.createElement("p", { style: S.hint }, t(`${field.key}Hint`)),
        failed ? React.createElement("p", { style: S.error }, t("saveFailed")) : null,
      );
    }

    /** 一个数字字段：本地草稿 + 失焦/回车提交 + 「恢复默认」。 */
    function NumberField(props) {
      const { field, value, overridden, t, onCommit, onReset } = props;
      const current = Number(value) || 0;
      const [draft, setDraft] = React.useState(() => String(current));
      const [failed, setFailed] = React.useState(false);

      React.useEffect(() => {
        setDraft(String(current));
        setFailed(false);
      }, [current]);

      const commit = () => {
        const parsed = Number(draft.trim());
        if (!Number.isInteger(parsed) || parsed < (field.min ?? 0)) {
          setDraft(String(current));
          return;
        }
        if (parsed === current) return;
        setFailed(false);
        Promise.resolve(onCommit(parsed)).then((ok) => {
          if (ok === false) {
            setDraft(String(current));
            setFailed(true);
          }
        });
      };

      const onKeyDown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(String(current));
        }
      };

      return React.createElement(
        "div",
        { style: S.row },
        React.createElement(
          "div",
          { style: S.rowHead },
          React.createElement("span", { style: S.label }, t(field.key)),
          overridden ? React.createElement("span", { style: S.badge }, t("overridden")) : null,
          React.createElement(
            "span",
            { style: S.controls },
            React.createElement("input", {
              type: "number",
              inputMode: "numeric",
              min: field.min ?? 0,
              step: 1,
              value: draft,
              "aria-label": t(field.key),
              onChange: (event) => setDraft(event.target.value),
              onBlur: commit,
              onKeyDown,
              style: S.number,
            }),
            overridden
              ? React.createElement("button", { type: "button", onClick: () => onReset(), style: S.reset }, t("reset"))
              : null,
          ),
        ),
        React.createElement("p", { style: S.hint }, t(`${field.key}Hint`)),
        failed ? React.createElement("p", { style: S.error }, t("saveFailed")) : null,
      );
    }

    /** 一个开关字段：勾选写入 true，取消勾选走 unset 回到宿主默认。 */
    function ToggleField(props) {
      const { field, value, overridden, t, onCommit, onReset } = props;
      const checked = value === true;
      const [failed, setFailed] = React.useState(false);

      const toggle = () => {
        setFailed(false);
        const action = checked ? onReset() : onCommit(true);
        Promise.resolve(action).then((ok) => {
          if (ok === false) setFailed(true);
        });
      };

      return React.createElement(
        "div",
        { style: S.row },
        React.createElement(
          "div",
          { style: S.rowHead },
          React.createElement("span", { style: S.label }, t(field.key)),
          overridden ? React.createElement("span", { style: S.badge }, t("overridden")) : null,
          React.createElement(
            "label",
            { style: S.controls },
            React.createElement("input", {
              type: "checkbox",
              checked,
              "aria-label": t(field.key),
              onChange: toggle,
              style: { width: 14, height: 14, margin: 0, cursor: "pointer" },
            }),
            React.createElement("span", { style: S.hint }, checked ? t("on") : t("off")),
          ),
        ),
        React.createElement("p", { style: S.hint }, t(`${field.key}Hint`)),
        failed ? React.createElement("p", { style: S.error }, t("saveFailed")) : null,
      );
    }

    function Card(props) {
      const { settings, t, view } = props;
      const subscribe = React.useCallback((listener) => settings.subscribe(listener), [settings]);
      const read = React.useCallback(() => settings.getSnapshot(), [settings]);
      const snapshot = React.useSyncExternalStore(subscribe, read, read);

      if (view === "summary") {
        return React.createElement("p", { style: S.note }, t("summary"));
      }

      const status = snapshot?.status;
      if (status === "loading") {
        return React.createElement("p", { style: S.note }, t("loading"));
      }
      if (status !== "ready" || snapshot.value === undefined || snapshot.value === null) {
        return React.createElement("p", { style: S.note }, t("unavailable"));
      }

      const value = snapshot.value;
      const user = snapshot.user ?? {};
      const readonly = snapshot.writable === false;

      const groups = [
        { id: "deps", label: t("depsGroup"), note: t("depsNote") },
        { id: "asr", label: t("asrGroup"), note: t("asrNote") },
      ];

      /** 只读态展示：布尔字段转换为「已关闭 / 已启用」，其余显示原值或「自动」。 */
      const display = (field) =>
        field.kind === "bool" ? t(value[field.key] === true ? "on" : "off") : String(value[field.key] ?? "") || t("placeholderAuto");

      return React.createElement(
        "div",
        { style: S.card, "data-bilibili-video-summary-settings": true },
        React.createElement("h3", { style: S.title }, t("title")),
        React.createElement("p", { style: S.desc }, t("description")),
        groups.map((group) =>
          React.createElement(
            "div",
            { key: group.id, style: S.group },
            React.createElement("div", { style: S.groupHead }, group.label),
            React.createElement("p", { style: S.note }, group.note),
            FIELDS.filter((field) => field.group === group.id).map((field) => {
              const overridden = Object.prototype.hasOwnProperty.call(user, field.key);
              if (readonly) {
                return React.createElement(
                  "div",
                  { key: field.key, style: S.row },
                  React.createElement(
                    "div",
                    { style: S.rowHead },
                    React.createElement("span", { style: S.label }, t(field.key)),
                    React.createElement(
                      "span",
                      { style: S.controls },
                      React.createElement("span", { style: S.hint }, display(field)),
                    ),
                  ),
                  React.createElement("p", { style: S.hint }, t(`${field.key}Hint`)),
                );
              }
              const handlers = {
                key: field.key,
                field,
                value: value[field.key],
                overridden,
                t,
                onCommit: (next) => settings.set(field.key, next),
                onReset: () => settings.unset(field.key),
              };
              if (field.kind === "bool") return React.createElement(ToggleField, handlers);
              if (field.kind === "number") return React.createElement(NumberField, handlers);
              return React.createElement(TextField, handlers);
            }),
          ),
        ),
      );
    }

    const inject = ["slots", "locale"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "bilibili-video-summary: dictionaries");
      const t = ctx.locale.bind(NS);

      // 延迟注入 configForms：宿主没装设置插件时，本卡片只是不出现，不影响别的功能。
      ctx.inject(["configForms"], (settingsCtx) => {
        const forms = settingsCtx.configForms ?? settingsCtx.get?.("configForms");
        if (forms === undefined || forms === null) return;
        const settings = forms.get(ENTRY_ID);
        const options = {
          name: "plugins.bundle.config",
          key: PACKAGE_NAME,
          locale: NS,
          inject: () => ({ settings, t }),
        };
        settingsCtx.slots.inject("plugins.bundle.config", () =>
          settingsCtx.slots.register(options, (slotProps) =>
            React.createElement(Card, { ...slotProps, settings, t }),
          ),
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
