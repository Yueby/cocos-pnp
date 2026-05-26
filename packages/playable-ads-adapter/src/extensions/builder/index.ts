import { BUILDER_NAME, SKIP_ADAPTER_HOOK_ENV } from "@/extensions/constants";
import {
	logger,
	parseAdapterLogLevel,
	type TLogPayload,
} from "@/extensions/logger";
import { getAdapterConfig, getRCSkipBuild } from "@/extensions/utils";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { shell } from "electron";
import {
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { delimiter, join } from "path";
import type { IBuildTaskOption } from "~types/packages/builder/@types";

type TBuildParams = {
	buildFolderPath: string;
	adapterBuildConfig: TAdapterRC;
};

type TBuildProfileTask = {
	options?: Partial<IBuildTaskOption>;
};

type TBuildProfile = {
	common?: Partial<IBuildTaskOption>;
	BuildTaskManager?: {
		taskMap?: Record<string, TBuildProfileTask>;
	};
};

type TBuildTaskOptions = Partial<IBuildTaskOption> & {
	id: string;
	taskId: string;
	platform: TPlatform;
	outputName: string;
	taskName: string;
	buildPath: string;
	packages: Record<string, unknown>;
};

type TAdapterRunnerMessage = {
	event: string;
	finished?: boolean;
	msg?: unknown;
};

type TExportSuccessCallback = () => void;
type TExportFailCallback = (error: unknown) => void;

type TNodeBinary = {
	command: string;
	env: NodeJS.ProcessEnv;
};

type TSerializedError = {
	message?: unknown;
	stack?: unknown;
};

type TBuildStatePayload = {
	building: boolean;
	taskId?: string;
	error?: string;
};

type TBuildStateListener = (state: {
	building: boolean;
	taskId?: string;
	error?: Error;
}) => void;

type TBuildState = {
	building: boolean;
	taskId?: string;
	listeners: Set<TBuildStateListener>;
	subscribe: (callback: TBuildStateListener) => () => void;
	notify: (building: boolean, error?: Error, taskId?: string) => boolean;
};

let activeTaskId: string | null = null;
let runningTempTaskId: string | null = null;
let activeAdapterChild: ChildProcessWithoutNullStreams | null = null;
let adapterCancelError: Error | null = null;

const ADAPTER_RUNNER_FILE = "adapter-runner.js";
const ADAPTER_RUNNER_TIMEOUT_MS = 60 * 60 * 1000;
const ADAPTER_RUNNER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const BUILD_TASK_TIMEOUT_MS = 30 * 60 * 1000;
const BUILD_TASK_POLL_INTERVAL_MS = 3000;

const serializeError = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	return error ? String(error) : undefined;
};

const isSerializedError = (value: unknown): value is TSerializedError =>
	typeof value === "object" && value !== null && "message" in value;

const deserializeError = (value: unknown) => {
	if (value instanceof Error) {
		return value;
	}
	if (isSerializedError(value)) {
		const error = new Error(
			typeof value.message === "string" ? value.message : "适配失败",
		);
		if (typeof value.stack === "string") {
			error.stack = value.stack;
		}
		return error;
	}
	return new Error(value ? String(value) : "适配失败");
};

const normalizeError = (error?: unknown) =>
	error instanceof Error ? error : error ? new Error(String(error)) : undefined;

const safeBroadcast = (message: string, payload?: unknown) => {
	try {
		Editor?.Message?.broadcast?.(message, payload);
	} catch (error) {
		logger.debug("跳过 Editor.Message.broadcast:", message, error);
	}
};

const notifyBuildState = (
	building: boolean,
	error?: unknown,
	taskId = activeTaskId || undefined,
) => {
	const normalizedError = normalizeError(error);
	const changed = buildState.notify(building, normalizedError, taskId);
	if (!changed && !normalizedError) {
		return;
	}
	const payload: TBuildStatePayload = {
		building,
		taskId,
		error: serializeError(normalizedError),
	};
	safeBroadcast("adapter:build-state", payload);
};

