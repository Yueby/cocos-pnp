# cocos-pnp 项目指南

本仓库是一个 pnpm monorepo，用于维护 Cocos Creator 3.x playable ads 多渠道导出适配插件，当前重点维护 Cocos Creator 3.8.x+。整体结构分为两层：

- `packages/playable-adapter-core`：核心构建产物处理引擎，负责把 Cocos 3.x 构建结果转换为单文件 HTML 和各广告渠道包。
- `packages/playable-ads-adapter`：Cocos Creator 3.x 编辑器扩展层，负责面板、hooks、builder、worker、配置读取，并调用 core 执行实际适配。

根目录主要负责 workspace 编排和文档说明，不承载具体业务实现。除非任务明确要求，优先在相关 package 内做最小范围修改。

## 仓库结构

```text
.
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── README-CN.md
├── AGENTS.md
└── packages/
    ├── playable-adapter-core/
    └── playable-ads-adapter/
```

## 根目录与构建脚本

- `package.json`：工作区级脚本、版本信息、仓库信息和少量开发依赖。
- `pnpm-workspace.yaml`：workspace 范围为 `packages/**`。
- 根目录没有统一的 `rollup.config.js` 或 `tsconfig.json`；构建和 TypeScript 配置在各 package 内维护。
- `.adapterrc` / `.adapterrc.json`：用户 Cocos 项目根目录中的适配配置文件，不是本仓库根目录的固定配置。

常用根目录脚本：

```text
pnpm run build:core
pnpm run build
pnpm run watch
```

脚本关系：

- `build:core`：构建 `playable-adapter-core`。
- `build`：构建 core 和扩展产物。
- `watch`：进入扩展层对应 watch 流程。

## Cocos 版本定位

当前 fork 只维护 Cocos Creator 3.8.x 及以上版本。

开发时默认约束：

- 优先按 Cocos Creator 3.8.x+ 行为理解和验证。
- 除非任务明确要求处理历史记录，否则不要恢复或新增已移除的旧版适配代码。

## packages/playable-adapter-core

职责：核心 playable ads 构建产物处理引擎。

该包负责读取 Cocos 构建输出，执行图片压缩，生成单文件 HTML，内联 CSS / 脚本 / 资源，按渠道注入脚本，并导出广告渠道专用包。

关键路径：

- `src/index.ts`：公开入口，只导出类型和 `execAdapter`。
- `src/executor.ts`：顶层编排，流程为挂载全局上下文 → Tinify → 单文件合并 → 渠道打包 → 卸载上下文。
- `src/global.ts`：通过 `global.__playable_ads_adapter_global__` 保存 `buildFolderPath` 和 `adapterBuildConfig`。
- `src/merger/base.ts`：单文件 HTML 生成核心，处理 HTML、CSS、脚本、资源映射、settings、splash、title、资源压缩和运行时注入。
- `src/merger/index.ts`：单文件生成薄封装。
- `src/exporter/base.ts`：渠道导出公共逻辑，处理 HTML 写入、JS 拆分、全局符号替换、渠道脚本注入。
- `src/exporter/index.ts`：导出路径绑定。
- `src/packager/base.ts`：按 `exportChannels` 调度渠道生成，支持 `parallel` / `serial`。
- `src/packager/index.ts`：把 `TChannel` 映射到各渠道导出函数。
- `src/channels/`：各广告渠道差异化实现。
- `src/helpers/`：注入脚本、DOM 注入、Tinify、MRAID 等辅助逻辑。
- `src/utils/`：文件系统、资源映射、路径、配置读取、复制等底层工具。
- `src/typings/index.d.ts`：平台、渠道、配置、打包参数等核心类型约束。

核心数据流：

```text
execAdapter
  ↓
mountGlobalVars(buildFolderPath, adapterBuildConfig)
  ↓
execTinify()
  ↓
genSingleFile
  ↓
singleFilePath + resMapper + compDiff
  ↓
genChannelsPkg
  ↓
渠道目录 / 渠道 HTML / 渠道脚本 / 注入内容
  ↓
unmountGlobalVars()
```

