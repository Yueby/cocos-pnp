import { getChannelRCSdkScript } from "@/utils"
import { exportSingleFile } from "@/exporter/2x"
import { AD_SDK_SCRIPT } from "./inject-vars"
import { TChannel, TChannelPkgOptions } from "@/channels/base"

export const export2xLiftoff = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Liftoff'
  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
    }
  })
}