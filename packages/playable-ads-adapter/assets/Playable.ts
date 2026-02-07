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
				console.warn('[Playable] Ads not supported in current environment');
				onError?.();
				return;
			}
			// @ts-ignore
			showAds();
			onSuccess?.();
		} catch (error) {
			console.error('[Playable] showAds error:', error);
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

// 导出类型化的别名
// @ts-ignore
export const Playable: PlayableType = window.playable;
