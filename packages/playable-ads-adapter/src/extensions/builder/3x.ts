import { BUILDER_NAME } from '@/extensions/constants';
import { checkOSPlatform, getAdapterConfig, getRCSkipBuild, getRealPath } from '@/extensions/utils';
import { shell } from 'electron';
import { run } from 'node-cmd';
import { join } from 'path';
import { exec3xAdapter } from 'playable-adapter-core';
import { IBuildTaskOption } from '~types/packages/builder/@types';
import workPath from '../worker/3x?worker';

const setupWorker = (params: { buildFolderPath: string; adapterBuildConfig: TAdapterRC }, successCb: Function, failCb: Function) => {
	const { Worker } = require('worker_threads');

	const worker = new Worker(workPath, {
		workerData: params
	});
	worker.on('message', ({ finished, msg, event }: TWorkerMsg) => {
		if (event === 'adapter:finished') {
			finished ? successCb() : failCb(msg);
			return;
		}
		// 处理消息 adapter:log 和 adapter:info
		console[event.split(':')[1] as ConsoleMethodName](msg);
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
		}

		const processRef = run(`${cocosBuilderPath} --project ${Editor.Project.path} --build "platform=${buildPlatform}"`, (err, data, stderr) => {
			console.log(err, data, stderr);
			resolve();
		});
		//listen to the python terminal output
		processRef.stdout.on('data', (data: string) => {
			console.log(data);
		});
	});
};

export const initBuildStartEvent = async (options: Partial<IBuildTaskOption>) => {
	console.log(`${BUILDER_NAME} 进行预构建处理`);
	// console.log(`${BUILDER_NAME} 跳过预构建处理`);
};

export const initBuildFinishedEvent = (options: Partial<IBuildTaskOption>) => {
	return new Promise(async (resolve, reject) => {
		const { projectRootPath, projectBuildPath, adapterBuildConfig } = getAdapterConfig();

		// console.log(adapterBuildConfig?.fileName);
		if(options.platform !== adapterBuildConfig?.buildPlatform){
			console.warn('构建平台不匹配，跳过适配');
			return;
		}

		const buildFolderPath = join(projectRootPath, projectBuildPath);

		console.info(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`);

		const start = new Date().getTime();

		const handleExportFinished = () => {
			const end = new Date().getTime();
			console.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`);
			resolve(true);
		};
		const handleExportError = (err: string) => {
			console.error('适配失败');
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

			await exec3xAdapter(params, {
				mode: 'serial'
			});
			handleExportFinished();
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

export const builder3x = async () => {
	try {
		const { buildPlatform, projectRootPath, projectBuildPath } = getAdapterConfig();
		console.info('开始构建项目');
		console.info(`【构建平台】${buildPlatform}`);
		buildState.notify(true);

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
		buildState.notify(false, error as Error);
		return;
	}
	buildState.notify(false);
};