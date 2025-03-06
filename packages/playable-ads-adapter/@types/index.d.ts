/// <reference path="@cocos/creator-types/editor/editor.d.ts"/>
/// <reference path="@cocos/creator-types/editor/message.d.ts"/>
/// <reference path="@cocos/creator-types/editor/utils.d.ts"/>

/// <reference path="@cocos/creator-types/editor/packages/builder/@types/public/global.d.ts"/>
export * from '@cocos/creator-types/editor/packages/builder/@types/public';
export { Checkbox, Input, Select };

	import { Checkbox, Input, Select } from '@editor/creator-ui-kit/dist/renderer';

const PACKAGE_NAME = 'playable-ads-adapter';

export type HTMLCustomElement<T extends {} = Record<string, any>> = HTMLElement & T;

export type TSelector<K extends string = string> = {
	// 允许指定类型的键（可选的）
	[key in K]?: string;
} & {
	// 同时允许任意字符串键，提供更大的灵活性
	[key: string]: string;
};

export type TPanelSelector<K extends string = string> = TSelector<K> & {
	root: string;
};

// 定义面板元素类型，使其更具体
export type TPanelElements = {
	root: HTMLCustomElement;
	[key: string]: HTMLCustomElement;
};
