// 平台规范：
// - gameStart / gameClose 由平台主动调用进素材，素材需暴露（此处占位，业务可覆盖）
// - gameReady / gameEnd / gameRetry / install 由平台 SDK 提供，素材主动调用（切勿在此声明空壳，否则会覆盖 SDK）
export const MINTEGRAL_INIT_SCRIPT = `<script>(function(){function waitForCocosReady(){if(typeof cc!=='undefined'){window.gameReady&&window.gameReady();}else{requestAnimationFrame(waitForCocosReady);}}waitForCocosReady();})();function gameStart(){}function gameClose(){}</script>`

