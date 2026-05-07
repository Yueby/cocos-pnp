import { BUILDER_NAME } from '@/extensions/constants';
import { logger, parseAdapterLogLevel, TLogPayload } from '@/extensions/logger';
import { checkOSPlatform, getAdapterConfig, getRCSkipBuild, getRealPath } from '@/extensions/utils';
import { spawn } from 'child_process';
import { shell } from 'electron';
import { join } from 'path';
import { execAdapter } from 'playable-adapter-core';
import { IBuildTaskOption } from '~types/packages/builder/@types';
import workPath from '../worker?worker';

type TBuildStatePayload = { building: boolean; error?: string };

const BUILD_PROCESS_TIMEOUT_MS = 30 * 60 * 1000;
const BUILD_PROCESS_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const WORKER_TIMEOUT_MS = 60 * 60 * 1000;
const WORKER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ADAPTER_LOG_MARKERS = ['playable-ads-adapter', 'playable-adapter-core', '[适配]', '[打包]', '[合并]', '[压缩]', '[创建zip文件]', '【执行图片压缩】', '【生成单文件】', '【生成渠道包】'];

const isLogContinuationLine = (line: string) => {
	return /^\s+/.test(line) || /^at\s+/.test(line) || /^(Caused by:|From previous event:|---)/.test(line);
};

const createLineLogger = (log: (message: string) => void) => {
	let pending = '';
	let block: string[] = [];

	const flushBlock = () => {
		if (!block.length) return;
		const message = block.join('\n');
		if (ADAPTER_LOG_MARKERS.some((marker) => message.includes(marker))) {
			log(message);
		}
		block = [];
	};

	const pushLine = (line: string) => {
		if (!line) return;

		if (!block.length || isLogContinuationLine(line)) {
			block.push(line);
			return;
		}

		flushBlock();
		block.push(line);
	};

	const flush = () => {
		if (pending) {
			pushLine(pending);
			pending = '';
		}
		flushBlock();
	};

	const write = (data: Buffer) => {
		pending += data.toString();
		const lines = pending.split(/\r?\n/);
		pending = lines.pop() || '';

		for (const line of lines) {
			pushLine(line);
		}
	};

	return {
		write,
		flush
	};
};

const serializeError = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	return error ? String(error) : undefined;
};

const notifyBuildState = (building: boolean, error?: unknown) => {
	buildState.notify(building, error instanceof Error ? error : error ? new Error(String(error)) : undefined);
	const payload: TBuildStatePayload = {
		building,
		error: serializeError(error)
	};
	Editor.Message.broadcast('adapter:build-state', payload);
};

const setupWorker = (params: { buildFolderPath: string; adapterBuildConfig: TAdapterRC }, successCb: Function, failCb: Function) => {
	const { Worker } = require('worker_threads');

	const worker = new Worker(workPath, {
		workerData: params
	});
	let settled = false;
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

	const cleanup = () => {
		if (idleTimer) clearTimeout(idleTimer);
		if (timeoutTimer) clearTimeout(timeoutTimer);
		worker.removeAllListeners('message');
		worker.removeAllListeners('error');
		worker.removeAllListeners('exit');
	};

	const timeout = (message: string) => {
		if (settled) return;
		settled = true;
		cleanup();
		worker.terminate().catch((error: Error) => logger.warn('终止 Worker 失败:', error));
		failCb(new Error(message));
	};

	const resetIdleTimer = () => {
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = setTimeout(() => timeout(`Worker 超过 ${WORKER_IDLE_TIMEOUT_MS / 1000} 秒无日志输出，已终止适配`), WORKER_IDLE_TIMEOUT_MS);
	};

	timeoutTimer = setTimeout(() => timeout(`Worker 适配超过 ${WORKER_TIMEOUT_MS / 1000} 秒，已终止适配`), WORKER_TIMEOUT_MS);
	resetIdleTimer();

	const finish = (cb: Function, value?: unknown) => {
		if (settled) return;
		settled = true;
		cleanup();
		cb(value);
	};
	worker.on('message', ({ finished, msg, event }: TWorkerMsg) => {
		resetIdleTimer();
		if (event === 'adapter:finished') {
			finished ? finish(successCb) : finish(failCb, msg);
			return;
		}

		const level = parseAdapterLogLevel(event);
		if (!level) {
			logger.warn('收到未知 Worker 消息:', event, msg);
			return;
		}

		const payload = msg as TLogPayload | string;
		logger[level](typeof payload === 'string' ? payload : payload.message);
	});
	worker.on('error', (error: Error) => {
		finish(failCb, error);
	});
	worker.on('exit', (code: number) => {
		if (!settled) {
			finish(failCb, new Error(`Worker退出但未完成适配，退出码 ${code}`));
		}
	});
};

