import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AD_SDK_SCRIPT, AUTO_META, LANDSCAPE_META, PORTRAIT_META } from './inject-vars';

export const export3xGoogle = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Google';

	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			// 增加横竖屏meta
			const orientationMap = {
				landscape: LANDSCAPE_META,
				portrait: PORTRAIT_META,
				auto: AUTO_META
			};
			// 使用映射获取对应的meta，如果不存在则默认使用竖屏
			const orientationStr = orientationMap[orientation] || PORTRAIT_META;
			$(orientationStr).appendTo('head');

			// 加入广告sdk脚本
			const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT;
			$(sdkInjectScript).appendTo('head');

			// 3D引擎需要补充在body里
			// $(SDK_EXIT_A_TAG).appendTo('body')
		},
		// transform: async (destPath) => {
		//   await zipToPath(destPath)
		//   unlinkSync(destPath)
		// }
		exportType: 'zip',
		fixInitScript: true
	});
};
