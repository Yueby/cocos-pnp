import { _decorator, game } from 'cc';
const { ccclass, property } = _decorator;

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
	Yandex: 'Yandex'
};

// @ts-ignore
window.advChannels = '{{__adv_channels_adapter__}}';
// @ts-ignore
window.language = '{{__language_adapter__}}';

// 需要暂停的渠道列表
const PAUSE_CHANNELS: string[] = [
	Channels.Unity
];

export class Playable {
	public static get channel(): string {
		// @ts-ignore
		return window.advChannels;
	}

	public static get lang(): string {
		// @ts-ignore
		return window.language;
	}

	public static isChannel(channel: string): boolean {
		return this.channel === channel;
	}

	public static tryPause(): void {
		const currentChannel = this.channel;
		if (PAUSE_CHANNELS.includes(currentChannel)) {
			game.pause();
			const mraidReady = (window as any).mraidReady;
			// console.log('[GameStart] MRAID Ready:', mraidReady);
			// 如果没有 MRAID 或者已经可见，恢复游戏
			if (!mraidReady) {
				game.resume();
			} else {
			}
			// console.log(`[Playable] Game paused for channel: ${currentChannel}`);
		}
	}

	public static showAds(onSuccess?: () => void, onError?: () => void): void {
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
			console.error(error);
			onError?.();
		}
	}
}
