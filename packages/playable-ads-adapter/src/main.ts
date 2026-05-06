import { builder } from '@/extensions/builder';

export const methods: { [key: string]: (...any: any) => any; } = {
	builder,
	updateLanguage: async (lang: string) => {
		Editor.Message.broadcast('update-panel-language', lang);
	}
};

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() { }

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() { }

export const configs = {
	'*': {
		hooks: './hooks',
		panel: './panel'
	}
};
