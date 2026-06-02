# Cocos Playable Ads Adapter

Cocos Creator 广告试玩多渠道导出插件。

> 当前 fork **仅维护 Cocos Creator 3.8.x 及以上版本**。Cocos Creator 2.x 支持已移除。

## 包结构

```text
packages/
├── playable-adapter-core   # 核心适配引擎
└── playable-ads-adapter    # Cocos Creator 编辑器扩展
```

### `playable-adapter-core`

核心构建产物处理引擎。负责读取 Cocos Web 构建结果，生成单文件 HTML，内联资源、脚本和样式，执行压缩，并导出各广告渠道需要的包结构。

标准 API：

```ts
import { execAdapter } from 'playable-adapter-core';

await execAdapter({
  buildFolderPath: '/path/to/build/web-mobile',
  adapterBuildConfig: {
    buildPlatform: 'web-mobile',
    orientation: 'auto',
    exportChannels: ['Google', 'Facebook'],
  },
});
```

### `playable-ads-adapter`

Cocos Creator 3.8.x+ 编辑器扩展。提供构建面板、构建 hooks、外部 Node 子进程执行隔离、`.adapterrc` 配置读写、日志转发，并调用 `playable-adapter-core` 生成试玩广告渠道包。

## 支持渠道

| 渠道 | 支持 |
| --- | --- |
| AppLovin | ✅ |
| Bigo | ✅ |
| Facebook | ✅ |
| Google | ✅ |
| IronSource | ✅ |
| Liftoff | ✅ |
| Mintegral | ✅ |
| Moloco | ✅ |
| Pangle | ✅ |
| Rubeex | ✅ |
| SnapChat | ✅ |
| Tiktok | ✅ |
| Unity | ✅ |
| Yandex | ✅ |

## 主要功能

- Cocos Creator 3.8.x+ 构建发布面板集成。
- Cocos 构建 hooks 后自动适配。
- 通过扩展菜单/面板手动构建。
- 支持 `skipBuild`，跳过 Cocos 构建并直接适配已有构建目录。
- 生成单文件 HTML。
- 按渠道导出 zip 或目录 zip。
- 自定义导出文件名和 HTML 标题。
- 自定义 iOS / Android 跳转链接，并支持在注入脚本里替换 `<ios>` / `<android>`。
- 动态渠道名占位符 `{{__adv_channels_adapter__}}`。
- 可选本地 sharp 图片压缩，默认质量 `60`。
- 适配执行和 sharp 压缩均通过外部 Node 子进程运行，避免阻塞 Cocos Editor 进程。
- 可选 Pako 资源压缩。
- 运行时 `Playable` 工具类，用于渠道判断和常用广告生命周期调用。

## 安装插件

从 releases 下载插件包：

[https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)

请先按你的系统/架构选择对应 zip。当前打包脚本生成平台独立的 x64 包：

- `playable-ads-adapter-v<version>-win32-x64.zip`
- `playable-ads-adapter-v<version>-darwin-x64.zip`

再解压到 Cocos Creator 项目的扩展目录：

```text
<your-cocos-project>/extensions/playable-ads-adapter
```

如果扩展没有立即出现，重启 Cocos Creator 项目。解压后无需额外执行 `npm install`。

构建时需要本机可用的 Node.js，因为适配和 sharp 压缩都通过外部 Node 子进程执行。请确保 `node` 已加入 `PATH`，或设置 `NODE_BINARY` 指向 `node.exe` / `node` 的绝对路径。

## 使用插件

插件有两种使用方式：

1. **Cocos 构建 hooks**：在 Cocos Creator 中构建 `web-mobile` 或 `web-desktop` 后自动适配。
2. **扩展面板**：打开 **多渠道构建** 菜单，点击 **开始构建**。

面板会读取和写入 Cocos 项目根目录下的 `.adapterrc.json`。旧的 `.adapterrc` 文件名仍会被读取，用于兼容已有项目。

## `.adapterrc.json` 示例

