import { exportZipFromSingleFile } from '@/exporter';
import { TChannel, TChannelPkgOptions } from '@/typings';
import { SET_GET_GAMEPADS_NULL } from './inject-vars';

export const exportFacebook = async (options: TChannelPkgOptions) => {
	const channel: TChannel = 'Facebook';
	await exportZipFromSingleFile({
		...options,
		channel,
		transformHTML: async ($) => { $('body script').first().before(SET_GET_GAMEPADS_NULL); },
		exportType: 'zip',
		fixInitScript: true
	});
};
