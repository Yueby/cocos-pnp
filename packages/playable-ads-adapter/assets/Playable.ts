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
	Unity: 'Unity'
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

	public static showAds(): void {
		try {
			// @ts-ignore
			showAds();
		} catch (error) {
			console.error(error);
		}
	}
}