```json
{
  "fileName": "playable",
  "title": "Playable Ad",
  "lang": "en",
  "iosUrl": "https://example.com/ios",
  "androidUrl": "https://example.com/android",
  "buildPlatform": "web-mobile",
  "orientation": "auto",
  "skipBuild": false,
  "exportChannels": ["Google", "Facebook"],
  "enableSplash": true,
  "isZip": true,
  "compress": {
    "enable": true,
    "quality": 60,
    "skipUuids": [],
    "concurrency": 8
  },
  "injectOptions": {
    "Unity": {
      "body": "<script>var iosUrl='<ios>';var androidUrl='<android>';</script>",
      "sdkScript": "<script src=\"./mraid.js\"></script>"
    }
  }
}
```

常用字段：

| 字段 | 说明 |
| --- | --- |
| `fileName` | 自定义导出文件名。 |
| `title` | 自定义 HTML 标题。 |
| `lang` | 暴露给运行时代码的语言值。 |
| `iosUrl` / `androidUrl` | 商店链接，也用于替换 `<ios>` / `<android>`。 |
| `buildPlatform` | Cocos 构建平台，通常是 `web-mobile` 或 `web-desktop`。 |
| `orientation` | `auto`、`portrait` 或 `landscape`。 |
| `skipBuild` | 跳过 Cocos 构建，直接适配已有构建目录。 |
| `exportChannels` | 指定导出渠道。为空或不填时导出全部渠道。 |
| `enableSplash` | 是否处理启动图。 |
| `isZip` | 是否启用 Pako 资源压缩。 |
| `compress.enable` / `compress.quality` / `compress.skipUuids` / `compress.concurrency` | 本地 sharp 图片压缩配置。图片压缩默认开启；`quality` 默认 `60`，试玩广告常用 `50-70`。 |
| `injectOptions` | 按渠道注入 `head`、`body`、`sdkScript`。 |

## 运行时 `Playable` 工具类

扩展提供 `assets/Playable.ts`，用于运行时渠道判断和常用平台调用：

```ts
import { Playable, Channels } from 'db://playable-ads-adapter/Playable';

if (Playable.isChannel(Channels.Unity)) {
  console.log('当前是 Unity 渠道');
}

console.log(Playable.channel);
console.log(Playable.lang);
console.log(Playable.sdkReady);

Playable.showAds(
  () => console.log('广告显示成功'),
  () => console.log('广告显示失败'),
);

Playable.tryGameEnd();
Playable.tryGameRetry();
Playable.tryPause();
```

如果有渠道相关代码需要避免被构建工具 tree-shaking 移除，可以保留动态渠道占位符：

```ts
window.advChannels = '{{__adv_channels_adapter__}}';
```

导出时会替换成目标渠道名，例如：

```ts
window.advChannels = 'Facebook';
```

## 开发

安装依赖：

```bash
pnpm install
```

### 构建产物

`pnpm run build` 现在默认生成当前平台对应的扩展 zip。请使用 zip 进行本机测试、同事分发和 Cocos Creator 安装。

`packages/playable-ads-adapter/dist/playable-ads-adapter` 下的原始扩展目录只是中间构建产物，打包后可能会被删除。不要直接从原始 build 文件夹安装扩展。

### 脚本

```bash
# 构建并生成当前平台对应的 zip 包
pnpm run build

# 构建 Windows x64 zip 包
pnpm run build:win

# 构建 macOS x64 zip 包
pnpm run build:mac

# 构建全部支持的 zip 包
pnpm run build:all
```

## 发布

GitHub workflow 会为匹配以下格式的 tag 发布 zip 产物：

```text
playable-ads-adapter-*
```

发布流程执行：

```bash
pnpm install --frozen-lockfile
pnpm run build
```

打包后的 zip 已包含扩展运行时代码、`adapter-runner.js`、`sharp-worker.js` 和对应平台的 sharp native 运行时。除非明确要替换依赖，否则不要在解压后的扩展目录里执行 `npm install`。

## 注意事项

- Cocos 扩展 manifest 中的 `package_version: 2` 是 Cocos 扩展 schema 版本，不是 Creator 2.x 支持。
- `.adapterrc` 文件名兼容仍保留，但推荐使用 `.adapterrc.json`。
- `settings.js` fallback 仍保留，用于兼容不同 Cocos 构建产物形态。
- 适配执行通过外部 Node 子进程中的 `adapter-runner.js` 完成；Cocos Editor 进程只负责构建状态、日志和取消控制。
- 图片压缩使用随包带的 `sharp@0.33.5`，并通过外部 Node 子进程中的 `sharp-worker.js` 执行。
