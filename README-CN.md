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

Cocos Creator 3.8.x+ 编辑器扩展。提供构建面板、构建 hooks、worker 执行隔离、`.adapterrc` 配置读写、日志转发，并调用 `playable-adapter-core` 生成试玩广告渠道包。

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
- 可选 Tinypng 图片压缩。
- 可选 Pako 资源压缩。
- 运行时 `Playable` 工具类，用于渠道判断和常用广告生命周期调用。

## 安装插件

从 releases 下载插件包：

[https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)

解压到 Cocos Creator 项目的扩展目录：

```text
<your-cocos-project>/extensions/playable-ads-adapter
```

如果扩展没有立即出现，重启 Cocos Creator 项目。

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
  "tinify": false,
  "tinifyApiKey": "",
  "tinifySkipUuids": [],
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
| `tinify` / `tinifyApiKey` / `tinifySkipUuids` | Tinypng 图片压缩配置。 |
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

### 本机 Cocos 扩展目录

`pnpm build` 和 `pnpm watch` 可以选择性地把构建后的扩展复制到本机 Cocos Creator 扩展目录。

从 `.env.example` 复制一份本地 `.env`：

```env
COCOS_EXTENSION_DEST=
```

将 `COCOS_EXTENSION_DEST` 设置为父级 `extensions` 目录：

```env
COCOS_EXTENSION_DEST=/path/to/CocosCreator/extensions
```

构建后会复制到：

```text
${COCOS_EXTENSION_DEST}/playable-ads-adapter
```

如果 `COCOS_EXTENSION_DEST` 为空或不存在，则只构建到：

```text
packages/playable-ads-adapter/dist/playable-ads-adapter
```

`.env` 已被 git 忽略。提交 `.env.example`，不要提交 `.env`。

### 脚本

```bash
# 只构建 core
pnpm run build:core

# 构建扩展。adapter 包会先构建 core。
pnpm run build

# watch 构建扩展。设置 COCOS_EXTENSION_DEST 时会同步复制。
pnpm run watch

# 构建并生成 packages/playable-ads-adapter/dist/playable-ads-adapter.zip
pnpm run package
```

## 发布

GitHub workflow 会为匹配以下格式的 tag 发布 zip 产物：

```text
playable-ads-adapter-*
```

发布流程执行：

```bash
pnpm install --frozen-lockfile
pnpm run package
```

## 注意事项

- Cocos 扩展 manifest 中的 `package_version: 2` 是 Cocos 扩展 schema 版本，不是 Creator 2.x 支持。
- `.adapterrc` 文件名兼容仍保留，但推荐使用 `.adapterrc.json`。
- `settings.js` fallback 仍保留，用于兼容不同 Cocos 构建产物形态。
