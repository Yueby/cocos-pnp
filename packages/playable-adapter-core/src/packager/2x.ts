import {
  export2xAppLovin,
  export2xBigo,
  export2xFacebook,
  export2xGoogle,
  export2xIronSource,
  export2xLiftoff,
  export2xMintegral,
  export2xMoloco,
  export2xPangle,
  export2xRubeex,
  export2xSnapChat,
  export2xTiktok,
  export2xUnity,
  export2xYandex,
} from '@/channels';
import {
  TChannel,
  TChannelPkgOptions,
} from '@/typings';
import { genChannelsPkg as baseGenChannelsPkg, TMode } from './base';

const channelExports: { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> } = {
  AppLovin: export2xAppLovin,
  Bigo: export2xBigo,
  Facebook: export2xFacebook,
  Google: export2xGoogle,
  IronSource: export2xIronSource,
  Liftoff: export2xLiftoff,
  Mintegral: export2xMintegral,
  Moloco: export2xMoloco,
  Pangle: export2xPangle,
  Rubeex: export2xRubeex,
  SnapChat: export2xSnapChat,
  Tiktok: export2xTiktok,
  Unity: export2xUnity,
  Yandex: export2xYandex,
}

export const genChannelsPkg = (options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
  return baseGenChannelsPkg(channelExports, options, mode ?? 'parallel')
}