export const cancelBuild = async () => {
	if (runningTempTaskId) {
		try {
			logger.warn(`正在停止临时 Cocos 构建任务: ${runningTempTaskId}`);
			await Editor.Message.request("builder", "break-task", runningTempTaskId);
			return true;
		} catch (error) {
			logger.error("停止临时 Cocos 构建任务失败:", error);
			return false;
		}
	}

	if (activeAdapterChild) {
		adapterCancelError = new Error("用户已取消适配导出");
		logger.warn("正在终止适配子进程...");
		activeAdapterChild.kill();
		return true;
	}

	logger.warn("当前没有可停止的构建或适配任务");
	return false;
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
			? join(process.env.LOCALAPPDATA, "nvm")
			: undefined,
		join(process.env.USERPROFILE || "", "AppData", "Local", "nvm"),
	].filter((root): root is string => Boolean(root));

	const candidates: string[] = [];
	for (const root of roots) {
		if (!existsSync(root)) continue;
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory() || !/^v?\d+\.\d+\.\d+$/.test(entry.name)) {
				continue;
			}
			candidates.push(join(root, entry.name, nodeFileName));
		}
	}

	return candidates.sort(compareNodePathVersion);
};

const findNodeBinary = (): TNodeBinary | null => {
	const nodeFileName = process.platform === "win32" ? "node.exe" : "node";
	const pathCandidates =
		process.env.PATH?.split(delimiter).map((dir) => join(dir, nodeFileName)) ??
		[];
	const explicitCandidates = [
		process.env.NODE_BINARY,
		process.env.NVM_SYMLINK
			? join(process.env.NVM_SYMLINK, nodeFileName)
			: undefined,
		process.env.NVM_HOME ? join(process.env.NVM_HOME, nodeFileName) : undefined,
		...findNvmNodeCandidates(nodeFileName),
		process.platform === "win32"
			? "C:\\Program Files\\nodejs\\node.exe"
			: "/usr/local/bin/node",
		process.platform === "win32"
			? "C:\\Program Files (x86)\\nodejs\\node.exe"
			: "/usr/bin/node",
	];
	const command = [...explicitCandidates, ...pathCandidates]
		.filter((candidate): candidate is string => Boolean(candidate))
		.find((candidate) => existsSync(candidate));

	if (command) {
		return {
			command,
			env: { ...process.env },
		};
	}

	if (process.versions?.electron && process.execPath) {
		return {
			command: process.execPath,
			env: {
				...process.env,
				ELECTRON_RUN_AS_NODE: "1",
			},
		};
	}

	return null;
};

const getAdapterRunnerPath = () => join(__dirname, ADAPTER_RUNNER_FILE);

const isAdapterRunnerMessage = (
	value: unknown,
): value is TAdapterRunnerMessage => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return typeof record.event === "string";
};

const handleAdapterRunnerMessage = (
	message: TAdapterRunnerMessage,
	finishSuccess: TExportSuccessCallback,
	finishFail: TExportFailCallback,
) => {
	if (message.event === "adapter:finished") {
		message.finished
			? finishSuccess()
			: finishFail(deserializeError(message.msg));
		return;
	}

	const level = parseAdapterLogLevel(message.event);
	if (!level) {
		logger.warn("收到未知适配子进程消息:", message.event, message.msg);
		return;
	}

	const payload = message.msg as TLogPayload | string;
	logger[level](typeof payload === "string" ? payload : payload.message);
};

