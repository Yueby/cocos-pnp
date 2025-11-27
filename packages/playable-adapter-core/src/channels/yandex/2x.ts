
import { exportSingleFile } from "@/exporter/2x";
import { TChannel, TChannelPkgOptions } from "@/typings";

export const export2xYandex = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel: TChannel = 'Yandex'

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      // // 增加横竖屏meta
      // const orientationStr = orientation === 'landscape' ? LANDSCAPE_META : PORTRAIT_META
      // $(orientationStr).appendTo('head')

      // // 加入广告sdk脚本
      // const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      // $(sdkInjectScript).appendTo('head')
    },
    // transform: async (destPath) => {
    //   await zipToPath(destPath)
    //   unlinkSync(destPath)
    // }
  })
}