import { _decorator } from 'cc';
const { ccclass, property } = _decorator;

// 导出渠道常量
export const Channels = {
	AppLovin: 'AppLovin',
	Facebook: 'Facebook',
	Google: 'Google',
	IronSource: 'IronSource',
	Liftoff: 'Liftoff',
	Mintegral: 'Mintegral',
	Moloco: 'Moloco',
	Pangle: 'Pangle',
	Rubeex: 'Rubeex',
	Tiktok: 'Tiktok',
	Unity: 'Unity',
	SnapChat: 'SnapChat',
	Yandex: 'Yandex',
	Bigo: 'Bigo'
} as const;

// 类型定义
interface PlayableType {
	channel: string;
	lang: string;
	isChannel(channel: string): boolean;
	showAds(onSuccess?: () => void, onError?: () => void): void;
	tryGameEnd(): void;
	tryGameRetry(): void;
	start(): void;
}

// 创建 playable 对象
// @ts-ignore
window.playable = {
	// 属性（占位符，构建时替换）
	channel: '{{__adv_channels_adapter__}}',
	lang: '{{__language_adapter__}}',
	
	// 渠道判断
	isChannel(channel: string): boolean {
		return this.channel === channel;
	},
	
	// 显示广告
	showAds(onSuccess?: () => void, onError?: () => void): void {
		try {
			// @ts-ignore
			if (typeof showAds !== 'function') {
				console.warn('[Playable] 当前环境不支持广告');
				onError?.();
				return;
			}
			// @ts-ignore
			showAds();
			onSuccess?.();
		} catch (error) {
			console.error('[Playable] showAds 执行失败:', error);
			onError?.();
		}
	},
	
	// 尝试调用游戏结束（通知平台）
	tryGameEnd(): void {
		switch (this.channel) {
			case Channels.Mintegral:
				// @ts-ignore
				window.gameEnd && window.gameEnd();
				break;
			case Channels.Bigo:
				// @ts-ignore
				window.BGY_MRAID && window.BGY_MRAID.gameEnd();
				break;
			// 其他平台按需添加
			default:
				// 静默处理
				break;
		}
	},
	
	// 尝试调用游戏重玩（通知平台）
	tryGameRetry(): void {
		switch (this.channel) {
			case Channels.Mintegral:
				// @ts-ignore
				window.gameRetry && window.gameRetry();
				break;
			// 其他平台按需添加
			default:
				// 静默处理
				break;
		}
	},
	
	// 启动游戏（针对特定渠道）
	start(): void {
		switch (this.channel) {
			case Channels.Unity:
				// 调用 checkViewable 检查可见性
				if (typeof (window as any).checkViewable === 'function') {
					(window as any).checkViewable();
				}
				break;
			// 其他平台按需添加
			default:
				// 静默处理
				break;
		}
	}
};

/**
 * Playable 渠道工具类
 *
 * 快速导入：
 * ```ts
 * import { Playable, Channels } from 'db://playable-ads-adapter/Playable';
 * ```
 *
 * 常用 API：
 * - `Playable.channel` / `Playable.lang` — 当前渠道名与语言（构建时注入）
 * - `Playable.isChannel(Channels.Mintegral)` — 渠道判断
 * - `Playable.showAds(onSuccess?, onError?)` — 点击 CTA，触发渠道跳转
 * - `Playable.tryGameEnd()` — 结束画面出现时调用（Mintegral / Bigo 必需）
 * - `Playable.tryGameRetry()` — 重玩场景调用（Mintegral 必需）
 * - `Playable.start()` — 针对特定渠道的启动钩子（如 Unity 可见性检查）
 */
// @ts-ignore
export const Playable: PlayableType = window.playable;