修改 core 时的注意事项：

- `merger/base.ts` 和 `exporter/base.ts` 是最高风险区域，改动后应优先验证构建和渠道输出。
- `mountGlobalVars()` / `unmountGlobalVars()` 生命周期必须成对，不要提前清理全局上下文。
- `compDiff > 0` 和 `compDiff <= 0` 对应压缩 / 非压缩资源路径，改 merger/exporter 时要同时考虑。
- HTML 注入顺序有依赖关系，不要随意调整 CSS、资源、插件、渠道脚本和初始化脚本的注入顺序。
- 路径生成优先使用已有 helper，不要在业务代码里重复手拼路径规则。
- 新增或删除渠道时，必须同步 `TChannel`、`src/channels/index.ts`、`packager/index.ts`。

## packages/playable-ads-adapter

职责：Cocos Creator 编辑器侧适配层。

该包负责把 Cocos 构建生命周期接到 `playable-adapter-core`，并提供扩展入口、builder hooks、面板、worker 执行隔离、配置管理、日志回传和运行时辅助脚本。

关键路径：

- `src/main.ts`：Cocos 扩展入口，通过 `configs` 注册 `hooks` 和 `panel`，通过 `methods` 暴露 `builder` 与 `updateLanguage`。
- `src/hooks.ts`：构建生命周期入口，连接 `onBeforeBuild` / `onAfterBuild` 与 builder。
- `src/extensions/builder/index.ts`：构建编排层，读取配置、处理 `skipBuild`、组装 core 参数、调用 worker 或主线程兜底执行。
- `src/extensions/worker/index.ts`：通过 `worker_threads` 调用 core，并把 console 日志转发回主线程。
- `src/extensions/utils/file-system/adapterrc.ts`：读取 `.adapterrc.json` / `.adapterrc`，区分构建时读取和面板读取。
- `src/panels/builder/config.ts`：面板模板、样式、字段 ID、渠道选项、方向选项等静态配置。
- `src/panels/builder/panel.ts`：面板交互逻辑，负责配置读写、构建按钮、Tinify 校验、语言更新、构建状态遮罩等。
- `assets/Playable.ts`：游戏运行时辅助工具，暴露 `window.playable` 和 `Playable`。
- `@types/`：Cocos 编辑器和扩展包相关类型声明。

面板和构建链路：

```text
panel.ts（用户交互 / 配置编辑）
  ↓
builder/index.ts（组装参数 / 调度构建 / skipBuild）
  ↓
worker/index.ts（子线程执行 / 日志回传）
  ↓
playable-adapter-core.execAdapter(...)
```

修改 extension 时的注意事项：

- 保持 builder / worker / panel / config 的职责边界：builder 编排，worker 执行隔离，panel 负责 UI，config 负责静态模板和常量。
- 修改 `main.ts` 时，保护 `configs.hooks`、`configs.panel`、`methods.updateLanguage` 这些关键注册点。
- `readAdapterRCFile()` 会替换 `<ios>` / `<android>` 占位符；`readAdapterRCFileForPanel()` 应保留原始值供面板显示。
- 面板字段变更通常要同步 `config.ts`、`panel.ts` 和配置读写逻辑。
- worker 中的 console 重写用于日志回传，修改时不要破坏 `parentPort.postMessage` 链路。
- 调用 core 的参数形状应保持为 `buildFolderPath` + `adapterBuildConfig`，并由 builder 补充 `buildPlatform` / `orientation`。
- 构建流程中要保证 `buildState.notify(true/false)` 不会因异常路径导致面板 loading 卡死。
- `rollup.config.js` 固定 Cocos Creator 3.8.x+ 入口；修改入口、alias、worker 或 panel 路径时必须同步检查构建配置。
- `assets/Playable.ts` 是运行时脚本，不要混入编辑器侧逻辑。