const runBuilder = (buildPlatform: TPlatform) => {
	return new Promise<void>((resolve, reject) => {
		let settled = false;
		let idleTimer: ReturnType<typeof setTimeout> | undefined;
		let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
		let lastOutputAt = Date.now();

		const cleanup = () => {
			if (idleTimer) clearTimeout(idleTimer);
			if (timeoutTimer) clearTimeout(timeoutTimer);
		};

		const finish = (cb: (value?: any) => void, value?: any) => {
			if (settled) return;
			settled = true;
			cleanup();
			cb(value);
		};

		let cocosBuilderPath = Editor.App.path;
		const platform = checkOSPlatform();
		if (platform === 'MAC') {
			cocosBuilderPath = cocosBuilderPath.replace('/Resources/app.asar', '/MacOS/CocosCreator');
		} else if (platform === 'WINDOWS') {
			cocosBuilderPath = getRealPath(cocosBuilderPath).replace('/resources/app.asar', '/CocosCreator.exe');
		} else {
			reject(`不支持${platform}平台构建`);
			return;
		}

		const processRef = spawn(cocosBuilderPath, ['--project', Editor.Project.path, '--build', `platform=${buildPlatform}`], {
			shell: false,
			windowsHide: true
		});
		const stdoutLogger = createLineLogger((message) => logger.log(message));
		const stderrLogger = createLineLogger((message) => logger.warn(message));

		const killProcess = (message: string) => {
			if (settled) return;
			logger.error(message);
			processRef.kill();
			finish(reject, new Error(message));
		};

		const resetIdleTimer = () => {
			lastOutputAt = Date.now();
			if (idleTimer) clearTimeout(idleTimer);
			idleTimer = setTimeout(() => {
				const idleSeconds = ((Date.now() - lastOutputAt) / 1000).toFixed(0);
				killProcess(`Cocos Creator 构建超过 ${idleSeconds} 秒无日志输出，已终止构建`);
			}, BUILD_PROCESS_IDLE_TIMEOUT_MS);
		};

		timeoutTimer = setTimeout(() => killProcess(`Cocos Creator 构建超过 ${BUILD_PROCESS_TIMEOUT_MS / 1000} 秒，已终止构建`), BUILD_PROCESS_TIMEOUT_MS);
		resetIdleTimer();

		processRef.stdout?.on('data', (data: Buffer) => {
			resetIdleTimer();
			stdoutLogger.write(data);
		});
		processRef.stderr?.on('data', (data: Buffer) => {
			resetIdleTimer();
			stderrLogger.write(data);
		});
		processRef.on('error', (error) => {
			stdoutLogger.flush();
			stderrLogger.flush();
			finish(reject, error);
		});
		processRef.on('close', (code) => {
			stdoutLogger.flush();
			stderrLogger.flush();
			if (code === 0) {
				finish(resolve);
				return;
			}
			finish(reject, new Error(`Cocos Creator 构建失败，退出码 ${code}`));
		});
	});
};

export const initBuildStartEvent = async (options: Partial<IBuildTaskOption>) => {
	logger.log(`${BUILDER_NAME} 进行预构建处理`);
	// logger.log(`${BUILDER_NAME} 跳过预构建处理`);
};

export const initBuildFinishedEvent = (options: Partial<IBuildTaskOption>) => {
	return new Promise((resolve, reject) => {
		const { projectRootPath, projectBuildPath, adapterBuildConfig } = getAdapterConfig();

		// logger.log(adapterBuildConfig?.fileName);
		if(options.platform !== adapterBuildConfig?.buildPlatform){
			logger.warn('构建平台不匹配，跳过适配');
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
			logger.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`);
			notifyBuildState(false);
			Editor.Message.broadcast('adapter:build-finished');
			resolve(true);
		};
		const handleExportError = (err: unknown) => {
			logger.error('适配失败');
			notifyBuildState(false, err);
			reject(err);
		};

		const params = {
			buildFolderPath,
			adapterBuildConfig: {
				...adapterBuildConfig,
				buildPlatform: options.platform!
			}
		};

		try {
			logger.log('尝试使用Worker适配');
			setupWorker(params, handleExportFinished, handleExportError);
		} catch (error) {
			logger.log('不支持Worker，将开启主线程适配');

			execAdapter(params, {
				mode: 'serial'
			}).then(handleExportFinished).catch(handleExportError);
		}
	});
};

export const buildState = {
	building: false,
	listeners: new Set<(state: { building: boolean; error?: Error }) => void>(),
	subscribe(callback: (state: { building: boolean; error?: Error }) => void) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	},
	notify(building: boolean, error?: Error) {
		this.building = building;
		this.listeners.forEach(listener => listener({ building, error }));
	}
};

export const builder = async () => {
	try {
		const { buildPlatform, projectRootPath, projectBuildPath } = getAdapterConfig();
		logger.log('开始构建项目');
		logger.log(`【构建平台】${buildPlatform}`);
		notifyBuildState(true);

		const isSkipBuild = getRCSkipBuild();
		const buildPath = join(projectRootPath, projectBuildPath);

		await initBuildStartEvent({
			platform: buildPlatform
		});
		if (!isSkipBuild) {
			await runBuilder(buildPlatform);
		}
		await initBuildFinishedEvent({
			platform: buildPlatform
		});
		shell.openPath(buildPath);
		logger.log('构建完成');
	} catch (error) {
		logger.error('构建失败:', error);
		notifyBuildState(false, error);
		return;
	}
};
