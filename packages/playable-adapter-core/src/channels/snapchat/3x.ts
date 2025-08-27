import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { writeToPath } from '@/utils/file-system';
import { join } from 'path';

export const export3xSnapChat = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'SnapChat';

	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel);
			$(sdkInjectScript).appendTo('head');
		},
		transform: async (destPath) => {
			// 创建 SnapChat 要求的 config.json 文件，强制设置 orientation 为 1（竖屏）
			const configJsonPath = join(destPath, '/config.json');
			writeToPath(configJsonPath, JSON.stringify({ orientation: 1 }));
		},
		exportType: 'dirZip',
		dontExtractJS: true
	});
};