const runAdapterChildProcess = (
	params: TBuildParams,
	successCb: TExportSuccessCallback,
	failCb: TExportFailCallback,
) => {
	const nodeBinary = findNodeBinary();
	if (!nodeBinary) {
		throw new Error(
			"未找到外部 node.exe，请确认 Node.js 已加入系统 PATH，或设置 NODE_BINARY 指向 node.exe",
		);
	}

	const runnerPath = getAdapterRunnerPath();
	if (!existsSync(runnerPath)) {
		throw new Error(`未找到适配子进程脚本：${runnerPath}`);
	}

	const payloadPath = join(
		tmpdir(),
		`playable-adapter-${process.pid}-${Date.now()}.json`,
	);
	writeFileSync(
		payloadPath,
		JSON.stringify({ ...params, mode: "serial" }),
		"utf-8",
	);

	logger.log(`[适配] 使用外部 Node 子进程执行: ${nodeBinary.command}`);
	adapterCancelError = null;

	const child = spawn(nodeBinary.command, [runnerPath, payloadPath], {
		cwd: __dirname,
		env: nodeBinary.env,
		windowsHide: true,
	});
	activeAdapterChild = child;

	let settled = false;
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
	let stdoutBuffer = "";
	let stderr = "";

	const cleanup = () => {
		if (idleTimer) clearTimeout(idleTimer);
		if (timeoutTimer) clearTimeout(timeoutTimer);
		rmSync(payloadPath, { force: true });
		child.removeAllListeners("error");
		child.removeAllListeners("close");
		child.stdout.removeAllListeners("data");
		child.stderr.removeAllListeners("data");
		if (activeAdapterChild === child) {
			activeAdapterChild = null;
		}
		adapterCancelError = null;
	};

	const finishSuccess = () => {
		if (settled) return;
		settled = true;
		cleanup();
		successCb();
	};

	const finishFail = (error: unknown) => {
		if (settled) return;
		settled = true;
		cleanup();
		failCb(error);
	};

	const stopWithError = (message: string) => {
		if (settled) return;
		adapterCancelError = new Error(message);
		child.kill();
		finishFail(adapterCancelError);
	};

	const resetIdleTimer = () => {
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = setTimeout(
			() =>
				stopWithError(
					`适配子进程超过 ${ADAPTER_RUNNER_IDLE_TIMEOUT_MS / 1000} 秒无日志输出，已终止适配`,
				),
			ADAPTER_RUNNER_IDLE_TIMEOUT_MS,
		);
	};

	const handleLine = (line: string) => {
		const trimmed = line.trim();
		if (!trimmed) return;
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (isAdapterRunnerMessage(parsed)) {
				handleAdapterRunnerMessage(parsed, finishSuccess, finishFail);
				return;
			}
		} catch (error) {
			logger.debug("适配子进程输出不是 JSON:", error);
		}
		logger.log(trimmed);
	};

	const consumeStdout = (chunk: Buffer) => {
		resetIdleTimer();
		stdoutBuffer += chunk.toString();
		let newlineIndex = stdoutBuffer.indexOf("\n");
		while (newlineIndex >= 0) {
			const line = stdoutBuffer.slice(0, newlineIndex);
			stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
			handleLine(line);
			newlineIndex = stdoutBuffer.indexOf("\n");
		}
	};

	timeoutTimer = setTimeout(
		() =>
			stopWithError(
				`适配子进程超过 ${ADAPTER_RUNNER_TIMEOUT_MS / 1000} 秒，已终止适配`,
			),
		ADAPTER_RUNNER_TIMEOUT_MS,
	);
	resetIdleTimer();

	child.stdout.on("data", consumeStdout);
	child.stderr.on("data", (chunk: Buffer) => {
		resetIdleTimer();
		stderr += chunk.toString();
	});
	child.on("error", finishFail);
	child.on("close", (code) => {
		if (settled) return;
		if (stdoutBuffer.trim()) {
			handleLine(stdoutBuffer);
		}
		if (code === 0) {
			finishSuccess();
			return;
		}
		finishFail(
			adapterCancelError ||
				deserializeError(stderr.trim() || `适配子进程退出码 ${code}`),
		);
	});
};

const getBuilderProfilePath = () =>
	join(Editor.Project.path, "profiles", "v2", "packages", "builder.json");

