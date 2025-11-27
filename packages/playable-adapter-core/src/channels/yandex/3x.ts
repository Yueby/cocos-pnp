import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { getChannelRCSdkScript } from '@/utils';
import { AUTO_META, LANDSCAPE_META, PORTRAIT_META } from './inject-vars';

export const export3xYandex = async (options: TChannelPkgOptions) => {
	const { orientation } = options;
	const channel: TChannel = 'Yandex';

	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			// 添加广告尺寸 meta 标签
			const orientationMap = {
				landscape: LANDSCAPE_META,
				portrait: PORTRAIT_META,
				auto: AUTO_META
			};
			const orientationStr = orientationMap[orientation] || PORTRAIT_META;
			$(orientationStr).appendTo('head');

			// 加入广告sdk脚本
			const sdkInjectScript = getChannelRCSdkScript(channel);
			$(sdkInjectScript).appendTo('head');
		},
		exportType: 'zip',
		fixInitScript: true
	});
};
