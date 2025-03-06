import { builder3x } from '@/extensions/builder/3x';

export const methods: { [key: string]: (...opts: unknown[]) => unknown } = {
	builder3x
};

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() {}

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() {}

export const configs = {
	'*': {
		hooks: './hooks',
		panel: './panel'
	}
};
