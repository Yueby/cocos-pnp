import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { exportConfigJson, getChannelRCSdkScript } from '@/utils';

export const exportSnapChat = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'SnapChat';
	await exportZipFromSingleFile({ ...options, channel, transformHTML: async ($) => { const sdkInjectScript = getChannelRCSdkScript(channel); $(sdkInjectScript).appendTo('head'); }, transform: async (destPath) => { await exportConfigJson({ destPath, customConfig: { orientation: 1 } }); }, exportType: 'dirZip', dontExtractJS: true });
};
