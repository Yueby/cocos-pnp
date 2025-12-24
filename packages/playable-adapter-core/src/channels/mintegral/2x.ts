import { exportDirZipFromSingleFile } from "@/exporter/2x";
import { TChannel, TChannelPkgOptions } from "@/typings";
import { MINTEGRAL_INIT_SCRIPT } from './inject-vars';

export const export2xMintegral = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Mintegral'

  await exportDirZipFromSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      $(MINTEGRAL_INIT_SCRIPT).appendTo('head');
    },
    exportType: 'dirZip',
    fixInitScript: true
  })
}