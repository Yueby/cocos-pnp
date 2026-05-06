import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { existsSync, readFileSync } from 'fs';
import isBuiltin from 'is-builtin-module';
import { join, resolve } from 'path';
import copy from 'rollup-plugin-copy';
import pkgJson from './package.json';
import cocosPluginUpdater from './plugins/cocos-plugin-updater';
import cocosPluginWorker from './plugins/cocos-plugin-worker';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf-8');

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(__dirname, '../../.env'));
loadEnvFile(resolve(__dirname, '.env'));

const appName = pkgJson.name;
const appVersion = pkgJson.version;
const outputDir = `dist/${appName}`;
const cocosExtensionDest = process.env.COCOS_EXTENSION_DEST;
const cocosPluginDest = cocosExtensionDest ? `${cocosExtensionDest}/${appName}` : undefined;

export default {
  input: {
    main: 'src/main.ts',
    hooks: 'src/hooks.ts',
    panel: 'src/panels/builder/panel.ts'
  },
  output: {
    dir: outputDir,
    format: 'commonjs'
  },
  plugins: [
    typescript(),
    commonjs(),
    terser(),
    alias({
      entries: [
        { find: '@', replacement: join(__dirname, 'src') },
        { find: '~types', replacement: join(__dirname, '@types') }
      ]
    }),
    json(),
    nodeResolve({
      preferBuiltins: false,
      resolveOnly: (module) => module === 'string_decoder' || !isBuiltin(module),
      exportConditions: ['node'],
    }),
    copy({
      targets: [
        {
          src: 'templates/extension-package.json',
          dest: outputDir,
          rename: 'package.json',
          transform: (contents) => {
            const tempPkgJson = JSON.parse(contents.toString('utf-8'));
            tempPkgJson.version = appVersion;
            return JSON.stringify(tempPkgJson, null, 2);
          }
        },
        { src: 'i18n/**/*', dest: `${outputDir}/i18n` },
        { src: 'assets/**/*', dest: `${outputDir}/assets` }
      ],
      verbose: true
    }),
    cocosPluginWorker(),
    ...(cocosPluginDest
      ? [cocosPluginUpdater({
          src: `${__dirname}/${outputDir}`,
          dest: cocosPluginDest
        })]
      : []),
  ],
  external: ['fs', 'path', 'os', 'electron', 'child_process']
};
