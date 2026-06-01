import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import isBuiltin from "is-builtin-module";
import { join, resolve } from "path";
import copy from "rollup-plugin-copy";
import pkgJson from "./package.json";
import cocosPluginSharp from "./plugins/cocos-plugin-sharp";
import cocosPluginWorker from "./plugins/cocos-plugin-worker";

const appName = pkgJson.name;
const appVersion = pkgJson.version;
const outputDir = `dist/${appName}`;

export default {
	input: {
		main: "src/main.ts",
		hooks: "src/hooks.ts",
		panel: "src/panels/builder/panel.ts",
		"adapter-runner": "src/extensions/adapter-runner.ts",
	},
	output: {
		dir: outputDir,
		format: "commonjs",
	},
	plugins: [
		typescript(),
		commonjs(),
		terser(),
		alias({
			entries: [
				{ find: "@", replacement: join(__dirname, "src") },
				{ find: "~types", replacement: join(__dirname, "@types") },
			],
		}),
		json(),
		nodeResolve({
			preferBuiltins: false,
			resolveOnly: (module) =>
				module === "string_decoder" || !isBuiltin(module),
			exportConditions: ["node"],
		}),
		copy({
			targets: [
				{
					src: "templates/extension-package.json",
					dest: outputDir,
					rename: "package.json",
					transform: (contents) => {
						const tempPkgJson = JSON.parse(contents.toString("utf-8"));
						tempPkgJson.version = appVersion;
						return JSON.stringify(tempPkgJson, null, 2);
					},
				},
				{ src: "i18n/**/*", dest: `${outputDir}/i18n` },
				{ src: "assets/**/*", dest: `${outputDir}/assets` },
				{
					src: "../playable-adapter-core/src/helpers/sharp-worker.js",
					dest: outputDir,
				},
			],
			verbose: true,
		}),
		cocosPluginWorker(),
		cocosPluginSharp({
			dest: `${__dirname}/${outputDir}`,
			resolveBase: resolve(__dirname, "..", "playable-adapter-core"),
			repoRoot: resolve(__dirname, "..", ".."),
		}),
	],
	external: [
		"fs",
		"path",
		"os",
		"electron",
		"child_process",
		"sharp",
		/^@img\//,
	],
};
