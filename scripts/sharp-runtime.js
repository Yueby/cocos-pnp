const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createRequire } = require("module");

const SHARP_VERSION = "^0.33.5";
const requireFromRepo = createRequire(
	path.join(__dirname, "..", "package.json"),
);

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
			windowsHide: true,
			...options,
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(`命令执行失败：${command} ${args.join(" ")}，退出码 ${code}`),
			);
		});
	});
}

function resolvePackageDir(pkgName, fromDir) {
	try {
		const pkgJsonPath = requireFromRepo.resolve(`${pkgName}/package.json`, {
			paths: [fromDir],
		});
		return fs.realpathSync(path.dirname(pkgJsonPath));
	} catch {
		return null;
	}
}

function findNativeBinaryDir(repoRoot, platform, arch) {
	const nativePkg = `@img/sharp-${platform}-${arch}`;
	const viaResolve = resolvePackageDir(nativePkg, repoRoot);
	if (viaResolve && fs.existsSync(viaResolve)) {
		return { pkgName: nativePkg, dir: viaResolve };
	}

	const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
	if (!fs.existsSync(pnpmDir)) {
		return null;
	}

	const prefix = `@img+sharp-${platform}-${arch}@`;
	const matched = fs
		.readdirSync(pnpmDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
		.map((entry) =>
			path.join(
				pnpmDir,
				entry.name,
				"node_modules",
				"@img",
				`sharp-${platform}-${arch}`,
			),
		)
		.find((candidate) => fs.existsSync(candidate));

	return matched ? { pkgName: nativePkg, dir: fs.realpathSync(matched) } : null;
}

function collectPackageTree(pkgName, resolveBase, collected = new Map()) {
	if (collected.has(pkgName)) {
		return collected;
	}

	const dir = resolvePackageDir(pkgName, resolveBase);
	if (!dir) {
		return collected;
	}

	collected.set(pkgName, dir);

	let pkgJson;
	try {
		pkgJson = JSON.parse(
			fs.readFileSync(path.join(dir, "package.json"), "utf-8"),
		);
	} catch {
		return collected;
	}

	for (const depName of Object.keys(pkgJson.dependencies || {})) {
		collectPackageTree(depName, resolveBase, collected);
	}

	return collected;
}

function getTargetPackagePath(targetNodeModules, pkgName) {
	if (pkgName.startsWith("@")) {
		const [scope, name] = pkgName.split("/");
		return path.join(targetNodeModules, scope, name);
	}
	return path.join(targetNodeModules, pkgName);
}

function mergeNodeModules(sourceDir, targetDir) {
	if (!fs.existsSync(sourceDir)) {
		throw new Error(`未找到 node_modules: ${sourceDir}`);
	}

	fs.mkdirSync(targetDir, { recursive: true });

	for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
		const srcPath = path.join(sourceDir, entry.name);
		const destPath = path.join(targetDir, entry.name);
		fs.rmSync(destPath, { recursive: true, force: true });
		fs.cpSync(srcPath, destPath, { recursive: true, dereference: true });
	}
}

function copySharpFromMonorepo(targetExtensionDir, options = {}) {
	const resolveBase =
		options.resolveBase ||
		path.join(__dirname, "..", "packages", "playable-adapter-core");
	const repoRoot = options.repoRoot || path.join(__dirname, "..");
	const platform = options.platform || process.platform;
	const arch = options.arch || process.arch;
	const targetNodeModules = path.join(targetExtensionDir, "node_modules");

	const packages = collectPackageTree("sharp", resolveBase);
	const native = findNativeBinaryDir(repoRoot, platform, arch);
	if (native) {
		packages.set(native.pkgName, native.dir);
	}

	if (!packages.has("sharp")) {
		throw new Error("未在 monorepo 中找到 sharp，请先执行 pnpm install");
	}

	fs.mkdirSync(targetNodeModules, { recursive: true });

	for (const [pkgName, sourceDir] of packages.entries()) {
		const destPath = getTargetPackagePath(targetNodeModules, pkgName);
		fs.rmSync(destPath, { recursive: true, force: true });
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.cpSync(sourceDir, destPath, { recursive: true, dereference: true });
	}

	return Array.from(packages.keys());
}

async function installSharpRuntime(targetExtensionDir, options = {}) {
	const { platform, arch, cacheRoot } = options;

	// 核心修复：Cocos Creator 插件原生库必须针对 Electron 的 ABI 编译下载。
	// 本地 monorepo 中的 sharp 是为普通 Node.js 宿主环境下载的，不能直接拷贝给 Electron 载入。
	// 因此我们强制让其使用 npm 进行专门的 Electron target 模块独立下载与环境隔离。

	const tempRoot = path.join(
		cacheRoot || path.join(targetExtensionDir, "..", ".sharp-tmp"),
		`${platform}-${arch}`,
	);
	const tempNodeModulesPath = path.join(tempRoot, "node_modules");
	const targetNodeModulesPath = path.join(targetExtensionDir, "node_modules");

	fs.rmSync(tempRoot, { recursive: true, force: true });
	fs.mkdirSync(tempRoot, { recursive: true });
	fs.writeFileSync(
		path.join(tempRoot, "package.json"),
		JSON.stringify({ name: "sharp-runtime-tmp", version: "0.0.0" }, null, 2),
		"utf-8",
	);

	const installArgs = [
		"install",
		"--prefix",
		tempRoot,
		"--no-save",
		"--omit=dev",
		`--cpu=${arch}`,
		`--os=${platform}`,
	];
	if (platform === "linux") {
		installArgs.push("--libc=glibc");
	}
	installArgs.push(`sharp@${SHARP_VERSION}`);

	try {
		// 通过环境变量传递给 npm_config，这在 npm v10+ 中是唯一 100% 正确且不报警告的原生编译指定方法
		const customEnv = {
			...process.env,
			npm_config_target: "25.0.0",
			npm_config_runtime: "electron",
			npm_config_disturl: "https://electronjs.org/headers",
		};
		await run("npm", installArgs, { env: customEnv });
		mergeNodeModules(tempNodeModulesPath, targetNodeModulesPath);
		return { mode: "npm", packages: fs.readdirSync(tempNodeModulesPath) };
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

module.exports = {
	SHARP_VERSION,
	mergeNodeModules,
	copySharpFromMonorepo,
	installSharpRuntime,
};
