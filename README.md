# Cocos Playable Ads Adapter

中文说明见 [README-CN.md](./README-CN.md).

This repository contains a pnpm monorepo for exporting Cocos Creator playable ads to multiple ad network formats.

> This fork is maintained only for **Cocos Creator 3.8.x and later**. Cocos Creator 2.x support has been removed.

## Packages

```text
packages/
├── playable-adapter-core   # Core adapter engine
└── playable-ads-adapter    # Cocos Creator editor extension
```

### `playable-adapter-core`

Core build-output processor. It reads Cocos web build output, merges it into a single HTML file, inlines resources/scripts/styles, applies compression, and exports channel-specific packages.

Canonical API:

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

Cocos Creator 3.8.x+ editor extension. It provides the builder panel, build hooks, external Node process execution, `.adapterrc` reading/writing, logging, and calls `playable-adapter-core` to generate playable ad packages.

## Supported Channels

| Channel | Supported |
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

## Main Features

- Cocos Creator 3.8.x+ build panel integration.
- Automatic adaptation after Cocos build hooks.
- Manual build from the extension menu/panel.
- Optional `skipBuild` mode to adapt an existing Cocos build output.
- Single-file HTML generation.
- Channel-specific zip or directory zip exports.
- Custom exported file name and HTML title.
- Custom iOS / Android URLs with `<ios>` / `<android>` replacement in injected scripts.
- Dynamic channel placeholder replacement with `{{__adv_channels_adapter__}}`.
- Optional local sharp image compression, default quality `60`.
- Adapter execution and sharp compression run in external Node processes to avoid blocking the Cocos Editor process.
- Optional Pako resource compression.
- Runtime `Playable` utility class for channel checks and common ad lifecycle calls.

## Install the Extension

Download the packaged extension from releases:

[https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)

Choose the zip that matches your host platform. Current build scripts generate platform-specific x64 packages:

- `playable-ads-adapter-v<version>-win32-x64.zip`
- `playable-ads-adapter-v<version>-darwin-x64.zip`

Then extract it into your Cocos Creator project extension directory:

```text
<your-cocos-project>/extensions/playable-ads-adapter
```

Restart the Cocos Creator project if the extension does not appear immediately. No extra `npm install` is required.

A local Node.js runtime is required at build time because the adapter and sharp compressor run in external Node processes. Ensure `node` is available in `PATH`, or set `NODE_BINARY` to the absolute path of `node.exe` / `node`.

## Using the Extension

The extension can run in two ways:

1. **Cocos build hook**: build a `web-mobile` or `web-desktop` target from Cocos Creator; the adapter runs after build.
2. **Extension panel**: open the **多渠道构建** menu and click **开始构建**.

The panel reads and writes `.adapterrc.json` in the Cocos project root. Legacy `.adapterrc` is still read for compatibility.

## `.adapterrc.json` Example

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
    "enable": false,
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

Important fields:

| Field | Description |
| --- | --- |
| `fileName` | Custom output file name. |
| `title` | Custom HTML title. |
| `lang` | Language value exposed to runtime code. |
| `iosUrl` / `androidUrl` | Store URLs and replacement values for `<ios>` / `<android>`. |
| `buildPlatform` | Cocos build platform, usually `web-mobile` or `web-desktop`. |
| `orientation` | `auto`, `portrait`, or `landscape`. |
| `skipBuild` | Skip Cocos build and adapt an existing build folder. |
| `exportChannels` | Channels to export. Empty or omitted means all channels. |
| `enableSplash` | Whether to process the splash screen. |
| `isZip` | Whether to use Pako resource compression. |
| `compress.enable` / `compress.quality` / `compress.skipUuids` / `compress.concurrency` | Local sharp compression options. `quality` defaults to `60`; `50-70` is usually a good playable-ad range. |
| `injectOptions` | Channel-specific script injection for `head`, `body`, and `sdkScript`. |

## Runtime `Playable` Utility

The extension provides `assets/Playable.ts` for runtime channel checks and common platform calls:

```ts
import { Playable, Channels } from 'db://playable-ads-adapter/Playable';

if (Playable.isChannel(Channels.Unity)) {
  console.log('Current channel is Unity');
}

console.log(Playable.channel);
console.log(Playable.lang);
console.log(Playable.sdkReady);

Playable.showAds(
  () => console.log('Ad shown'),
  () => console.log('Ad failed'),
);

Playable.tryGameEnd();
Playable.tryGameRetry();
Playable.tryPause();
```

For channel-specific code that should survive bundling/tree-shaking, keep the dynamic channel placeholder reachable at runtime:

```ts
window.advChannels = '{{__adv_channels_adapter__}}';
```

During export it is replaced with the target channel name, for example:

```ts
window.advChannels = 'Facebook';
```

## Development

Install dependencies:

```bash
pnpm install
```

### Build Artifacts

`pnpm run build` now creates a platform-specific extension zip by default. Use the zip for local testing, sharing with teammates, and installation in Cocos Creator.

Raw extension folders under `packages/playable-ads-adapter/dist/playable-ads-adapter` are intermediate build artifacts and may be deleted after packaging. Do not install from the raw build folder.

### Scripts

```bash
# Build and create current-platform release zip
pnpm run build

# Build Windows x64 release zip
pnpm run build:win

# Build macOS x64 release zip
pnpm run build:mac

# Build all supported release zips
pnpm run build:all
```

## Release

The GitHub workflow releases zip artifacts for tags matching:

```text
playable-ads-adapter-*
```

It runs:

```bash
pnpm install --frozen-lockfile
pnpm run build
```

Packaged zips include the extension runtime, `adapter-runner.js`, `sharp-worker.js`, and the platform-specific sharp native runtime. Do not run `npm install` inside an extracted extension unless you intentionally want to replace bundled dependencies.

## Notes

- `package_version: 2` in the Cocos extension manifest is the Cocos extension schema version, not Creator 2.x support.
- `.adapterrc` compatibility is retained for existing projects, but `.adapterrc.json` is the preferred config file.
- `settings.js` fallback is retained for Cocos build-output compatibility.
- Adapter execution uses `adapter-runner.js` in an external Node process; the Cocos Editor process only orchestrates build state, logging, and cancellation.
- Image compression uses bundled `sharp@0.33.5` and runs through `sharp-worker.js` in an external Node process.
