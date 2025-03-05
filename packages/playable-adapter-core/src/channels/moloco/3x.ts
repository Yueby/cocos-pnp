import { exportSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';

export const export3xMoloco = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Moloco';

	await exportSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel);
			$('body script').first().before(sdkInjectScript);
		}
	});
};
