import { exportSingleFile } from '@/exporter/2x'
import { TChannel, TChannelPkgOptions } from "@/typings"
import { getChannelRCSdkScript } from '@/utils'
import { AD_SDK_SCRIPT, MRAID_INIT_SCRIPT } from './inject-vars'

export const export2xAppLovin = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'AppLovin'

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
      $(MRAID_INIT_SCRIPT).appendTo('head')
    },
  })
}