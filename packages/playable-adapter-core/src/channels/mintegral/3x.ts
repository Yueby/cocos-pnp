import { exportZipFromSingleFile } from "@/exporter/3x";
import { TChannel, TChannelPkgOptions } from "@/typings";
import { MINTEGRAL_INIT_SCRIPT } from './inject-vars';

export const export3xMintegral = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Mintegral'

  await exportZipFromSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      $(MINTEGRAL_INIT_SCRIPT).appendTo('head');
    },
    exportType: 'zip',
    fixInitScript: true
  })
}