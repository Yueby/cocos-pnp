import { MRAID_SCRIPT, MRAID_INIT_SCRIPT } from './inject-vars'
import { exportSingleFile } from "@/exporter/2x"
import { getChannelRCSdkScript } from '@/utils'
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xIronSource = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'IronSource'
  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || MRAID_SCRIPT
      $(sdkInjectScript).appendTo('head')

      $(MRAID_INIT_SCRIPT).appendTo('head')
    }
  })
}