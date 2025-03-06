'use strict';

import { shell } from 'electron';
import { existsSync, promises } from 'fs';
import { HTMLCustomElement } from '../../../@types';
import { ADAPTER_RC_PATH } from '../../extensions/constants';
import { readAdapterRCFile } from '../../extensions/utils/file-system/adapterrc';
import { ICustomPanelThis, ITaskOptions, PACKAGE_NAME, TCustomPanelElements } from '../types';
import { CHANNEL_OPTIONS, EVENT_TYPES, IDS, SELECTORS, STYLE, TEMPLATE } from './config';

let panel: ICustomPanelThis;

// 配置常量
const CONFIG = {
	DEFAULT_BUILD_PLATFORM: 'web-mobile',
	DEFAULT_ORIENTATION: 'auto',
	INJECT_FIELDS: ['head', 'body', 'sdkScript'] as const
} as const;

export const style = STYLE;
export const template = TEMPLATE;
export const $ = SELECTORS;

export async function ready(options: ITaskOptions) {
	// @ts-ignore
	panel = this as ICustomPanelThis;
	panel.options = options;

	// 初始化面板元素，确保 panel.$ 中的所有元素都不为空
	// 这样在后续代码中可以安全地访问这些元素，不需要进行空检查
	// initPanelElements<ICustomPanelThis>(panel, SELECTORS);

	// 读取配置文件
	const config = readAdapterRCFile();
	if (config) {
		// 直接使用读取到的配置
		showConfigPanel();
		initImportExport(); // 初始化配置面板按钮
		setOptions(config);

		init();
	} else {
		hideConfigPanel();
		initCreatePanelButtons(); // 初始化创建面板按钮
		initCreateButton();
	}
}

/**
 * all change of options dispatched will enter here
 * @param options
 * @param key
 * @returns
 */
export async function update(options: ITaskOptions, key: string) {
	try {
		await saveConfigToFile(options);

		// 重新读取配置文件并刷新面板
		const newConfig = readAdapterRCFile();
		if (newConfig) {
			await applyConfig(newConfig, false);
		}
	} catch (err: any) {
		console.error('配置文件更新失败:', err.message);
	}

	if (!key) {
		init();
		return;
	}
}

async function saveConfigToFile(options: ITaskOptions) {
	const projectPath = Editor.Project.path;
	const configPath = `${projectPath}${ADAPTER_RC_PATH}`;

	// 获取配置并移除空值
	const config = options.packages[PACKAGE_NAME as keyof typeof options.packages];
	const cleanConfig = removeEmptyValues(config);

	await promises.writeFile(configPath, JSON.stringify(cleanConfig, null, 2));
	console.log(`保存配置到 ${configPath}`);
}

/**
 * 移除对象中的空值（空字符串、空数组、空对象）
 */
function removeEmptyValues(obj: any): any {
	if (!obj || typeof obj !== 'object') return obj;

	// 处理数组
	if (Array.isArray(obj)) {
		const filtered = obj.filter((item) => {
			if (typeof item === 'string') return item !== '';
			if (typeof item === 'object') return item !== null && Object.keys(removeEmptyValues(item)).length > 0;
			return true;
		});
		return filtered.length > 0 ? filtered : undefined;
	}

	// 处理对象
	const result: any = {};
	for (const [key, value] of Object.entries(obj)) {
		// 字符串：非空
		if (typeof value === 'string' && value !== '') {
			result[key] = value;
		}
		// 数组：非空且有内容
		else if (Array.isArray(value) && value.length > 0) {
			const cleanArray = removeEmptyValues(value);
			if (cleanArray && cleanArray.length > 0) {
				result[key] = cleanArray;
			}
		}
		// 对象：非空且有属性
		else if (value !== null && typeof value === 'object') {
			const cleanObj = removeEmptyValues(value);
			if (cleanObj && Object.keys(cleanObj).length > 0) {
				result[key] = cleanObj;
			}
		}
		// 布尔值和数字：保留
		else if (typeof value === 'boolean' || typeof value === 'number') {
			result[key] = value;
		}
	}

	return result;
}

export function close() {
	// 如果面板未初始化，直接返回
	if (!panel || !panel.$) {
		return;
	}

	try {
		const root = panel.$.root;
		if (root) {
			root.remove();
			// console.log('已移除面板根元素，清理了所有事件监听器');
		}

		// 清空面板的 $ 对象
		panel.$ = {} as TCustomPanelElements;
	} catch (err) {
		console.error('关闭面板时出错:', err);
	}
}

