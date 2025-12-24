import { exportSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, MRAID_INIT_SCRIPT } from './inject-vars';

export const export3xIronSource = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'IronSource';
	await exportSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).appendTo('head');

			$(MRAID_INIT_SCRIPT).appendTo('head');
		}
	});
};
