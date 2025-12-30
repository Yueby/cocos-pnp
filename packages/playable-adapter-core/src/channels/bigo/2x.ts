import { ORIENTATION_MAP } from '@/constants';
import { exportDirZipFromSingleFile } from '@/exporter/2x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { exportConfigJson, getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, BIGO_INIT_SCRIPT } from './inject-vars';

export const export2xBigo = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Bigo';
	await exportDirZipFromSingleFile({
		...options,
		channel,
		dontExtractJS: true, // BIGO 要求不能有动态加载，所有 JS 保持内联
		transformHTML: async ($) => {
			// BIGO Ads 要求 SDK 在 body 开头且在开发者代码之前
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).prependTo('body');
			// 注入 gameReady 自动调用脚本（紧跟在 SDK 后面）
			$(BIGO_INIT_SCRIPT).insertAfter($('body script').first());
		},
		transform: async (destPath) => {
			await exportConfigJson({
				destPath,
				customConfig: { orientation: ORIENTATION_MAP[orientation] }
			});
		}
	});
};

