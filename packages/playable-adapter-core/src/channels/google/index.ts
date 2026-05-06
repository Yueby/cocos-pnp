import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, AUTO_META, LANDSCAPE_META, PORTRAIT_META } from './inject-vars';

export const exportGoogle = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Google';
	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const orientationMap = { landscape: LANDSCAPE_META, portrait: PORTRAIT_META, auto: AUTO_META };
			const orientationStr = orientationMap[orientation] || PORTRAIT_META;
			$(orientationStr).appendTo('head');
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).appendTo('head');
		},
		exportType: 'zip',
		fixInitScript: true
	});
};
