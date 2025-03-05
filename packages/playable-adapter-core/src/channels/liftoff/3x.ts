import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT } from './inject-vars';

export const export3xLiftoff = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Liftoff';
	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).appendTo('head');
		},
		exportType: 'zip'
	});
};
