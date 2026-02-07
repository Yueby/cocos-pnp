import { createMraidScript, MRAID_SDK_SCRIPT } from '@/helpers/mraid-scripts'

// Unity 要求等待 viewableChange 事件
export const AD_SDK_SCRIPT = MRAID_SDK_SCRIPT
export const MRAID_INIT_SCRIPT = createMraidScript({
  viewableChange: true,
  needGameControl: true
})