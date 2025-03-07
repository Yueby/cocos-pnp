import { exportZipFromSingleFile } from '@/exporter/3x';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { SET_GET_GAMEPADS_NULL } from './inject-vars';

export const export3xFacebook = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Facebook';

	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => {
			$('body script').first().before(SET_GET_GAMEPADS_NULL);
		},
		exportType: 'zip',
		fixInitScript: true
	});
};
