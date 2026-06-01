const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { installSharpRuntime } = require("./sharp-runtime");

const PLUGIN_NAME = "playable-ads-adapter";
const REPO_ROOT = path.resolve(__dirname, "..");
const PLUGIN_PACKAGE_ROOT = path.join(REPO_ROOT, "packages", PLUGIN_NAME);
const PLUGIN_DIST = path.join(PLUGIN_PACKAGE_ROOT, "dist");
const PLUGIN_BUILD_DIR = path.join(PLUGIN_DIST, PLUGIN_NAME);
const PLUGIN_VERSION = require(
	path.join(PLUGIN_PACKAGE_ROOT, "package.json"),
).version;
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const SUPPORTED_PLATFORMS = new Set(["win32", "darwin"]);
const SUPPORTED_ARCHES = new Set(["x64"]);
const DEFAULT_ARCH = "x64";

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const child = spawn(command, args, {
			cwd: REPO_ROOT,
			stdio: "inherit",
			shell: process.platform === "win32",
			windowsHide: true,
			...options,
		});

		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill();
			reject(
				new Error(
					`命令执行超时：${command} ${args.join(" ")}，已等待 ${BUILD_TIMEOUT_MS / 1000} 秒`,
				),
			);
		}, BUILD_TIMEOUT_MS);

		const finish = (cb, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			cb(value);
		};

		child.on("error", (error) => finish(reject, error));
		child.on("close", (code) => {
			if (code === 0) {
				finish(resolve);
				return;
			}

			finish(
				reject,
				new Error(`命令执行失败：${command} ${args.join(" ")}，退出码 ${code}`),
			);
		});
	});
}

function addDirectoryToZip(zip, sourceDir, baseDir) {
	for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
		const fullPath = path.join(sourceDir, entry.name);
		const zipEntryName = path.relative(baseDir, fullPath).replace(/\\/g, "/");

		if (entry.isDirectory()) {
			zip.folder(zipEntryName);
			addDirectoryToZip(zip, fullPath, baseDir);
			continue;
		}

		if (entry.isFile()) {
			zip.file(zipEntryName, fs.readFileSync(fullPath));
		}
	}
}

function parseCliArgs() {
	const parsed = {
		platform: process.platform,
		arch: DEFAULT_ARCH,
	};

	const args = process.argv.slice(2);
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--platform") {
			parsed.platform = args[index + 1];
			index += 1;
			continue;
		}
		if (arg === "--arch") {
			parsed.arch = args[index + 1];
			index += 1;
			continue;
		}
		if (arg.startsWith("--platform=")) {
			parsed.platform = arg.split("=")[1];
			continue;
		}
		if (arg.startsWith("--arch=")) {
			parsed.arch = arg.split("=")[1];
		}
	}

	if (!SUPPORTED_PLATFORMS.has(parsed.platform)) {
		throw new Error(`不支持的平台: ${parsed.platform}，可选: win32/darwin`);
	}

	if (!SUPPORTED_ARCHES.has(parsed.arch)) {
		throw new Error(`不支持的架构: ${parsed.arch}，当前仅支持 x64`);
	}

	return parsed;
}

async function installSharpForTarget(platform, arch) {
	await installSharpRuntime(PLUGIN_BUILD_DIR, {
		platform,
		arch,
		cacheRoot: path.join(REPO_ROOT, ".sharp-tmp"),
		resolveBase: path.join(REPO_ROOT, "packages", "playable-adapter-core"),
		repoRoot: REPO_ROOT,
	});
}

async function createZip(zipPath) {
	const JSZip = require(
		require.resolve("jszip", { paths: [PLUGIN_PACKAGE_ROOT] }),
	);
	const zip = new JSZip();

	console.log(`添加待打包文件：${PLUGIN_BUILD_DIR}`);
	addDirectoryToZip(zip, PLUGIN_BUILD_DIR, path.dirname(PLUGIN_BUILD_DIR));

	const content = await zip.generateAsync({
		type: "nodebuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 9 },
	});

	fs.writeFileSync(zipPath, content);
}

async function main() {
	const { platform, arch } = parseCliArgs();
	const zipPath = path.join(
		PLUGIN_DIST,
		`${PLUGIN_NAME}-v${PLUGIN_VERSION}-${platform}-${arch}.zip`,
	);
	console.log("开始打包插件...");
	console.log(`目标平台: ${platform}-${arch}`);
	console.log(`插件版本: v${PLUGIN_VERSION}`);

	await run("pnpm", ["-F", "playable-ads-adapter", "build:raw"]);

	if (!fs.existsSync(PLUGIN_BUILD_DIR)) {
		throw new Error(`未找到构建产物：${PLUGIN_BUILD_DIR}`);
	}

	await installSharpForTarget(platform, arch);

	fs.rmSync(zipPath, { force: true });
	await createZip(zipPath);

	console.log(`插件包文件：${zipPath}`);
	console.log("插件打包完成");
	fs.rmSync(PLUGIN_BUILD_DIR, { recursive: true, force: true });

	console.log("临时构建目录已删除");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
