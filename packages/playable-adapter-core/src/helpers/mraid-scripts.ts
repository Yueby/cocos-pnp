/**
 * 通用 MRAID 脚本注入
 * 提供不同级别的 MRAID 初始化脚本供各平台使用
 */

// MRAID SDK 引用（所有平台通用）
export const MRAID_SDK_SCRIPT = `<script src="mraid.js"></script>`

// === 通用代码片段 ===
const INIT_MRAID_FN = `function initMraid(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onMraidReady);}else{onMraidReady();}}`
const MRAID_CHECK = `if(typeof mraid!=='undefined'){window.playable.sdkReady=true;initMraid();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}`
const SDK_READY_LOG = `console.log('[Playable] MRAID SDK Ready');`

// === MRAID 配置接口 ===
export interface MraidConfig {
  /** ready 事件后的自定义逻辑 */
  onReady?: string
  /** 是否监听 stateChange */
  stateChange?: string | boolean
  /** 是否监听 viewableChange */
  viewableChange?: string | boolean
  /** 是否需要 resumeGame 函数 */
  needResume?: boolean
  /** 自定义 viewableChange 处理逻辑 */
  onViewableChange?: string
}

/**
 * 生成 MRAID 初始化脚本
 */
export function createMraidScript(config: MraidConfig): string {
  const parts: string[] = [INIT_MRAID_FN]
  
  // 构建 onMraidReady 函数体
  let readyBody = SDK_READY_LOG
  
  // 添加 stateChange 监听
  if (config.stateChange) {
    const stateLogic = typeof config.stateChange === 'string' 
      ? config.stateChange 
      : `console.log('[Playable] MRAID State:',state);`
    readyBody += `mraid.addEventListener('stateChange',function(state){${stateLogic}});`
  }
  
  // 添加 viewableChange 监听
  if (config.viewableChange) {
    readyBody += `mraid.addEventListener('viewableChange',onViewableChange);`
    readyBody += `if(mraid.isViewable()){resumeGame();}`
  }
  
  // 添加自定义 ready 逻辑或默认 resumeGame
  if (config.onReady) {
    readyBody += config.onReady
  } else if (config.needResume && !config.viewableChange) {
    // 如果需要 resumeGame 且没有配置 viewableChange，则默认在 ready 后调用
    readyBody += `resumeGame();`
  }
  
  parts.push(`function onMraidReady(){${readyBody}}`)
  
  // 添加 resumeGame 函数
  if (config.needResume) {
    parts.push(`function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.director){cc.director.resume();cc.game.resume();}startPauseMonitor();}`)
    parts.push(`function startPauseMonitor(){if(window._pauseMonitor)return;var t=Date.now();window._pauseMonitor=setInterval(function(){if(typeof cc!=='undefined'&&cc.game){if(cc.game.isPaused()){cc.director.resume();cc.game.resume();clearInterval(window._pauseMonitor);window._pauseMonitor=null;}else if(Date.now()-t>2000){clearInterval(window._pauseMonitor);window._pauseMonitor=null;}}},100);}`)
  }
  
  // 添加 viewableChange 处理函数
  if (config.viewableChange) {
    const viewableLogic = typeof config.viewableChange === 'string'
      ? config.viewableChange
      : config.onViewableChange || `console.log('[Playable] MRAID Viewable:',viewable);if(viewable){resumeGame();}`
    parts.push(`function onViewableChange(viewable){${viewableLogic}}`)
  }
  
  parts.push(MRAID_CHECK)
  
  return `<script>(function(){window.playable=window.playable||{sdkReady:false};${parts.join('')}})();</script>`
}

