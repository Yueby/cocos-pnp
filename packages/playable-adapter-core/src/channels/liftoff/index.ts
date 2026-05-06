import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT } from './inject-vars';

export const exportLiftoff = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Liftoff';
	await exportZipFromSingleFile({ ...options, channel, transformHTML: async ($) => { const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT; $(sdkInjectScript).appendTo('head'); }, exportType: 'zip' });
};
