import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'fs';
import isBuiltin from 'is-builtin-module';
import dts from 'rollup-plugin-dts';
import { minify } from 'uglify-js';

const getJSCode = (jsPath) => {
  return JSON.stringify(minify(readFileSync(__dirname + jsPath).toString('utf-8')).code)
}

export default [
  {
    input: 'src/index.ts',
    output: {
      file: `dist/playable-adapter-core.js`,
      format: 'commonjs',
    },
    plugins: [
      typescript(),
      json(),
      commonjs(),
      nodeResolve({
        preferBuiltins: false,
        resolveOnly: (module) => module === 'string_decoder' || !isBuiltin(module),
        exportConditions: ['node']
      }),
      terser(),
      alias({
        entries: [
          { find: '@', replacement: __dirname + '/src' }
        ]
      }),
      replace({
        preventAssignment: true,
        values: {
          __adapter_init_2x_code__: () => getJSCode('/injects/2x/init.js'),
          __adapter_main_2x_code__: () => getJSCode('/injects/2x/main.js'),
          __adapter_init_3x_code__: () => getJSCode('/injects/3x/init.js'),
          __adapter_main_3x_code__: () => getJSCode('/injects/3x/main.js'),
          __adapter_jszip_code__: () => getJSCode('/injects/libs/pako.js'),
        }
      }),
    ],
    external: ['fs', 'path']
  },
  {
    input: `src/index.ts`,
    output: {
      file: `dist/playable-adapter-core.d.ts`
    },
    plugins: [
      alias({
        entries: [
          { find: '@', replacement: __dirname + '/src' }
        ]
      }),
      dts()
    ],
  }
]
