/**
 * 通用 MRAID 脚本注入
 * 提供不同级别的 MRAID 初始化脚本供各平台使用
 */

// MRAID SDK 引用（所有平台通用）
export const MRAID_SDK_SCRIPT = `<script src="mraid.js"></script>`

// === MRAID 配置接口 ===
export interface MraidConfig {
  /** ready 事件后的自定义逻辑 */
  onReady?: string
  /** 是否监听 stateChange */
  stateChange?: string | boolean
  /** 是否监听 viewableChange */
  viewableChange?: string | boolean
  /** 是否需要游戏控制函数 */
  needGameControl?: boolean
  /** 自定义 viewableChange 处理逻辑 */
  onViewableChange?: string
}

/**
 * 生成 MRAID 初始化脚本
 */
export function createMraidScript(config: MraidConfig): string {
  const parts: string[] = []
  
  // Start 函数
  parts.push(`function Start(){if(mraid.getState()==='loading'){mraid.addEventListener('ready',onSdkReady);}else{onSdkReady();}}`)
  
  // onSdkReady 函数
  let readyBody = `console.log('[Playable] MRAID SDK Ready');`
  
  // 添加 stateChange 监听
  if (config.stateChange) {
    const stateLogic = typeof config.stateChange === 'string' 
      ? config.stateChange 
      : `console.log('[Playable] MRAID State:',state);`
    readyBody += `mraid.addEventListener('stateChange',function(state){${stateLogic}});`
  }
  
  // 添加 viewableChange 监听
  if (config.viewableChange) {
    readyBody += `mraid.addEventListener('viewableChange',viewableChangeHandler);`
    if (config.needGameControl) {
      readyBody += `window.checkViewable();`
    } else {
      readyBody += `if(mraid.isViewable()){resumeGame();}`
    }
  }
  
  // 添加自定义 ready 逻辑
  if (config.onReady) {
    readyBody += config.onReady
  }
  
  parts.push(`function onSdkReady(){${readyBody}}`)
  
  // 添加游戏控制函数
  if (config.needGameControl) {
    // checkViewable - 供外部调用
    parts.push(`window.checkViewable=function(){if(typeof mraid!=='undefined'){if(mraid.isViewable()){resumeGame();}else{pauseGame();}}else{resumeGame();}};`)
    
    // resumeGame
    parts.push(`function resumeGame(){console.log('[Playable] Showing/Resuming ad...');if(typeof cc!=='undefined'&&cc.director){cc.director.resume();cc.game.resume();}}`)
    
    // pauseGame
    parts.push(`function pauseGame(){if(typeof cc!=='undefined'&&cc.director){cc.director.pause();cc.game.pause();}}`)
  }
  
  // 添加 viewableChange 处理函数
  if (config.viewableChange) {
    if (config.needGameControl) {
      parts.push(`function viewableChangeHandler(viewable){console.log('[Playable] MRAID Viewable:',viewable);window.checkViewable();}`)
    } else {
      const viewableLogic = typeof config.viewableChange === 'string'
        ? config.viewableChange
        : config.onViewableChange || `console.log('[Playable] MRAID Viewable:',viewable);if(viewable){resumeGame();}`
      parts.push(`function viewableChangeHandler(viewable){${viewableLogic}}`)
    }
  }
  
  // 立即初始化
  parts.push(`if(typeof mraid!=='undefined'){Start();}else{console.warn('[Playable] MRAID Not available (test/preview mode)');}`)
  
  return `<script>(function(){${parts.join('')}})();</script>`
}

