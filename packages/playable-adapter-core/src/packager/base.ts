import { TChannel, TChannelPkgOptions } from '@/typings';
import { getAdapterRCJson } from '@/utils';

type TChannelExport = { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> };

export type TMode = 'parallel' | 'serial';

type TGenParams = { channelExports: TChannelExport; options: TChannelPkgOptions; resolve: (value: void | PromiseLike<void>) => void; reject: (reason?: any) => void };

const serialGen = async (params: TGenParams) => {
	const { channelExports, options, resolve, reject } = params;
	try {
		const { exportChannels = [] } = getAdapterRCJson() || {};

		let channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels;
		console.info(`[打包] 将生成 ${channelKeys.length} 个渠道包`);
		console.info(`[打包] 渠道列表: ${channelKeys.join(', ')}`);

		for (let index = 0; index < channelKeys.length; index++) {
			const key = channelKeys[index];
			console.info(`[打包] 开始生成 ${key} 渠道包 (${index + 1}/${channelKeys.length})`);
			await channelExports[key](options);
		}

		resolve();
	} catch (error) {
		reject(error);
	}
};

const parallelGen = (params: TGenParams) => {
	const { channelExports, options, resolve, reject } = params;

	const { exportChannels = [] } = getAdapterRCJson() || {};

	let channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels;
	console.info(`[打包] 将生成 ${channelKeys.length} 个渠道包`);
	console.info(`[打包] 渠道列表: ${channelKeys.join(', ')}`);

	let tasks: Promise<void>[] = [];
	channelKeys.forEach((key: TChannel) => {
		if (exportChannels.length === 0 || exportChannels.includes(key)) {
			console.info(`[打包] 开始生成 ${key} 渠道包`);
			tasks.push(channelExports[key](options));
		}
	});
	Promise.all(tasks)
		.then(() => {
			resolve();
		})
		.catch((err) => {
			console.error('[打包] 生成渠道包失败:', err);
			reject(err);
		});
};

export const genChannelsPkg = (channelExports: TChannelExport, options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
	return new Promise(async (resolve, reject) => {
		console.info(`[打包] 使用${mode === 'serial' ? '串行' : '并行'}模式生成渠道包`);
		mode === 'serial'
			? serialGen({
					channelExports,
					options,
					resolve,
					reject
			  })
			: parallelGen({
					channelExports,
					options,
					resolve,
					reject
			  });
	});
};
