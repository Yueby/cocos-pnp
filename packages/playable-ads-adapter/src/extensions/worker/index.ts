import { execAdapter } from 'playable-adapter-core';
import { parentPort, workerData } from 'worker_threads';
import { createLogPayload, TLogLevel, toAdapterLogEvent } from '../logger';

const overrideConsole = () => {
	const originalConsole = {
		debug: console.debug.bind(console),
		log: console.log.bind(console),
		info: console.info.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console)
	};

	const forward = (level: TLogLevel, args: unknown[]) => {
		parentPort?.postMessage({
			event: toAdapterLogEvent(level),
			msg: createLogPayload(level, args)
		});
		originalConsole[level](...args);
	};

	console.debug = (...args: unknown[]) => forward('debug', args);
	console.log = (...args: unknown[]) => forward('log', args);
	console.info = (...args: unknown[]) => forward('info', args);
	console.warn = (...args: unknown[]) => forward('warn', args);
	console.error = (...args: unknown[]) => forward('error', args);
};

const task = async () => {
	try {
		overrideConsole();

		const { buildFolderPath, adapterBuildConfig } = workerData;
		await execAdapter(
			{
				buildFolderPath,
				adapterBuildConfig
			},
			{
				mode: 'serial'
			}
		);

		parentPort?.postMessage({
			finished: true,
			msg: 'success',
			event: 'adapter:finished'
		});
	} catch (error) {
		parentPort?.postMessage({
			finished: false,
			msg: error,
			event: 'adapter:finished'
		});
	}
};
task();
