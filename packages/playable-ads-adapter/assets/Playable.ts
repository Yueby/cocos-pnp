import { _decorator } from 'cc';
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

	public static showAds(onSuccess?: () => void, onError?: () => void): void {
		try {
			// @ts-ignore
			if (typeof showAds !== 'function') {
				console.warn('Ads not supported in current environment');
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
