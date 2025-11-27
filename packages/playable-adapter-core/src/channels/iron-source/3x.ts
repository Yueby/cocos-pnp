import { exportSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { MRAID_INIT_SCRIPT, MRAID_SCRIPT } from './inject-vars';

export const export3xIronSource = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'IronSource';
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
