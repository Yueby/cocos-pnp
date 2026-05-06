import { exportSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';

export const exportMoloco = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Moloco';
	await exportSingleFile({ ...options, channel, transformHTML: async ($) => { const sdkInjectScript = getChannelRCSdkScript(channel); $('body script').first().before(sdkInjectScript); } });
};
