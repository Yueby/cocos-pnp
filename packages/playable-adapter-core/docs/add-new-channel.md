# 新增广告渠道适配指南

本文档用于指导开发者为 `cocos-pnp` 新增广告渠道。新增渠道分为两层：

- **Core 适配**：让 `playable-adapter-core` 能生成新渠道产物，这是最小必需链路。
- **Extension 同步**：让 Cocos Creator 编辑器面板、类型声明和运行时 `Playable` 工具识别新渠道，完整插件发布时建议同步。

除非只做内部实验，否则建议按本文的完整清单执行。

---

## 目录

- [总览](#总览)
- [命名约定](#命名约定)
- [Core 适配步骤](#core-适配步骤)
- [Extension 同步步骤](#extension-同步步骤)
- [导出方式选择](#导出方式选择)
- [渠道实现模板](#渠道实现模板)
- [核心 API 参考](#核心-api-参考)
- [MRAID 渠道适配](#mraid-渠道适配)
- [现有渠道实现参考](#现有渠道实现参考)
- [验证清单](#验证清单)
- [快速开始](#快速开始)

---

## 总览

最小 Core 适配需要修改 `packages/playable-adapter-core/src/` 下 4 个位置：

```text
1. typings/index.d.ts       -> TChannel 联合类型追加新渠道名
2. channels/<channel>/      -> 新建渠道目录和 index.ts
3. channels/index.ts        -> 聚合导出新渠道
4. packager/index.ts        -> 导入并注册 channelExports 映射
```

如果新渠道需要出现在 Cocos Creator 扩展面板中，还需要同步 `packages/playable-ads-adapter/`：

```text
5. src/global.d.ts              -> 同步 TChannel 联合类型
6. src/panels/builder/config.ts -> 同步 CHANNEL_OPTIONS，可选补 CHANNEL_TIPS
7. assets/Playable.ts           -> 同步 Channels 常量，可选补运行时生命周期方法
```

可选但建议同步的位置：

```text
README.md / README-CN.md
packages/playable-adapter-core/README.md
packages/playable-ads-adapter/README.md
```

`dist/` 是构建产物，不要手改；运行构建后由脚本生成。

---

## 命名约定

| 项目 | 约定 | 示例 |
|------|------|------|
| `TChannel` 字面量 | 与平台名称一致，通常 PascalCase | `Kwai`、`AppLovin`、`SnapChat` |
| 渠道目录名 | kebab-case | `kwai`、`app-lovin`、`iron-source` |
| 导出函数名 | `export` + 渠道名 | `exportKwai`、`exportAppLovin` |
| 默认 SDK 常量 | `AD_SDK_SCRIPT` 或更具体名称 | `AD_SDK_SCRIPT`、`KWAI_INIT_SCRIPT` |

注意：渠道名是运行时和 `.adapterrc.json` 中使用的精确字符串，大小写要和 `TChannel` 保持一致。

---

## Core 适配步骤

### Step 1：添加类型声明

编辑 `packages/playable-adapter-core/src/typings/index.d.ts`，在 `TChannel` 联合类型末尾追加新渠道名：

```ts
// 示例：新增 Kwai
export type TChannel = 'AppLovin' | 'Facebook' | 'Google' | ... | 'Bigo' | 'Kwai';
```

这个类型同时约束：

- `.adapterrc.json` 的 `exportChannels`
- `.adapterrc.json` 的 `injectOptions`
- `packager/index.ts` 的 `channelExports` 完整映射

### Step 2：创建渠道目录

在 `packages/playable-adapter-core/src/channels/` 下创建新目录：

```text
src/channels/kwai/
├── index.ts          # 必须，渠道主入口
└── inject-vars.ts    # 可选，SDK 脚本、meta、初始化脚本
```

`index.ts` 必须导出一个接收 `TChannelPkgOptions` 的异步函数，并在内部设置精确的 `channel`：

```ts
import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Kwai';

  await exportZipFromSingleFile({
    ...options,
    channel,
  });
};
```

请从 `@/exporter` 导入导出函数，不要从 `@/exporter/base` 导入。`@/exporter` 中的包装函数会自动读取单文件 HTML 路径；`base` 层函数签名不同，需要额外传入 `singleFilePath`。

### Step 3：注册聚合导出

编辑 `packages/playable-adapter-core/src/channels/index.ts`，追加导出：

```ts
export * from './kwai';
```

### Step 4：注册到 packager 映射

编辑 `packages/playable-adapter-core/src/packager/index.ts`：

```ts
import {
  // ...已有导入
  exportKwai,
} from '@/channels';

const channelExports: { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> } = {
  // ...已有渠道
  Kwai: exportKwai,
};
```

`exportChannels` 为空时会默认导出 `Object.keys(channelExports)` 中的所有渠道，所以这里的映射也是默认全量导出的来源。

---

## Extension 同步步骤

如果只通过 `.adapterrc.json` 手写新渠道并直接调用 core，Core 适配已经足够。若要让 Cocos Creator 编辑器扩展完整支持新渠道，请继续同步以下文件。

### Step 5：同步编辑器类型

编辑 `packages/playable-ads-adapter/src/global.d.ts`，把新渠道追加到扩展侧的 `TChannel`：

```ts
type TChannel = 'AppLovin' | 'Facebook' | ... | 'Bigo' | 'Kwai';
```

该文件是编辑器扩展侧的全局类型声明，不会自动从 core 复用。

### Step 6：同步面板渠道选项

编辑 `packages/playable-ads-adapter/src/panels/builder/config.ts`：

```ts
export const CHANNEL_OPTIONS: TChannel[] = [
  'AppLovin',
  // ...已有渠道
  'Bigo',
  'Kwai',
];
```

新增到 `CHANNEL_OPTIONS` 后，面板会自动：

- 渲染渠道选择按钮
- 生成默认 `injectOptions[channel]`
- 保存和读取该渠道的 `head` / `body` / `sdkScript`

如果渠道有特殊限制，可以同步补充 `CHANNEL_TIPS`：

```ts
export const CHANNEL_TIPS: Partial<Record<TChannel, TChannelTip>> = {
  Kwai: {
    message: '该渠道需要在结束页出现时调用 <b>Playable.tryGameEnd()</b>',
    level: 'warn',
  },
};
```

### Step 7：同步运行时 Playable 工具

编辑 `packages/playable-ads-adapter/assets/Playable.ts`，将新渠道加入 `Channels` 常量：

```ts
export const Channels = {
  // ...已有渠道
  Bigo: 'Bigo',
  Kwai: 'Kwai',
} as const;
```

如果渠道要求在游戏结束、重玩、启动或广告展示时调用平台 API，再同步扩展这些方法：

- `tryGameEnd()`：结束页出现时通知平台。
- `tryGameRetry()`：重玩时通知平台。
- `start()`：启动或可见性检查。
- `showAds()`：点击 CTA 跳转或展示广告。

如果新渠道不需要运行时特殊 API，只补 `Channels` 常量即可，方便业务侧写 `Playable.isChannel(Channels.Kwai)`。

---

## 导出方式选择

`packages/playable-adapter-core/src/exporter/index.ts` 暴露了三个常用导出函数。

| 函数 | 产物形态 | 适用场景 | 现有参考 |
|------|----------|----------|----------|
| `exportSingleFile(options)` | 直接输出一个 HTML | 平台接受单文件 HTML，不需要 zip | AppLovin、IronSource、Moloco、Unity |
| `exportZipFromSingleFile(options)` | 从合并后的单文件 HTML 生成 zip | 大多数渠道，仍希望使用资源内联/压缩后的 HTML | Bigo、Facebook、Google、Liftoff、Mintegral、SnapChat、Tiktok、Yandex |
| `exportZipFromPkg(options)` | 从原始构建目录复制并打包 | 渠道需要保留原始多文件结构，或不适合走单文件资源注入 | Pangle、Rubeex |

常见选项含义：

| 选项 | 说明 |
|------|------|
| `transformHTML` | 用 cheerio 修改 HTML，注入 SDK、meta、初始化脚本等。 |
| `transform` | HTML 处理后、打包前执行，常用于写 `config.json`。 |
| `fixInitScript` | 将 `__adapter_init_js();` 修成 `__adapter_init_js(!0);`。Google、Facebook、Mintegral、Yandex 等渠道使用。 |
| `dontExtractJS` | 仅 `exportZipFromSingleFile` 有效；为 `true` 时不把 body 内联脚本拆成单独 JS 文件。 |
| `exportType: 'zip'` | 输出 zip，拆出的脚本默认在 zip 根目录。 |
| `exportType: 'dirZip'` | 输出 zip，拆出的脚本放入 `js/` 目录。SnapChat、Tiktok 使用。 |
| `transformScript` | 拆分 body script 前逐个处理脚本内容。 |

处理顺序需要特别注意：

1. 先填充资源映射和渠道占位符。
2. 如果设置 `fixInitScript`，先修复初始化调用。
3. 自动注入 `.adapterrc.json` 中的 `injectOptions[channel].head/body`。
4. 执行渠道自己的 `transformHTML`。
5. `exportZipFromSingleFile` 若未设置 `dontExtractJS`，会再把 body 内联脚本拆成 JS 文件。

`injectOptions[channel].sdkScript` 不会自动注入，需要渠道代码主动调用 `getChannelRCSdkScript(channel)`。

---

## 渠道实现模板

### 模板 A：基于单文件 HTML 生成 zip

适用于大多数需要 zip 包、同时希望使用单文件合并能力的渠道。

```ts
// src/channels/kwai/inject-vars.ts
export const AD_SDK_SCRIPT = `<script src="https://your-cdn.example.com/kwai-sdk.js"></script>`;

export const KWAI_INIT_SCRIPT = `<script>(function(){
  function waitForReady() {
    if (typeof cc !== 'undefined' && typeof window.KWAI_SDK !== 'undefined') {
      window.KWAI_SDK.gameReady && window.KWAI_SDK.gameReady();
    } else {
      requestAnimationFrame(waitForReady);
    }
  }
  waitForReady();
})();</script>`;
```

```ts
// src/channels/kwai/index.ts
import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, KWAI_INIT_SCRIPT } from './inject-vars';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Kwai';

  await exportZipFromSingleFile({
    ...options,
    channel,
    dontExtractJS: true,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
      $(sdkInjectScript).prependTo('body');
      $(KWAI_INIT_SCRIPT).insertAfter($('body script').first());
    },
  });
};
```

### 模板 B：从原始构建目录打包

适用于需要保留 Cocos 原始构建目录结构的渠道。

```ts
import { exportZipFromPkg } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { exportConfigJson, getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT } from './inject-vars';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const { orientation } = options;
  const channel: TChannel = 'Kwai';

  await exportZipFromPkg({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
      $(sdkInjectScript).appendTo('head');
    },
    transform: async (destPath) => {
      await exportConfigJson({ destPath, orientation });
    },
  });
};
```

### 模板 C：直接导出单文件 HTML

适用于平台只收 HTML 文件的渠道。

```ts
import { exportSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, KWAI_INIT_SCRIPT } from './inject-vars';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Kwai';

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
      $(sdkInjectScript).appendTo('head');
      $(KWAI_INIT_SCRIPT).appendTo('head');
    },
  });
};
```

### 模板 D：写入 config.json

如果渠道要求额外的 `config.json`，在 `transform` 中写入：

```ts
import { ORIENTATION_MAP } from '@/constants';
import { exportConfigJson } from '@/utils';

transform: async (destPath) => {
  await exportConfigJson({
    destPath,
    customConfig: { orientation: ORIENTATION_MAP[orientation] },
  });
},
```

如果渠道接受项目默认格式，可以直接传 `orientation`：

```ts
transform: async (destPath) => {
  await exportConfigJson({ destPath, orientation });
},
```

默认格式为：

```json
{
  "playable_orientation": 0,
  "playable_languages": []
}
```

### 模板 E：注入方向 meta 标签

适用于 Google、Yandex 这类需要 `<meta name="ad.size">` 或 `<meta name="ad.orientation">` 的渠道。

```ts
import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, AUTO_META, LANDSCAPE_META, PORTRAIT_META } from './inject-vars';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const { orientation } = options;
  const channel: TChannel = 'Kwai';

  await exportZipFromSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const orientationMap = {
        landscape: LANDSCAPE_META,
        portrait: PORTRAIT_META,
        auto: AUTO_META,
      };
      $(orientationMap[orientation] || PORTRAIT_META).appendTo('head');

      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
      $(sdkInjectScript).appendTo('head');
    },
    exportType: 'zip',
    fixInitScript: true,
  });
};
```

---

## 核心 API 参考

### 类型

```ts
export type TChannelPkgOptions = {
  orientation: 'portrait' | 'landscape' | 'auto';
  resMapper?: TResourceData;
  compDiff?: number;
  lang?: string;
};

export type TBuilderOptions = {
  channel: TChannel;
  transformHTML?: ($: CheerioAPI) => Promise<void>;
  transform?: (destPath: string) => Promise<void>;
  fixInitScript?: boolean;
  lang?: string;
} & Pick<TChannelPkgOptions, 'resMapper' | 'compDiff'>;

export type TZipFromSingleFileOptions = TBuilderOptions & {
  transformScript?: (scriptNode: Cheerio<Element>) => Promise<void>;
  exportType?: 'zip' | 'dirZip';
  dontExtractJS?: boolean;
};
```

### 工具函数

| 函数 | 说明 |
|------|------|
| `getChannelRCSdkScript(channel)` | 读取 `.adapterrc.json` 中 `injectOptions[channel].sdkScript`；未配置返回空字符串。 |
| `exportConfigJson({ destPath, orientation, languages, customConfig })` | 在导出临时目录写入 `config.json`。传 `customConfig` 时会完全使用自定义对象。 |
| `injectFromRCJson($, channel)` | 自动注入 `injectOptions[channel].head/body`，由导出框架调用，渠道代码通常不需要手动调用。 |

### 常量

| 常量 | 说明 |
|------|------|
| `ORIENTATION_MAP` | `{ auto: 0, portrait: 1, landscape: 2 }`。 |
| `REPLACE_SYMBOL` | `{{__adv_channels_adapter__}}`，构建时替换为当前渠道名。 |

---

## MRAID 渠道适配

MRAID 渠道可以复用 `packages/playable-adapter-core/src/helpers/mraid-scripts.ts`：

```ts
import { createMraidScript, MRAID_SDK_SCRIPT } from '@/helpers/mraid-scripts';

export const AD_SDK_SCRIPT = MRAID_SDK_SCRIPT;
export const MRAID_INIT_SCRIPT = createMraidScript({});
```

常见配置：

```ts
export const MRAID_INIT_SCRIPT = createMraidScript({
  stateChange: true,
  viewableChange: true,
  needGameControl: true,
});
```

`createMraidScript` 支持：

| 配置 | 说明 |
|------|------|
| `onReady` | MRAID ready 后追加执行的脚本字符串。 |
| `stateChange` | `true` 时打印状态；传字符串时作为自定义处理逻辑。 |
| `viewableChange` | `true` 时监听可见性；传字符串时作为自定义处理逻辑。 |
| `needGameControl` | 注入 `resumeGame` / `pauseGame` / `window.checkViewable`。 |
| `onViewableChange` | `viewableChange` 为 `true` 时使用的自定义可见性逻辑。 |

使用 `viewableChange` 时建议同时设置 `needGameControl: true`。当前工具生成的 ready 逻辑会调用游戏恢复函数，新渠道如果不需要内置暂停/恢复，更稳妥的做法是自写初始化脚本。

---

## 现有渠道实现参考

| 渠道 | 导出函数 | 要点 |
|------|----------|------|
| AppLovin | `exportSingleFile` | MRAID SDK + ready 脚本，输出单 HTML。 |
| Bigo | `exportZipFromSingleFile` | 自有 SDK，`dontExtractJS: true`，写自定义 `config.json`。 |
| Facebook | `exportZipFromSingleFile` | 注入 `navigator.getGamepads = null` 补丁，`fixInitScript: true`。 |
| Google | `exportZipFromSingleFile` | 注入方向 meta 和 ExitApi SDK，`fixInitScript: true`。 |
| IronSource | `exportSingleFile` | MRAID SDK + 初始化脚本，输出单 HTML。 |
| Liftoff | `exportZipFromSingleFile` | MRAID SDK，输出 zip。 |
| Mintegral | `exportZipFromSingleFile` | 注入 Mintegral 初始化脚本，`fixInitScript: true`。 |
| Moloco | `exportSingleFile` | 从 `sdkScript` 读取平台 SDK 并插入 body 首个 script 前。 |
| Pangle | `exportZipFromPkg` | 基于原始构建目录打包，写默认 `config.json`。 |
| Rubeex | `exportZipFromPkg` | 基于原始构建目录打包，注入 Cordova/onload 和 SDK。 |
| SnapChat | `exportZipFromSingleFile` | `exportType: 'dirZip'`，`dontExtractJS: true`，写自定义 `config.json`。 |
| Tiktok | `exportZipFromSingleFile` | `exportType: 'dirZip'`，写默认 `config.json`。 |
| Unity | `exportSingleFile` | MRAID viewableChange + 游戏暂停/恢复控制，输出单 HTML。 |
| Yandex | `exportZipFromSingleFile` | 注入 `ad.size` meta，SDK 来自 `sdkScript`，`fixInitScript: true`。 |

---

## 验证清单

Core 必查：

- [ ] `packages/playable-adapter-core/src/typings/index.d.ts` 的 `TChannel` 已包含新渠道名。
- [ ] `packages/playable-adapter-core/src/channels/<channel>/index.ts` 已创建，并导出正确函数。
- [ ] `packages/playable-adapter-core/src/channels/index.ts` 已聚合导出。
- [ ] `packages/playable-adapter-core/src/packager/index.ts` 已导入并注册 `channelExports`。
- [ ] `.adapterrc.json` 的 `exportChannels` 配置新渠道名后可以生成产物。
- [ ] 生成 HTML 中 SDK、meta、初始化脚本位置正确。
- [ ] 如支持用户自定义 SDK，`injectOptions[channel].sdkScript` 可覆盖默认 SDK。
- [ ] 如使用 `injectOptions[channel].head/body`，确认自动注入顺序符合预期。
- [ ] 如使用 `config.json`，确认内容和渠道要求一致。
- [ ] `compDiff > 0` 和 `compDiff <= 0` 两种资源模式下产物可运行。

Extension 必查：

- [ ] `packages/playable-ads-adapter/src/global.d.ts` 已同步 `TChannel`。
- [ ] `packages/playable-ads-adapter/src/panels/builder/config.ts` 已同步 `CHANNEL_OPTIONS`。
- [ ] 如有渠道提示，`CHANNEL_TIPS` 已补充。
- [ ] `packages/playable-ads-adapter/assets/Playable.ts` 已同步 `Channels`。
- [ ] 如渠道需要生命周期 API，`tryGameEnd` / `tryGameRetry` / `start` / `showAds` 已补充。
- [ ] 面板能选择新渠道，并能保存对应 `injectOptions`。

构建验证：

```bash
pnpm run build:core
pnpm run build
```

---

## 快速开始

假设新增渠道 `Kwai`。

### 1. Core 类型

`packages/playable-adapter-core/src/typings/index.d.ts`：

```ts
export type TChannel = 'AppLovin' | 'Facebook' | ... | 'Bigo' | 'Kwai';
```

### 2. Core 渠道文件

`packages/playable-adapter-core/src/channels/kwai/inject-vars.ts`：

```ts
export const AD_SDK_SCRIPT = `<script src="https://your-cdn.example.com/kwai-sdk.js"></script>`;

export const KWAI_INIT_SCRIPT = `<script>(function(){
  function waitForReady() {
    if (typeof cc !== 'undefined' && typeof window.KWAI_SDK !== 'undefined') {
      window.KWAI_SDK.gameReady && window.KWAI_SDK.gameReady();
    } else {
      requestAnimationFrame(waitForReady);
    }
  }
  waitForReady();
})();</script>`;
```

`packages/playable-adapter-core/src/channels/kwai/index.ts`：

```ts
import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, KWAI_INIT_SCRIPT } from './inject-vars';

export const exportKwai = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Kwai';

  await exportZipFromSingleFile({
    ...options,
    channel,
    dontExtractJS: true,
    transformHTML: async ($) => {
      const sdkScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
      $(sdkScript).prependTo('body');
      $(KWAI_INIT_SCRIPT).insertAfter($('body script').first());
    },
  });
};
```

### 3. Core 注册

`packages/playable-adapter-core/src/channels/index.ts`：

```ts
export * from './kwai';
```

`packages/playable-adapter-core/src/packager/index.ts`：

```ts
import { exportKwai } from '@/channels';

const channelExports = {
  // ...已有渠道
  Kwai: exportKwai,
};
```

### 4. Extension 同步

`packages/playable-ads-adapter/src/global.d.ts`：

```ts
type TChannel = 'AppLovin' | 'Facebook' | ... | 'Bigo' | 'Kwai';
```

`packages/playable-ads-adapter/src/panels/builder/config.ts`：

```ts
export const CHANNEL_OPTIONS: TChannel[] = [
  'AppLovin',
  // ...已有渠道
  'Bigo',
  'Kwai',
];
```

`packages/playable-ads-adapter/assets/Playable.ts`：

```ts
export const Channels = {
  // ...已有渠道
  Bigo: 'Bigo',
  Kwai: 'Kwai',
} as const;
```

完成后运行：

```bash
pnpm run build:core
pnpm run build
```
