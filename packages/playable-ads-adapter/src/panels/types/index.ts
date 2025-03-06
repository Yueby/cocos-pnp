import { HTMLCustomElement, IBuildTaskOption, IPanelThis, TPanelElements } from '../../../@types';

export const PACKAGE_NAME = 'playable-ads-adapter';
export type TAdapterRCKeys = keyof TAdapterRC;

// 排除 exportChannels 和 injectOptions 的类型
export type TAdapterRCKeysExcluded = Exclude<TAdapterRCKeys, 'exportChannels' | 'injectOptions'>;

export interface ITaskOptions extends IBuildTaskOption {
	packages: {
		[PACKAGE_NAME]: TAdapterRC;
	};
}

export interface ICustomPanelThis extends IPanelThis {
	options: ITaskOptions;
	$: TCustomPanelElements;
}

export type TCustomPanelElements = TPanelElements & {
	[key in TAdapterRCKeysExcluded]: HTMLCustomElement;
};
