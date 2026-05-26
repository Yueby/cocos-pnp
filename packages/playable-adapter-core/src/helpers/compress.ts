import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
import {
	checkImgType,
	getAllFilesFormDir,
	getOriginPkgPath,
	getRCCompress,
} from "@/utils";

let sharp: any;
let sharpLoadError: string | null = null;

type TProcessWithDllDirectory = NodeJS.Process & {
	addDllDirectory?: (path: string) => void;
};

function resolveExtensionRoot(): string {
	let dir = __dirname;
	for (let depth = 0; depth < 6; depth++) {
		const pkgPath = path.join(dir, "package.json");
		if (fs.existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
				if (pkg?.name === "playable-ads-adapter") {
					return dir;
				}
			} catch {
				// ignore invalid package.json
			}
		}
		dir = path.dirname(dir);
	}
	return __dirname;
}

function loadSharp() {
	if (sharp !== undefined) {
		return sharp;
	}

	try {
		const extensionRoot = resolveExtensionRoot();
		const req = createRequire(path.join(extensionRoot, "package.json"));

		// 核心修复：Windows 上 Electron 加载原生模块时，无法寻址到同目录下的 DLL (如 libvips-42.dll)
		// 这会导致 dlopen 抛出 ERR_DLOPEN_FAILED: The specified procedure could not be found.
		// 我们动态将 sharp 原生库二进制目录加入 process.env.PATH 以及通过 process.addDllDirectory 注册
		if (process.platform === "win32") {
			const nodeModulesDir = path.join(extensionRoot, "node_modules");
			const arch = process.arch;
			const sharpLibDir = path.join(
				nodeModulesDir,
				"@img",
				`sharp-win32-${arch}`,
				"lib",
			);
			if (fs.existsSync(sharpLibDir)) {
				process.env.PATH = `${sharpLibDir};${process.env.PATH}`;
				// 针对 Node.js 12+ / Electron 安全 DLL 寻址池策略
				const processWithDllDirectory = process as TProcessWithDllDirectory;
				if (typeof processWithDllDirectory.addDllDirectory === "function") {
					try {
						processWithDllDirectory.addDllDirectory(sharpLibDir);
					} catch (e) {
						// ignore errors
					}
				}
			}
		}

		sharp = req("sharp");
		sharpLoadError = null;
	} catch (error) {
		sharp = null;
		sharpLoadError = error instanceof Error ? error.message : String(error);
	}

	return sharp;
}

type TCompressResult = "compressed" | "kept" | "skipped";

type TCompressSummary = {
	compressed: number;
	kept: number;
	skipped: number;
	failed: { filePath: string; message: string }[];
};

const parseNodeVersion = (nodePath: string): number[] => {
	const match = nodePath.match(/[\\/]v?(\d+)\.(\d+)\.(\d+)[\\/]/i);
	return match
		? [Number(match[1]), Number(match[2]), Number(match[3])]
		: [0, 0, 0];
};

const compareNodePathVersion = (a: string, b: string): number => {
	const av = parseNodeVersion(a);
	const bv = parseNodeVersion(b);
	for (let i = 0; i < 3; i += 1) {
		if (av[i] !== bv[i]) return bv[i] - av[i];
	}
	return 0;
};

const findNvmNodeCandidates = (nodeFileName: string): string[] => {
	if (process.platform !== "win32") return [];

	const roots = [
		process.env.NVM_HOME,
		process.env.LOCALAPPDATA
			? path.join(process.env.LOCALAPPDATA, "nvm")
			: undefined,
		path.join(os.homedir(), "AppData", "Local", "nvm"),
	].filter(Boolean) as string[];

	const candidates: string[] = [];
	for (const root of roots) {
		if (!fs.existsSync(root)) continue;
		for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory() || !/^v?\d+\.\d+\.\d+$/.test(entry.name))
				continue;
			candidates.push(path.join(root, entry.name, nodeFileName));
		}
	}

	return candidates.sort(compareNodePathVersion);
};

