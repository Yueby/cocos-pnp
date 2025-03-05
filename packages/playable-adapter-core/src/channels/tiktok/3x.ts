import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { exportConfigJson, getChannelRCSdkScript } from '@/utils';
import { APPEND_TO_HEAD } from './inject-vars';

export const export3xTiktok = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Tiktok';

	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel) || APPEND_TO_HEAD;
			$(sdkInjectScript).appendTo('head');
		},
		transform: async (destPath) => {
			await exportConfigJson({
				destPath,
				orientation
			});
		},
		exportType: 'dirZip'
	});
};
