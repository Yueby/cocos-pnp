import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { installSharpRuntime } = require('../../../scripts/sharp-runtime.js');

/**
 * 构建完成后为扩展目录安装完整 sharp 运行时（sharp + detect-libc + semver + @img/* 等）。
 */
export default function cocosPluginSharp(options = {}) {
  const { dest } = options;
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..', '..');
  const resolveBase = options.resolveBase || path.resolve(__dirname, '..', 'playable-adapter-core');

  return {
    name: 'cocos-plugin-sharp',
    async writeBundle() {
      if (!dest) {
        return;
      }

      try {
        const result = await installSharpRuntime(dest, {
          resolveBase,
          repoRoot,
          cacheRoot: path.join(repoRoot, '.sharp-tmp'),
        });
        console.log(`[sharp] 已注入完整 sharp 运行时 (${result.mode})：${result.packages.join(', ')}`);
      } catch (error) {
        console.warn('[sharp] 注入 sharp 运行时失败，图片压缩将不可用:', error instanceof Error ? error.message : error);
      }
    },
  };
}
