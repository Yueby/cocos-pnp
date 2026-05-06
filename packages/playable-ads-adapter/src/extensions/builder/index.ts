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
	const finish = (cb: Function, value?: unknown) => {
		if (settled) return;
		settled = true;
		cb(value);
	};
	worker.on('message', ({ finished, msg, event }: TWorkerMsg) => {
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

		processRef.stdout?.on('data', (data: Buffer) => {
			console.log(data.toString());
		});
		processRef.stderr?.on('data', (data: Buffer) => {
			console.error(data.toString());
		});
		processRef.on('error', reject);
		processRef.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`Cocos Creator 构建失败，退出码 ${code}`));
		});
	});
};

export const initBuildStartEvent = async (options: Partial<IBuildTaskOption>) => {
	console.log(`${BUILDER_NAME} 进行预构建处理`);
	// console.log(`${BUILDER_NAME} 跳过预构建处理`);
};

export const initBuildFinishedEvent = (options: Partial<IBuildTaskOption>) => {
	return new Promise((resolve, reject) => {
		const { projectRootPath, projectBuildPath, adapterBuildConfig } = getAdapterConfig();

		// console.log(adapterBuildConfig?.fileName);
		if(options.platform !== adapterBuildConfig?.buildPlatform){
			console.warn('构建平台不匹配，跳过适配');
			notifyBuildState(false);
			resolve(false);
			return;
		}

		const buildFolderPath = join(projectRootPath, projectBuildPath);

		console.info(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`);
		notifyBuildState(true);

		const start = new Date().getTime();

		const handleExportFinished = () => {
			const end = new Date().getTime();
			console.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`);
			notifyBuildState(false);
			Editor.Message.broadcast('adapter:build-finished');
			resolve(true);
		};
		const handleExportError = (err: unknown) => {
			console.error('适配失败');
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
			console.log('尝试使用Worker适配');
			setupWorker(params, handleExportFinished, handleExportError);
		} catch (error) {
			console.log('不支持Worker，将开启主线程适配');

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
		console.info('开始构建项目');
		console.info(`【构建平台】${buildPlatform}`);
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
		console.info('构建完成');
	} catch (error) {
		console.error('构建失败:', error);
		notifyBuildState(false, error);
		return;
	}
};