## 支持渠道

渠道统一类型定义在 `packages/playable-adapter-core/src/typings/index.d.ts` 的 `TChannel`，统一导出入口在 `packages/playable-adapter-core/src/channels/index.ts`。

当前支持渠道：

| 渠道 | 备注 |
| --- | --- |
| `AppLovin` | core channels 支持 |
| `Bigo` | 本 fork 新增支持 |
| `Facebook` | core channels 支持 |
| `Google` | core channels 支持 |
| `IronSource` | core channels 支持 |
| `Liftoff` | core channels 支持 |
| `Mintegral` | core channels 支持 |
| `Moloco` | core channels 支持 |
| `Pangle` | core channels 支持 |
| `Rubeex` | core channels 支持 |
| `SnapChat` | 本 fork 新增支持 |
| `Tiktok` | core channels 支持 |
| `Unity` | core channels 支持 |
| `Yandex` | 本 fork 新增支持 |

渠道实现通常遵循：

```text
packages/playable-adapter-core/src/channels/<channel>/
  index.ts
  inject-vars.ts   # 可选
```

除非任务明确涉及渠道新增、修复或行为调整，否则不要重构 `src/channels/` 下的实现。

## `.adapterrc` / `.adapterrc.json` 配置要点

扩展层以 `.adapterrc.json` 作为主配置来源，并兼容旧 `.adapterrc`。文档中常见字段包括：

| 字段 | 用途 |
| --- | --- |
| `fileName` | 自定义导出文件名 |
| `title` | 自定义 HTML 标题 |
| `lang` | 导出语言标识 |
| `iosUrl` / `androidUrl` | 平台跳转 URL，也可替换注入脚本中的 `<ios>` / `<android>` |
| `buildPlatform` | Cocos 3.x 构建平台，常见为 `web-mobile` / `web-desktop` |
| `orientation` | 方向配置：`portrait` / `landscape` / `auto` |
| `skipBuild` | 是否跳过 Cocos 构建流程，直接执行适配 |
| `exportChannels` | 指定导出渠道；为空或不填时默认导出全部渠道 |
| `enableSplash` | 是否启用启动图处理 |
| `injectOptions` | 按渠道注入 `head`、`body`、`sdkScript` |
| `tinify` / `tinifyApiKey` / `tinifySkipUuids` | Tinypng 图片压缩相关配置 |
| `isZip` | 是否启用 Pako 资源压缩 |

配置相关改动要同时考虑：

- core 是否依赖该字段参与合并、导出或渠道注入。
- extension builder 是否会补充或改写该字段。
- 面板是否需要展示、保存或保留原始占位符。

## 本 fork 额外功能

- Cocos Creator 3.8.x+ 构建发布面板 UI。
- 自定义导出文件名和 HTML 标题。
- 自定义 iOS / Android URL，并支持在渠道注入脚本中替换 `<ios>` / `<android>`。
- 动态渠道名占位符 `{{__adv_channels_adapter__}}`。
- 新增 Bigo、SnapChat、Yandex 渠道支持。
- 优化 MRAID SDK 集成和平台生命周期管理。
- Tinypng 图片压缩与 Pako 资源压缩。
- 全局 `Playable` 工具类，用于渠道判断、语言读取、SDK ready、广告展示、游戏结束、重玩和暂停逻辑。

## 开发原则

- 优先做与任务直接相关的最小修改，不顺手重构无关代码。
- 先判断任务属于 core、extension、渠道、配置、面板还是构建脚本，再进入对应目录。
- 除非任务明确要求，不要跨 package 同时改动 core 和 extension。
- 涉及面板 UI 的改动应优先检查当前 Cocos Creator 3.8.x+ 扩展入口。
- 涉及渠道集合的改动必须同步类型、聚合导出和 packager 映射。
- 涉及构建输出、压缩、HTML 注入、渠道导出的改动，应运行相关 build 或至少说明未验证的原因。
