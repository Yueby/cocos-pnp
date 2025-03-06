import { HTMLCustomElement, TPanelSelector } from '../../../@types';
import { ICustomPanelThis } from '../types';

export function initPanelElements<T extends ICustomPanelThis>(panel: T, selectors: TPanelSelector): void {
	// 查找根元素
	const root = panel.$.root;

	if (!root) {
		throw new Error(`根元素不存在: ${selectors.root}`);
	}

	// 遍历所有选择器
	for (const key in selectors) {
		// 跳过 root 键，因为已经处理过了

		if (panel.$[key]) {
			console.log(`${key} 已存在, 跳过初始化`);
			continue;
		} else {
			console.log(`${key} 不存在, 尝试初始化`);
		}

		try {
			// 在根元素内查找对应的 DOM 元素
			const element = root.querySelector(selectors[key]) as HTMLCustomElement;

			if (!element) {
				console.warn(`元素不存在: ${key} (${selectors[key]})`);
				continue; // 跳过不存在的元素，而不是抛出错误
			}

			// 将元素添加到 elements 对象中
			panel.$[key] = element;
		} catch (error) {
			console.error(`初始化元素时出错: ${key}`, error);
			// 继续处理其他元素，而不是中断整个过程
		}
	}
}