// 工具函数
function addEventListenerWithDispatch(element: any, eventType: string, field: string) {
	element.addEventListener(eventType, (event: any) => {
		// 使用正确的字段路径格式
		panel.dispatch('update', `packages.${PACKAGE_NAME}.${field}`, event.target.value);
	});
}

function addChannelInputListeners(channel: TChannel) {
	CONFIG.INJECT_FIELDS.forEach((field) => {
		const input = panel.$[`${channel}-${field}`];
		if (input) {
			addEventListenerWithDispatch(input, 'confirm', `injectOptions.${channel}.${field}`);
		}
	});
}

// tinify 复选框的事件处理函数
const handleTinifyChange = (event: any) => {
	updateTinifyKeyVisibility(event.target.value);
	panel.dispatch('update', `packages.${PACKAGE_NAME}.tinify`, event.target.value);
};

// enableSplash 复选框的事件处理函数
const handleEnableSplashChange = (event: any) => {
	panel.dispatch('update', `packages.${PACKAGE_NAME}.enableSplash`, event.target.value);
};

// skipBuild 复选框的事件处理函数
const handleSkipBuildChange = (event: any) => {
	panel.dispatch('update', `packages.${PACKAGE_NAME}.skipBuild`, event.target.value);
};

// isZip 复选框的事件处理函数
const handleIsZipChange = (event: any) => {
	panel.dispatch('update', `packages.${PACKAGE_NAME}.isZip`, event.target.value);
};

function initBaseConfig() {
	const config = getOptions();

	// 基础配置字段
	const baseFields = ['fileName', 'title', 'iosUrl', 'androidUrl', 'buildPlatform', 'tinifyApiKey'] as const;
	baseFields.forEach((field) => {
		const input: HTMLCustomElement = panel.$[field];
		// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查 input 是否存在
		input.value = config[field] ?? '';
		addEventListenerWithDispatch(input, 'confirm', field);
	});

	// 屏幕方向
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查 orientation 是否存在
	panel.$['orientation'].value = config.orientation ?? CONFIG.DEFAULT_ORIENTATION;
	addEventListenerWithDispatch(panel.$['orientation'], 'change', 'orientation');

	// 启用图片压缩
	const tinify = panel.$['tinify'];
	tinify.value = config.tinify;
	tinify.addEventListener(EVENT_TYPES.CHANGE, handleTinifyChange);
	updateTinifyKeyVisibility(config.tinify === true);

	// 启用插屏
	const enableSplash = panel.$['enableSplash'];
	enableSplash.value = config.enableSplash;
	enableSplash.addEventListener(EVENT_TYPES.CHANGE, handleEnableSplashChange);

	// 跳过构建
	const skipBuild = panel.$['skipBuild'];
	skipBuild.value = config.skipBuild;
	skipBuild.addEventListener(EVENT_TYPES.CHANGE, handleSkipBuildChange);

	// isZip 复选框
	const isZip = panel.$['isZip'];
	isZip.value = config.isZip;
	isZip.addEventListener(EVENT_TYPES.CHANGE, handleIsZipChange);
}

function updateTinifyKeyVisibility(isVisible: boolean) {
	const tinifyApiKey = panel.$['tinifyApiKey'];
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查 tinifyApiKey 是否存在
	// 但仍需检查 parentElement，因为它不是由 initPanelElements 管理的
	if (tinifyApiKey.parentElement) {
		tinifyApiKey.parentElement.style.display = isVisible ? '' : 'none';
	}
}

function initChannels() {
	const config = getOptions();
	const selectedChannels = config.exportChannels || [];

	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel];
		button.setAttribute('type', selectedChannels.includes(channel) ? 'primary' : 'default');
		button.addEventListener('click', onChannelClick);
		addChannelInputListeners(channel);
	});
}

function onChannelClick(event: any) {
	const button = event.target;
	const isSelected = button.getAttribute('type') === 'primary';

	// 切换按钮状态
	button.setAttribute('type', isSelected ? 'default' : 'primary');

	// 更新选中的渠道
	const selectedChannels = CHANNEL_OPTIONS.filter((ch) => panel.$[ch].getAttribute('type') === 'primary');

	// 使用正确的字段路径格式
	panel.dispatch('update', `packages.${PACKAGE_NAME}.exportChannels`, selectedChannels);

	// 更新注入选项区域
	updateInjectOptions();
}

