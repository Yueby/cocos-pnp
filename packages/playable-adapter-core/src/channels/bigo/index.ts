import { ORIENTATION_MAP } from '@/constants';
import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { exportConfigJson, getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, BIGO_INIT_SCRIPT } from './inject-vars';

export const exportBigo = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Bigo';
	await exportZipFromSingleFile({
		...options,
		channel,
		dontExtractJS: true,
		transformHTML: async ($) => {
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).prependTo('body');
			$(BIGO_INIT_SCRIPT).insertAfter($('body script').first());
		},
		transform: async (destPath) => {
			await exportConfigJson({ destPath, customConfig: { orientation: ORIENTATION_MAP[orientation] } });
		}
	});
};
