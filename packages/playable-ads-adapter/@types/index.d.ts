/// <reference path="@cocos/creator-types/editor/editor.d.ts"/>
/// <reference path="@cocos/creator-types/editor/message.d.ts"/>
/// <reference path="@cocos/creator-types/editor/utils.d.ts"/>

/// <reference path="@cocos/creator-types/editor/packages/builder/@types/public/global.d.ts"/>
export * from '@cocos/creator-types/editor/packages/builder/@types/public';

import { IBuildTaskOption, IPanelThis } from '@cocos/creator-types/editor/packages/builder/@types/public';
import { Checkbox, Input, Select } from '@editor/creator-ui-kit/dist/renderer';
import { TAdapterRC } from "playable-adapter-core";

const PACKAGE_NAME = 'playable-ads-adapter';
export interface ITaskOptions extends IBuildTaskOption {
	packages: {
		[PACKAGE_NAME]: TAdapterRC;
	};
}

export interface ICustomPanelThis extends IPanelThis {
	options: ITaskOption;
	errorMap: any;
	pkgName: string;
	$: {
		root: HTMLElement;
		fileName: Editor.UI.HTMLCustomElement<Input>;
		titleName: Editor.UI.HTMLCustomElement<Input>;
		iosUrl: Editor.UI.HTMLCustomElement<Input>;
		androidUrl: Editor.UI.HTMLCustomElement<Input>;
		buildPlatform: Editor.UI.HTMLCustomElement<Input>;
		orientation: Editor.UI.HTMLCustomElement<Select>;
		tinify: Editor.UI.HTMLCustomElement<Checkbox>;
		tinifyApiKey: Editor.UI.HTMLCustomElement<Input>;
		[key: string]: Editor.UI.HTMLCustomElement | HTMLElement;
	};
}