function init() {
	initBaseConfig();
	initChannels();
	updateInjectOptions();
}

function updateInjectOptions() {
	const config = getOptions();

	// 更新每个渠道的配置显示状态和内容
	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel];

		// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
		const isSelected = button.getAttribute('type') === 'primary';
		getStyle(`${channel}-section`).display = isSelected ? '' : 'none';

		if (isSelected) {
			const headInput = panel.$[`${channel}-head`];
			const bodyInput = panel.$[`${channel}-body`];
			const sdkScriptInput = panel.$[`${channel}-sdkScript`];

			// 确保injectOptions存在
			const channelConfig = config.injectOptions && config.injectOptions[channel] ? config.injectOptions[channel] : { head: '', body: '', sdkScript: '' };

			// 设置输入框的值
			headInput.value = channelConfig.head || '';
			bodyInput.value = channelConfig.body || '';
			sdkScriptInput.value = channelConfig.sdkScript || '';
		}
	});
}

// 创建配置按钮的事件处理函数
const handleCreateConfigClick = async () => {
	const defaultConfig = {
		buildPlatform: CONFIG.DEFAULT_BUILD_PLATFORM,
		orientation: CONFIG.DEFAULT_ORIENTATION,
		exportChannels: [],
		injectOptions: CHANNEL_OPTIONS.reduce((acc, channel) => {
			acc[channel] = { head: '', body: '', sdkScript: '' };
			return acc;
		}, {} as Record<TChannel, TChannelRC>),
		tinify: false,
		enableSplash: false,
		skipBuild: false
	};

	// 应用默认配置
	await applyConfig(defaultConfig);
};

function initCreateButton() {
	panel.$[IDS.CREATE_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleCreateConfigClick);
}

function showConfigPanel() {
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
	getStyle(IDS.NO_CONFIG_TIP).display = 'none';
	getStyle(IDS.CONFIG_PANEL).display = '';
	getStyle(IDS.CONFIG_BUTTONS).display = '';
	getStyle(IDS.CREATE_BUTTONS).display = 'none';
}

function hideConfigPanel() {
	getStyle(IDS.NO_CONFIG_TIP).display = '';
	getStyle(IDS.CONFIG_PANEL).display = 'none';
	getStyle(IDS.CONFIG_BUTTONS).display = 'none';
	getStyle(IDS.CREATE_BUTTONS).display = '';
}

// 抽取公共的文件操作函数
async function handleFileOperation(operation: 'import' | 'export'): Promise<void> {
	const dialogConfig = getDialogConfig(operation);
	const result = await Editor.Dialog.select(dialogConfig);

	if (!result.filePaths?.[0]) {
		return;
	}

	try {
		await processFileOperation(operation, result.filePaths[0]);
		console.log(`配置已成功${operation === 'import' ? '导入' : '导出'}`);
	} catch (err: any) {
		console.error(`配置${operation === 'import' ? '导入' : '导出'}失败: ${err.message}`);
	}
}

function getDialogConfig(operation: 'import' | 'export') {
	return operation === 'import'
		? {
				title: '选择配置文件',
				type: 'file' as const,
				filters: [{ name: 'JSON', extensions: ['json'] }]
		  }
		: {
				title: '选择导出目录',
				type: 'directory' as const
		  };
}

async function processFileOperation(operation: 'import' | 'export', filePath: string) {
	if (operation === 'import') {
		await handleImport(filePath);
	} else {
		await handleExport(filePath);
	}
}

/**
 * 应用配置并更新 UI
 * @param config 配置对象
 * @param saveToFile 是否保存配置到文件，默认为 true
 */
