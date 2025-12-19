import { exportSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { MRAID_INIT_SCRIPT, MRAID_SCRIPT } from './inject-vars';

export const export3xUnity = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Unity';
	await exportSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel) || MRAID_SCRIPT;
			$(sdkInjectScript).appendTo('head');
			$(MRAID_INIT_SCRIPT).appendTo('head');
		}
	});
};
