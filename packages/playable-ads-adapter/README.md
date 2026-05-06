# playable-ads-adapter

Cocos Creator 3.8.x+ 编辑器扩展，用于把 Cocos Web 构建产物导出为多广告渠道 playable ads 包。

> 当前包仅维护 Cocos Creator 3.8.x 及以上版本。Cocos Creator 2.x 支持已移除。

## 功能

- 构建发布面板集成。
- Cocos 构建 hooks 后自动适配。
- 扩展面板手动构建。
- `skipBuild` 模式：跳过 Cocos 构建，直接适配已有构建目录。
- 调用 `playable-adapter-core` 生成单文件 HTML 和各渠道包。
- `.adapterrc.json` 配置读写，兼容旧 `.adapterrc` 文件名。
- worker 执行隔离和日志转发。
- 运行时 `Playable` 工具类。

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

## 安装

从 release 下载 `playable-ads-adapter.zip`，解压到 Cocos Creator 项目的扩展目录：

```text
<your-cocos-project>/extensions/playable-ads-adapter
```

如果扩展没有立即出现，重启 Cocos Creator 项目。

## 配置文件

推荐在 Cocos 项目根目录使用 `.adapterrc.json`：

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

## 本地开发

安装依赖：

```bash
pnpm install
```

如果希望 `pnpm build` / `pnpm watch` 后自动复制扩展到本机 Cocos Creator 扩展目录，从仓库根目录的 `.env.example` 复制一份 `.env`：

```env
COCOS_EXTENSION_DEST=/path/to/CocosCreator/extensions
```

`COCOS_EXTENSION_DEST` 应指向父级 `extensions` 目录。构建后会复制到：

```text
${COCOS_EXTENSION_DEST}/playable-ads-adapter
```

如果该变量为空或不存在，则只构建到：

```text
packages/playable-ads-adapter/dist/playable-ads-adapter
```

`.env` 已被 git 忽略，不要提交本机路径。

## 脚本

```bash
# 在仓库根目录执行
pnpm run build
pnpm run watch
pnpm run package
```

也可以只构建当前包：

```bash
pnpm -F playable-ads-adapter build
```

`playable-ads-adapter` 的 build 会先构建 `playable-adapter-core`，避免打包旧 core 产物。

## 注意事项

- Cocos 扩展 manifest 中的 `package_version: 2` 是扩展 schema 版本，不是 Creator 2.x 支持。
- `.adapterrc` 文件名兼容仍保留，但推荐使用 `.adapterrc.json`。
- 本包的运行时辅助脚本位于 `assets/Playable.ts`。