async function applyConfig(config: TAdapterRC, saveToFile: boolean = true) {
	// 更新配置
	setOptions(config);

	// 逐个字段发送更新事件
	Object.entries(config).forEach(([key, value]) => {
		panel.dispatch('update', `packages.${PACKAGE_NAME}.${key}`, value);
	});

	// 保存配置到文件
	if (saveToFile) {
		try {
			const projectPath = Editor.Project.path;
			const configPath = `${projectPath}${ADAPTER_RC_PATH}`;
			await promises.writeFile(configPath, JSON.stringify(config, null, 2));
			console.log(`应用配置并保存到 ${configPath}`);
		} catch (err: any) {
			console.error(`保存配置文件到 ${Editor.Project.path}${ADAPTER_RC_PATH} 失败:`, err.message);
			return false;
		}
	}

	// 更新 UI
	showConfigPanel();
	initImportExport(); // 初始化配置面板按钮
	init(); // 初始化所有控件

	return true;
}

async function handleImport(filePath: string) {
	try {
		// 获取项目路径和目标配置文件路径
		const projectPath = Editor.Project.path;
		const targetPath = `${projectPath}${ADAPTER_RC_PATH}`;

		// 检查源文件是否存在
		if (!existsSync(filePath)) {
			console.error(`源文件不存在: ${filePath}`);
			return;
		}

		// 读取源文件内容，确保它是有效的 JSON
		const content = JSON.parse(await promises.readFile(filePath, 'utf8'));
		if (!content) {
			console.error(`源文件内容无效: ${filePath}`);
			return;
		}

		// 删除目标文件（如果存在）
		if (existsSync(targetPath)) {
			await promises.unlink(targetPath);
			console.log(`已删除现有配置文件: ${targetPath}`);
		}

		// 复制源文件到目标路径
		await promises.copyFile(filePath, targetPath);
		console.log(`已复制配置文件: ${filePath} -> ${targetPath}`);

		// 应用配置，但不再保存到文件（因为已经复制了文件）
		await applyConfig(content, false);
		console.log(`从 ${filePath} 导入配置并应用`);
	} catch (err: any) {
		console.error(`从 ${filePath} 导入配置失败:`, err.message);
	}
}

async function handleExport(dirPath: string) {
	const config = getOptions();
	const exportPath = `${dirPath}${ADAPTER_RC_PATH}`;
	await promises.writeFile(exportPath, JSON.stringify(config, null, 2));
	console.log(`导出配置到 ${exportPath}`);
}

// 定义事件处理函数
const handleOpenConfigClick = () => handleOpenConfig();
const handleImportClick = () => handleFileOperation('import');
const handleExportClick = () => handleFileOperation('export');
const handleImportCreateClick = () => handleFileOperation('import');

function initImportExport() {
	// 由于 initPanelElements 已确保所有元素都不为空，可以直接添加事件监听器
	// 配置面板上的按钮
	panel.$[IDS.OPEN_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleOpenConfigClick);
	panel.$[IDS.IMPORT_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleImportClick);
	panel.$[IDS.EXPORT_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleExportClick);
}

/**
 * 初始化创建面板上的按钮
 */
function initCreatePanelButtons() {
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
	// 创建面板上的导入配置按钮
	panel.$[IDS.IMPORT_CONFIG_CREATE].addEventListener(EVENT_TYPES.CLICK, handleImportCreateClick);

	// 确保配置面板按钮不可见

	getStyle(IDS.CONFIG_BUTTONS).display = 'none';

	// 确保创建面板按钮可见

	getStyle(IDS.CREATE_BUTTONS).display = '';
}

/**
 * 打开配置文件
 */
async function handleOpenConfig() {
	try {
		const projectPath = Editor.Project.path;
		const configPath = `${projectPath}${ADAPTER_RC_PATH}`;

		// 检查文件是否存在
		if (existsSync(configPath)) {
			// 使用系统默认程序打开文件
			await shell.openPath(configPath);
			console.log(`使用系统默认程序打开配置文件: ${configPath}`);
		} else {
			console.warn(`配置文件不存在: ${configPath}`);
		}
	} catch (err: any) {
		console.error(`打开配置文件失败: ${err.message}`);
	}
}

function getOptions() {
	const options = panel.options.packages[PACKAGE_NAME] || {};
	return options;
}

function setOptions(options: TAdapterRC) {
	panel.options.packages[PACKAGE_NAME] = options;
}

function getStyle(selector: string): CSSStyleDeclaration {
	const element = panel.$[selector];
	if (!element) {
		throw new Error(`元素不存在: ${selector}`);
	}
	try {
		return element.style;
	} catch (err) {
		console.error(`获取样式失败: ${selector}`, err);
		return element.style;
	}
}
