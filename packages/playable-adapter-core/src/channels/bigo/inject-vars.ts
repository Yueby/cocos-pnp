// BIGO Ads SDK 脚本
// 文档：https://docs.qq.com/doc/DZGRjc0l6bVZ1SUdB
export const AD_SDK_SCRIPT = `<script src="https://static-web.likeevideo.com/as/common-static/big-data/dsp-public/bgy-mraid-sdk.js"></script>`

// BIGO Ads 初始化脚本：自动调用 gameReady
export const BIGO_INIT_SCRIPT = `<script>(function(){function waitForCocosReady(){if(typeof cc!=='undefined'&&typeof window.BGY_MRAID!=='undefined'){window.BGY_MRAID.gameReady&&window.BGY_MRAID.gameReady();console.log('[Playable] Bigo gameReady called');}else{requestAnimationFrame(waitForCocosReady);}}waitForCocosReady();})();</script>`