const parseBuildProfile = (content: string): TBuildProfile => {
	const parsed: unknown = JSON.parse(content);
	return typeof parsed === "object" && parsed !== null ? parsed : {};
};

const getRecord = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: {};

const readBuilderOptions = (
	buildPlatform: TPlatform,
	taskId: string,
): TBuildTaskOptions => {
	const profilePath = getBuilderProfilePath();
	let profile: TBuildProfile = {};
	if (existsSync(profilePath)) {
		try {
			profile = parseBuildProfile(readFileSync(profilePath, "utf-8"));
		} catch (error) {
			logger.warn("读取 Cocos 构建配置失败，将使用默认配置:", error);
		}
	}

	const latestTask = Object.values(profile.BuildTaskManager?.taskMap || {})
		.map((task) => task.options)
		.filter((options) => options?.platform === buildPlatform)
		.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0];

	return {
		...(profile.common || {}),
		...(latestTask || {}),
		id: taskId,
		taskId,
		platform: buildPlatform,
		outputName: buildPlatform,
		taskName: `${buildPlatform}-playable-temp`,
		buildPath:
			profile.common?.buildPath || latestTask?.buildPath || "project://build",
		packages: getRecord(latestTask?.packages),
	};
};

const removeBuildTask = async (taskId: string) => {
	try {
		await Editor.Message.request("builder", "remove-task", taskId, false);
		logger.debug(`已删除临时 Cocos 构建任务: ${taskId}`);
	} catch (error) {
		logger.warn(`删除临时 Cocos 构建任务失败: ${taskId}`, error);
	}
};

const cleanupStaleTempTasks = async (exceptTaskId?: string | null) => {
	try {
		const info = await Editor.Message.request("builder", "query-tasks-info");
		const taskIds = Object.keys(info.queue || {}).filter(
			(taskId) => taskId.startsWith("playable-") && taskId !== exceptTaskId,
		);
		await Promise.all(taskIds.map((taskId) => removeBuildTask(taskId)));
	} catch (error) {
		logger.warn("清理历史临时 Cocos 构建任务失败:", error);
	}
};

const createBuildTaskWatcher = (taskId: string) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let hasSeenTask = false;
	const startedAt = Date.now();

	const stop = () => {
		stopped = true;
		if (timer) clearTimeout(timer);
	};

	const promise = new Promise<number>((resolve, reject) => {
		const poll = async () => {
			if (stopped) return;
			try {
				const task = await Editor.Message.request(
					"builder",
					"query-task",
					taskId,
				);
				if (task) {
					hasSeenTask = true;
				}
				if (task?.state === "success") {
					stop();
					resolve(36);
					return;
				}
				if (task?.state === "failure") {
					stop();
					reject(new Error(task.message || "Cocos Creator 构建任务已中断"));
					return;
				}
			} catch (error) {
				if (hasSeenTask) {
					stop();
					reject(new Error(`Cocos Creator 构建任务已被外部移除: ${taskId}`));
					return;
				}
			}

			if (Date.now() - startedAt > BUILD_TASK_TIMEOUT_MS) {
				stop();
				reject(
					new Error(
						`Cocos Creator 构建任务超过 ${BUILD_TASK_TIMEOUT_MS / 1000} 秒未完成`,
					),
				);
				return;
			}

			timer = setTimeout(poll, BUILD_TASK_POLL_INTERVAL_MS);
		};

		poll();
	});

	return { promise, stop };
};

