import { TChannel, TChannelPkgOptions } from '@/typings';
import { getAdapterRCJson } from '@/utils';

type TChannelExport = { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> };

export type TMode = 'parallel' | 'serial';

const getChannelKeys = (channelExports: TChannelExport): TChannel[] => {
	const { exportChannels = [] } = getAdapterRCJson() || {};
	const channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels;

	for (const key of channelKeys) {
		if (!channelExports[key]) {
			throw new Error(`[打包] 未支持的渠道: ${key}`);
		}
	}

	console.log(`[打包] 将生成 ${channelKeys.length} 个渠道包`);
	console.log(`[打包] 渠道列表: ${channelKeys.join(', ')}`);

	return channelKeys;
};

const serialGen = async (channelExports: TChannelExport, options: TChannelPkgOptions) => {
	const channelKeys = getChannelKeys(channelExports);

	for (let index = 0; index < channelKeys.length; index++) {
		const key = channelKeys[index];
		console.log(`[打包] 开始生成 ${key} 渠道包 (${index + 1}/${channelKeys.length})`);
		await channelExports[key](options);
		console.log(`[打包] ${key} 渠道包生成完成 (${index + 1}/${channelKeys.length})`);
	}
};

const parallelGen = async (channelExports: TChannelExport, options: TChannelPkgOptions) => {
	const channelKeys = getChannelKeys(channelExports);

	await Promise.all(channelKeys.map(async (key: TChannel) => {
		console.log(`[打包] 开始生成 ${key} 渠道包`);
		await channelExports[key](options);
		console.log(`[打包] ${key} 渠道包生成完成`);
	}));
};

export const genChannelsPkg = async (channelExports: TChannelExport, options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
	console.log(`[打包] 使用${mode === 'serial' ? '串行' : '并行'}模式生成渠道包`);
	if (mode === 'serial') {
		await serialGen(channelExports, options);
		return;
	}

	await parallelGen(channelExports, options);
};