const findNodeBinary = (): string | null => {
	const nodeFileName = process.platform === "win32" ? "node.exe" : "node";
	const pathCandidates =
		process.env.PATH?.split(path.delimiter).map((dir) =>
			path.join(dir, nodeFileName),
		) ?? [];
	const nvmCandidates = [process.env.NVM_SYMLINK, process.env.NVM_HOME]
		.filter(Boolean)
		.map((dir) => path.join(dir as string, nodeFileName));
	const explicitCandidates = [
		process.env.NODE_BINARY,
		...nvmCandidates,
		...findNvmNodeCandidates(nodeFileName),
		process.platform === "win32"
			? "C:\\Program Files\\nodejs\\node.exe"
			: "/usr/local/bin/node",
		process.platform === "win32"
			? "C:\\Program Files (x86)\\nodejs\\node.exe"
			: "/usr/bin/node",
	];
	const candidates = [...explicitCandidates, ...pathCandidates].filter(
		Boolean,
	) as string[];

	return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const runSharpWorker = async (
	files: string[],
	quality: number,
): Promise<TCompressSummary | null> => {
	const extensionRoot = resolveExtensionRoot();
	const workerPath = path.join(extensionRoot, "sharp-worker.js");
	const nodeBinary = findNodeBinary();

	if (!nodeBinary) {
		throw new Error(
			"未找到外部 node.exe，请确认 Node.js 已加入系统 PATH，或设置 NODE_BINARY 指向 node.exe",
		);
	}

	if (!fs.existsSync(workerPath)) {
		throw new Error(`未找到 sharp 子进程脚本：${workerPath}`);
	}

	console.log(`[压缩] 使用外部 Node 子进程执行 sharp: ${nodeBinary}`);

	const payloadPath = path.join(
		os.tmpdir(),
		`playable-sharp-${process.pid}-${Date.now()}.json`,
	);

	await fs.promises.writeFile(
		payloadPath,
		JSON.stringify({ extensionRoot, files, quality }),
		"utf-8",
	);

	return new Promise<TCompressSummary>((resolve, reject) => {
		const child = spawn(nodeBinary, [workerPath, payloadPath], {
			cwd: extensionRoot,
			windowsHide: true,
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			fs.rmSync(payloadPath, { force: true });
			if (code !== 0) {
				reject(new Error(stderr || `sharp 子进程退出码 ${code}`));
				return;
			}

			try {
				resolve(JSON.parse(stdout) as TCompressSummary);
			} catch (error) {
				reject(error);
			}
		});
	});
};

const runWithConcurrency = async <T>(
	tasks: (() => Promise<T>)[],
	concurrency: number,
): Promise<PromiseSettledResult<T>[]> => {
	const results: PromiseSettledResult<T>[] = new Array(tasks.length);
	let index = 0;

	const worker = async () => {
		while (index < tasks.length) {
			const i = index++;
			try {
				results[i] = { status: "fulfilled", value: await tasks[i]() };
			} catch (err) {
				results[i] = { status: "rejected", reason: err };
			}
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
	);
	return results;
};

const isUuidSkipped = (filePath: string, skipUuids: string[]): boolean => {
	if (skipUuids.length === 0) return false;
	const baseName = path.basename(filePath, path.extname(filePath));
	return skipUuids.includes(baseName);
};

const compressFile = async (
	filePath: string,
	quality: number,
): Promise<TCompressResult> => {
	const sharpInstance = loadSharp();
	if (!sharpInstance) {
		throw new Error(sharpLoadError || "sharp 未加载");
	}

	const ext = path.extname(filePath).toLowerCase();
	if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
		return "skipped";
	}

	const input = await fs.promises.readFile(filePath);
	let output: Buffer;

	if (ext === ".png") {
		output = await sharpInstance(input, { failOn: "none" })
			.png({
				palette: true,
				quality,
				compressionLevel: 9,
				effort: 7,
			})
			.toBuffer();
	} else if (ext === ".webp") {
		output = await sharpInstance(input, { failOn: "none" })
			.webp({
				quality,
				effort: 4,
			})
			.toBuffer();
	} else {
		output = await sharpInstance(input, { failOn: "none" })
			.jpeg({
				quality,
				mozjpeg: true,
			})
			.toBuffer();
	}

	if (output.length < input.length) {
		await fs.promises.writeFile(filePath, output);
		return "compressed";
	}

	return "kept";
};

export const execCompress = async (): Promise<{
	success: boolean;
	msg: string;
}> => {
	const { enable, quality, skipUuids, concurrency } = getRCCompress();

	if (!enable) {
		return { success: false, msg: "未开启图片压缩" };
	}

	const originPkgPath = getOriginPkgPath();
	const allImgFiles = getAllFilesFormDir(originPkgPath).filter(checkImgType);

	console.log(`[压缩] 扫描目录: ${originPkgPath}`);
	console.log(`[压缩] 发现 ${allImgFiles.length} 个图片文件`);

	const skippedFiles = allImgFiles.filter((filePath) =>
		isUuidSkipped(filePath, skipUuids),
	);
	const files = allImgFiles.filter(
		(filePath) => !isUuidSkipped(filePath, skipUuids),
	);

	if (skippedFiles.length > 0) {
		console.log(`[压缩] 跳过 ${skippedFiles.length} 个 UUID 匹配的图片`);
	}

	if (files.length === 0) {
		return { success: true, msg: "未发现需要压缩的图片" };
	}

	try {
		const workerResult = await runSharpWorker(files, quality);
		if (workerResult) {
			console.log(
				`[压缩] sharp 子进程完成：体积变小 ${workerResult.compressed} 个，保持原样 ${workerResult.kept} 个，跳过 ${workerResult.skipped} 个，失败 ${workerResult.failed.length} 个`,
			);

			if (workerResult.failed.length > 0) {
				workerResult.failed.forEach(({ filePath, message }) => {
					console.error(`[压缩] ${filePath}: ${message}`);
				});
				return {
					success: false,
					msg: `图片压缩部分失败：${files.length - workerResult.failed.length}/${files.length} 成功，${workerResult.failed.length} 失败`,
				};
			}

			return {
				success: true,
				msg: `压缩完成：体积变小 ${workerResult.compressed} 个，保持原样 ${workerResult.kept} 个，跳过不支持格式 ${workerResult.skipped} 个`,
			};
		}
	} catch (error) {
		console.warn(
			`[压缩] sharp 子进程不可用，回退到当前进程加载：${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	if (!loadSharp()) {
		const detail = sharpLoadError ? `：${sharpLoadError}` : "";
		return {
			success: false,
			msg: `未找到 sharp 原生模块${detail}。请重新下载对应平台插件 zip，或确认扩展目录 node_modules 完整`,
		};
	}

	const maxConcurrency = Math.max(1, Number(concurrency) || os.cpus().length);
	console.log(
		`[压缩] 共发现 ${files.length} 个图片文件，并发数: ${maxConcurrency}`,
	);

	const tasks = files.map((filePath) => async () => {
		const status = await compressFile(filePath, quality);
		return { filePath, status };
	});

	const results = await runWithConcurrency(tasks, maxConcurrency);

	const failed = results
		.map((result, index) => ({ result, filePath: files[index] }))
		.filter(
			(item): item is { result: PromiseRejectedResult; filePath: string } =>
				item.result.status === "rejected",
		);

	const fulfilled = results
		.filter(
			(
				result,
			): result is PromiseFulfilledResult<{
				filePath: string;
				status: TCompressResult;
			}> => result.status === "fulfilled",
		)
		.map((result) => result.value);

	const compressedCount = fulfilled.filter(
		(item) => item.status === "compressed",
	).length;
	const keptCount = fulfilled.filter((item) => item.status === "kept").length;
	const unsupportedCount = fulfilled.filter(
		(item) => item.status === "skipped",
	).length;

	if (failed.length > 0) {
		failed.forEach(({ filePath, result }) => {
			const message =
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason);
			console.error(`[压缩] ${filePath}: ${message}`);
		});

		return {
			success: false,
			msg: `图片压缩部分失败：${fulfilled.length}/${files.length} 成功，${failed.length} 失败`,
		};
	}

	return {
		success: true,
		msg: `压缩完成：体积变小 ${compressedCount} 个，保持原样 ${keptCount} 个，跳过不支持格式 ${unsupportedCount} 个`,
	};
};