const runBuilder = async (buildPlatform: TPlatform, taskId: string) => {
	runningTempTaskId = taskId;
	logger.log("使用 Cocos 当前编辑器构建任务执行构建");
	const buildOptions = readBuilderOptions(buildPlatform, taskId);
	const watcher = createBuildTaskWatcher(taskId);
	const adapterPackageOptions = getRecord(buildOptions.packages[BUILDER_NAME]);
	try {
		const result = await Promise.race([
			Editor.Message.request(
				"builder",
				"add-task",
				{
					...buildOptions,
					packages: {
						...buildOptions.packages,
						[BUILDER_NAME]: {
							...adapterPackageOptions,
							[SKIP_ADAPTER_HOOK_ENV]: true,
						},
					},
				},
				true,
			),
			watcher.promise,
		]);
		if (result === 0 || result === 36) {
			return;
		}
		throw new Error(`Cocos Creator 构建任务失败，返回码 ${result}`);
	} finally {
		watcher.stop();
		runningTempTaskId = null;
	}
};

export const initBuildStartEvent = async (
	_options: Partial<IBuildTaskOption>,
) => {
	logger.log(`${BUILDER_NAME} 进行预构建处理`);
	// logger.log(`${BUILDER_NAME} 跳过预构建处理`);
};

export const initBuildFinishedEvent = (options: Partial<IBuildTaskOption>) => {
	return new Promise((resolve, reject) => {
		const { projectRootPath, projectBuildPath, adapterBuildConfig } =
			getAdapterConfig();

		// logger.log(adapterBuildConfig?.fileName);
		if (options.platform !== adapterBuildConfig?.buildPlatform) {
			logger.warn("构建平台不匹配，跳过适配");
			notifyBuildState(false);
			resolve(false);
			return;
		}

		const buildFolderPath = join(projectRootPath, projectBuildPath);

		logger.log(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`);
		notifyBuildState(true);

		const start = new Date().getTime();

		const handleExportFinished = () => {
			const end = new Date().getTime();
			logger.log(
				`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`,
			);
			notifyBuildState(false);
			resolve(true);
		};
		const handleExportError = (err: unknown) => {
			logger.error("适配失败:", err);
			notifyBuildState(false, err);
			reject(err);
		};

		const params: TBuildParams = {
			buildFolderPath,
			adapterBuildConfig: {
				...adapterBuildConfig,
				buildPlatform: options.platform!,
			},
		};

		try {
			logger.log("使用外部 Node 子进程适配");
			runAdapterChildProcess(params, handleExportFinished, handleExportError);
		} catch (error) {
			handleExportError(error);
		}
	});
};

export const buildState: TBuildState = {
	building: false,
	taskId: undefined,
	listeners: new Set<TBuildStateListener>(),
	subscribe(callback) {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	},
	notify(building, error, taskId) {
		const nextTaskId = building ? taskId : undefined;
		const changed = this.building !== building || this.taskId !== nextTaskId;
		if (!changed && !error) {
			return false;
		}
		this.building = building;
		this.taskId = nextTaskId;
		this.listeners.forEach((listener) =>
			listener({ building, taskId: this.taskId, error }),
		);
		return true;
	},
};

export const builder = async () => {
	try {
		const { buildPlatform, projectRootPath, projectBuildPath } =
			getAdapterConfig();
		logger.log("开始构建项目");
		logger.log(`【构建平台】${buildPlatform}`);

		const isSkipBuild = getRCSkipBuild();
		const buildPath = join(projectRootPath, projectBuildPath);

		const tempTaskId = isSkipBuild ? null : `playable-${Date.now()}`;
		activeTaskId = tempTaskId;
		notifyBuildState(true, undefined, tempTaskId || undefined);
		await cleanupStaleTempTasks(tempTaskId);
		await initBuildStartEvent({
			platform: buildPlatform,
		});
		try {
			if (!isSkipBuild && tempTaskId) {
				await runBuilder(buildPlatform, tempTaskId);
			}
			await initBuildFinishedEvent({
				platform: buildPlatform,
			});
			logger.log("构建完成");
		} finally {
			if (tempTaskId) {
				await removeBuildTask(tempTaskId);
			}
			activeTaskId = null;
		}
		shell.openPath(buildPath);
	} catch (error) {
		logger.error("构建失败:", error);
		notifyBuildState(false, error);
		activeTaskId = null;
		return;
	}
};
