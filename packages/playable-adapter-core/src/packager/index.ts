import {
  exportAppLovin,
  exportBigo,
  exportFacebook,
  exportGoogle,
  exportIronSource,
  exportLiftoff,
  exportMintegral,
  exportMoloco,
  exportPangle,
  exportRubeex,
  exportSnapChat,
  exportTiktok,
  exportUnity,
  exportYandex,
} from '@/channels';
import {
  TChannel,
  TChannelPkgOptions,
} from '@/typings';
import { genChannelsPkg as baseGenChannelsPkg, TMode } from './base';

const channelExports: { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> } = {
  AppLovin: exportAppLovin,
  Bigo: exportBigo,
  Facebook: exportFacebook,
  Google: exportGoogle,
  IronSource: exportIronSource,
  Liftoff: exportLiftoff,
  Mintegral: exportMintegral,
  Moloco: exportMoloco,
  Pangle: exportPangle,
  Rubeex: exportRubeex,
  SnapChat: exportSnapChat,
  Tiktok: exportTiktok,
  Unity: exportUnity,
  Yandex: exportYandex,
}

export const genChannelsPkg = (options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
  return baseGenChannelsPkg(channelExports, options, mode ?? 'parallel')
}
