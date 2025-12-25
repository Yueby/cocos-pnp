import { createMraidScript, MRAID_SDK_SCRIPT } from '@/helpers/mraid-scripts'

// AppLovin 只要求等待 ready 事件
export const AD_SDK_SCRIPT = MRAID_SDK_SCRIPT
export const MRAID_INIT_SCRIPT = createMraidScript({})