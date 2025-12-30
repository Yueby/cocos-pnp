
import { exportZipFromPkg } from "@/exporter/2x";
import { TChannel, TChannelPkgOptions } from "@/typings";
import { exportConfigJson, getChannelRCSdkScript } from "@/utils";

export const export2xSnapChat = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'SnapChat';

  await exportZipFromPkg({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel);
      $(sdkInjectScript).appendTo('head');
    },
    transform: async (destPath) => {
      // 创建 SnapChat 要求的 config.json 文件，强制设置 orientation 为 1（竖屏）
      await exportConfigJson({
        destPath,
        customConfig: { orientation: 1 }
      });
    }
  });
};