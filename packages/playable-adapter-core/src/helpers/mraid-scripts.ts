/**
 * 通用 MRAID 脚本注入
 * 提供不同级别的 MRAID 初始化脚本供各平台使用
 */

// MRAID SDK 引用（所有平台通用）
// 同时初始化 window.playable 对象，确保后续脚本可以安全访问
export const MRAID_SDK_SCRIPT = `<script src="mraid.js"></script><script>window.playable=window.playable||{sdkReady:false};</script>`

/**
 * 完整版 MRAID 初始化
 * 包含: ready + stateChange + viewableChange
 * 适用平台: 需要完整生命周期控制的平台
 */
export const MRAID_INIT_FULL = `<script>(function(){function initMraid(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onMraidReady);}else{onMraidReady();}}function onMraidReady(){console.log('[Playable] MRAID SDK Ready');window.playable.sdkReady=true;mraid.addEventListener('stateChange',function(state){console.log('[Playable] MRAID State:',state);});mraid.addEventListener('viewableChange',onViewableChange);if(mraid.isViewable()){resumeGame();}}function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.game){cc.game.resume();}}function onViewableChange(viewable){console.log('[Playable] MRAID Viewable:',viewable);if(viewable){resumeGame();}}if(typeof mraid!=='undefined'){initMraid();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}})();</script>`

/**
 * 带可见性监听的 MRAID 初始化
 * 包含: ready + viewableChange
 * 适用平台: Unity (强制要求等待可见)
 */
export const MRAID_INIT_WITH_VIEWABLE = `<script>(function(){function initMraid(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onMraidReady);}else{onMraidReady();}}function onMraidReady(){console.log('[Playable] MRAID SDK Ready');window.playable.sdkReady=true;mraid.addEventListener('viewableChange',onViewableChange);if(mraid.isViewable()){resumeGame();}}function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.game){cc.game.resume();}}function onViewableChange(viewable){console.log('[Playable] MRAID Viewable:',viewable);if(viewable){resumeGame();}}if(typeof mraid!=='undefined'){initMraid();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}})();</script>`

/**
 * 带状态监听的 MRAID 初始化
 * 包含: ready + stateChange
 * 适用平台: IronSource
 */
export const MRAID_INIT_WITH_STATE = `<script>(function(){function initMraid(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onMraidReady);}else{onMraidReady();}}function onMraidReady(){console.log('[Playable] MRAID SDK Ready');window.playable.sdkReady=true;mraid.addEventListener('stateChange',function(state){console.log('[Playable] MRAID State:',state);});resumeGame();}function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.game){cc.game.resume();}}if(typeof mraid!=='undefined'){initMraid();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}})();</script>`

/**
 * 基础版 MRAID 初始化
 * 包含: ready
 * 适用平台: AppLovin
 */
export const MRAID_INIT_BASIC = `<script>(function(){function initMraid(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onMraidReady);}else{onMraidReady();}}function onMraidReady(){console.log('[Playable] MRAID SDK Ready');window.playable.sdkReady=true;resumeGame();}function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.game){cc.game.resume();}}if(typeof mraid!=='undefined'){initMraid();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}})();</script>`

