'use strict';

import { shell } from 'electron';
import { existsSync, promises } from 'fs';

import { buildState } from '../../extensions/builder/3x';
import { ADAPTER_RC_PATH } from '../../extensions/constants';
import { readAdapterRCFileForPanel } from '../../extensions/utils/file-system/adapterrc';
import { logger } from '../utils/logger';
import { CHANNEL_OPTIONS, CONFIG, EVENT_TYPES, IDS, SELECTORS, STYLE, TEMPLATE } from './config';
import { HTMLCustomElement, ICustomPanelThis, ITaskOptions, PACKAGE_NAME, TCustomPanelElements, TStoreConfig } from './types';

let panel: ICustomPanelThis;
let unsubscribeBuildState: (() => void) | null = null;

export const style = STYLE;
export const template = TEMPLATE;
export const $ = SELECTORS;

/**
 * 初始化构建状态监听器
 */
function initBuildStateListener() {
	unsubscribeBuildState = buildState.subscribe(({ building, error }) => {
		const mask = panel.$[IDS.BUILDING_MASK];
		if (!mask) {
			logger.error('找不到构建遮罩层元素');
			return;
		}

		if (building) {
			mask.classList.add('active');
			logger.log('构建中...');
		} else {
			mask.classList.remove('active');
			if (error) {
				logger.error('构建失败:', error);
			}
		}
	});
}

/**
 * 初始化面板UI状态
 * @param hasConfig 是否有配置文件
 */
function initPanelState(hasConfig: boolean) {
	if (hasConfig) {
		showConfigPanel();
		initConfigPanelButtons();
	} else {
		hideConfigPanel();
		initCreatePanelButtons();
	}
}

/**
 * 初始化商店配置
 * @param config 配置对象
 */
async function initStoreConfig(config: TAdapterRC) {
	if (!config.storePath) {
		return;
	}

	try {
		const storeConfig = await readStoreConfig(config.storePath);
		createStoreSection(storeConfig);
	} catch (err) {
		logger.error('初始化商店配置失败:', err);
	}
}

/**
 * 初始化面板配置
 * @param config 配置对象
 */
async function initPanelConfig(config: TAdapterRC) {
	try {
		setOptions(config);
		init();
		await initStoreConfig(config);
	} catch (err) {
		logger.error('初始化面板配置失败:', err);
	}
}

export async function ready(options: ITaskOptions) {
	try {
		// 初始化面板实例
		// @ts-ignore
		panel = this as ICustomPanelThis;
		panel.options = options;

		// 初始化构建状态监听器
		initBuildStateListener();

		// 监听语言更新消息
		Editor.Message.addBroadcastListener('update-panel-language', (lang: string) => {

			const config = getOptions();
			config.lang = lang;

			// 更新UI显示
			const langInput = panel.$['lang'];
			if (langInput) {
				langInput.value = lang;
			}

			// 保存配置
			setOptions(config);
			logger.log('面板语言已更新为:', lang);
		});

		// 读取配置文件
		const config = readAdapterRCFileForPanel();

		// 初始化面板状态
		initPanelState(!!config);

		// 如果有配置，初始化面板配置
		if (config) {
			await initPanelConfig(config);
		}
	} catch (err) {
		logger.error('面板初始化失败:', err);
	}
}

/**
 * 更新面板配置
 * @param options 任务选项
 * @param key 更新的键
 */
export async function update(options: ITaskOptions, key: string) {
	try {
		// 先应用配置到UI
		const config = options.packages[PACKAGE_NAME];
		if (config) {
			applyConfig(config);
		}

		// 然后保存到文件
		await saveConfigToFile(config);
	} catch (err: any) {
		logger.error('更新配置失败:', err.message);
	}

	if (!key) {
		init();
	}
}

/**
 * 关闭面板
 */
export function close() {
	if (!panel || !panel.$) {
		return;
	}

	try {
		// 清理构建状态监听器
		if (unsubscribeBuildState) {
			unsubscribeBuildState();
			unsubscribeBuildState = null;
		}

		// 移除根元素
		const root = panel.$.root;
		if (root) {
			root.remove();
		}

		// 清空面板的 $ 对象
		panel.$ = {} as TCustomPanelElements;
	} catch (err) {
		logger.error('关闭面板时出错:', err);
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
	const baseFields = ['fileName', 'lang', 'title', 'iosUrl', 'androidUrl', 'buildPlatform', 'tinifyApiKey'] as const;
	baseFields.forEach((field) => {
		const input: HTMLCustomElement = panel.$[field];
		// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查 input 是否存在
		input.value = config[field] ?? '';
		addEventListenerWithDispatch(input, 'confirm', field);
	});

	// 商店配置路径
	const storePath = panel.$['storePath'];
	if (storePath) {
		storePath.value = config.storePath ?? '';
		storePath.addEventListener(EVENT_TYPES.CHANGE, async (event: any) => {
			const path = event.target.value;
			// 更新配置
			panel.dispatch('update', `packages.${PACKAGE_NAME}.storePath`, path);

			// 如果路径存在，读取并更新商店配置
			if (path) {
				try {
					const storeConfig = await readStoreConfig(path);
					createStoreSection(storeConfig);
				} catch (err) {
					logger.error('处理商店配置失败:', err);
				}
			} else {
				// 如果路径为空，清空商店配置区域
				createStoreSection([]);
			}
		});
	}

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

/**
 * 移除对象中的空值
 * @param obj 要处理的对象
 * @returns 处理后的对象
 */
function removeEmptyValues(obj: any): any {
	if (obj === null || obj === undefined) {
		return undefined;
	}

	if (Array.isArray(obj)) {
		const filteredArray = obj.filter((item) => item !== null && item !== undefined && item !== '' && item !== 'undefined');
		return filteredArray.length > 0 ? filteredArray.map((item) => removeEmptyValues(item)) : undefined;
	}

	if (typeof obj === 'object') {
		const result: any = {};
		let hasValidValues = false;

		for (const key in obj) {
			const value = removeEmptyValues(obj[key]);
			if (value !== undefined) {
				result[key] = value;
				hasValidValues = true;
			}
		}

		return hasValidValues ? result : undefined;
	}

	// 处理字符串类型
	if (typeof obj === 'string') {
		return obj === '' || obj === 'undefined' ? undefined : obj;
	}

	return obj;
}

/**
 * 保存配置到文件
 * @param config 任务选项
 */
async function saveConfigToFile(config: TAdapterRC) {
	const projectPath = Editor.Project.path;
	const configPath = `${projectPath}${ADAPTER_RC_PATH}`;

	try {
		config = removeEmptyValues(config);
		// 转换为JSON字符串
		const configStr = JSON.stringify(config, null, 2);

		// 验证JSON格式
		JSON.parse(configStr);

		// 完整替换文件内容
		await promises.writeFile(configPath, configStr, { encoding: 'utf8', flag: 'w' });
		logger.log(`配置已保存到 ${configPath}`);
	} catch (err) {
		logger.error('保存配置失败:', err);
		throw new Error('配置格式无效，无法保存');
	}
}

/**
 * 获取配置选项
 */
function getOptions() {
	const options = panel.options.packages[PACKAGE_NAME] || {};
	return options;
}

/**
 * 设置配置选项
 * @param options 配置选项
 */
function setOptions(options: TAdapterRC) {
	panel.options.packages[PACKAGE_NAME] = options;
	panel.dispatch('update', `packages.${PACKAGE_NAME}`, options);
}

/**
 * 创建默认的注入选项
 */
function createDefaultInjectOptions(): Record<TChannel, TChannelRC> {
	return CHANNEL_OPTIONS.reduce((acc, channel) => {
		acc[channel] = {
			head: '',
			body: '',
			sdkScript: ''
		};
		return acc;
	}, {} as Record<TChannel, TChannelRC>);
}

/**
 * 创建默认配置
 */
function createDefaultConfig(): TAdapterRC {
	return {
		buildPlatform: CONFIG.DEFAULT_BUILD_PLATFORM,
		orientation: CONFIG.DEFAULT_ORIENTATION,
		exportChannels: [],
		injectOptions: createDefaultInjectOptions(),
		fileName: '',
		lang: '',
		title: '',
		iosUrl: '',
		androidUrl: '',
		tinify: false,
		tinifyApiKey: '',
		enableSplash: false,
		skipBuild: false,
		isZip: false
	};
}

/**
 * 应用配置到UI
 * @param config 配置对象
 */
function applyConfig(config: TAdapterRC) {
	try {
		// 更新配置
		setOptions(config);

		// 更新 UI
		showConfigPanel();
		initConfigPanelButtons();
		init();

		return true;
	} catch (err: any) {
		logger.error(`${err.message}`);
		return false;
	}
}

// 修改创建配置按钮的处理函数
const handleCreateConfigClick = async () => {
	try {
		const defaultConfig = createDefaultConfig();
		const projectPath = Editor.Project.path;
		const configPath = `${projectPath}${ADAPTER_RC_PATH}`;

		// 先应用默认配置到UI
		applyConfig(defaultConfig);

		// 完整替换文件内容
		await promises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), { encoding: 'utf8', flag: 'w' });
		logger.log('成功创建并保存默认配置');
	} catch (err: any) {
		logger.error('创建配置文件失败:', err.message);
	}
};

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
		logger.log(`配置已成功${operation === 'import' ? '导入' : '导出'}`);
	} catch (err: any) {
		logger.error(`配置${operation === 'import' ? '导入' : '导出'}失败: ${err.message}`);
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

async function handleImport(filePath: string) {
	try {
		// 检查源文件是否存在
		if (!existsSync(filePath)) {
			logger.error(`源文件不存在: ${filePath}`);
			return;
		}

		// 读取源文件内容
		const content = await promises.readFile(filePath, 'utf8');
		let config: TAdapterRC;

		try {
			config = JSON.parse(content);
		} catch (err) {
			logger.error('配置文件格式无效，请确保是有效的 JSON 格式');
			return;
		}

		// 获取目标路径
		// const projectPath = Editor.Project.path;
		// const targetPath = `${projectPath}${ADAPTER_RC_PATH}`;

		applyConfig(config);
	} catch (err: any) {
		logger.error(`导入配置失败: ${err.message}`);
	}
}

async function handleExport(dirPath: string) {
	try {
		const config = getOptions();
		const exportPath = `${dirPath}${ADAPTER_RC_PATH}`;

		// 转换为JSON字符串
		const configStr = JSON.stringify(config, null, 2);

		// 完整替换文件内容
		await promises.writeFile(exportPath, configStr, { encoding: 'utf8', flag: 'w' });
		logger.log(`配置已导出到 ${exportPath}`);
	} catch (err: any) {
		logger.error(`导出配置失败: ${err.message}`);
	}
}

// 定义事件处理函数
const handleOpenConfigClick = () => handleOpenConfig();
const handleImportClick = () => handleFileOperation('import');
const handleExportClick = () => handleFileOperation('export');
const handleImportCreateClick = () => handleFileOperation('import');
const handleBuildClick = () => handleBuild();
function initConfigPanelButtons() {
	// 由于 initPanelElements 已确保所有元素都不为空，可以直接添加事件监听器
	// 配置面板上的按钮
	panel.$[IDS.OPEN_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleOpenConfigClick);
	panel.$[IDS.IMPORT_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleImportClick);
	panel.$[IDS.EXPORT_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleExportClick);
	panel.$[IDS.BUILD].addEventListener(EVENT_TYPES.CLICK, handleBuildClick);
}

/**
 * 初始化创建面板上的按钮
 */
function initCreatePanelButtons() {
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
	// 创建面板上的导入配置按钮
	panel.$[IDS.IMPORT_CONFIG_CREATE].addEventListener(EVENT_TYPES.CLICK, handleImportCreateClick);
	panel.$[IDS.CREATE_CONFIG].addEventListener(EVENT_TYPES.CLICK, handleCreateConfigClick);

	// 确保配置面板按钮不可见

	getStyle(IDS.CONFIG_BUTTONS).display = 'none';

	// 确保创建面板按钮可见
	getStyle(IDS.CREATE_BUTTONS).display = '';
}

function handleBuild() {
	if (buildState.building) {
		return;
	}
	Editor.Message.send(PACKAGE_NAME, 'adapter-build');
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
			logger.log(`使用系统默认程序打开配置文件: ${configPath}`);
		} else {
			logger.warn(`配置文件不存在: ${configPath}`);
		}
	} catch (err: any) {
		logger.error(`打开配置文件失败: ${err.message}`);
	}
}

function getStyle(selector: string): CSSStyleDeclaration {
	const element = panel.$[selector];
	if (!element) {
		throw new Error(`元素不存在: ${selector}`);
	}
	try {
		return element.style;
	} catch (err) {
		logger.error(`获取样式失败: ${selector}`, err);
		return element.style;
	}
}

// 添加读取商店配置的函数
async function readStoreConfig(storePath: string): Promise<TStoreConfig> {
	try {
		const content = await promises.readFile(storePath, 'utf8');
		return JSON.parse(content);
	} catch (err) {
		logger.error('读取商店配置失败:', err);
		return [];
	}
}

// 修改创建商店配置区域的函数
function createStoreSection(storeConfig: TStoreConfig) {
	const container = panel.$[IDS.STORE_CONTAINER];
	if (!container || !(container instanceof HTMLElement)) {
		logger.error('商店配置容器无效或不是 HTMLElement');
		return;
	}

	// 获取 ui-file 元素
	const storePathElement = panel.$['storePath'];
	if (!storePathElement || !(storePathElement instanceof HTMLElement)) {
		logger.error('商店配置路径输入框无效或不是 HTMLElement');
		return;
	}

	// 清除除了 ui-file 以外的所有内容
	Array.from(container.children).forEach((child) => {
		if (child !== storePathElement && child.id !== 'storePath') {
			container.removeChild(child);
		}
	});

	// 如果没有配置，直接返回
	if (!Array.isArray(storeConfig) || storeConfig.length === 0) {
		logger.log('没有商店配置数据');
		return;
	}

	try {
		storeConfig.forEach((store) => {
			if (!store || typeof store !== 'object') {
				logger.warn('无效的商店配置项:', store);
				return;
			}

			// 创建商店配置组
			const storeSection = document.createElement('ui-section');
			storeSection.setAttribute('header', store.name || '未命名商店');

			// 创建iOS URL部分
			const iosProps = document.createElement('ui-prop');
			const iosLabel = document.createElement('ui-label');
			iosLabel.setAttribute('slot', 'label');
			iosLabel.setAttribute('value', 'iOS URL');
			const iosInput = document.createElement('ui-input');
			iosInput.setAttribute('slot', 'content');
			iosInput.setAttribute('value', store.ios || '');
			iosInput.setAttribute('readonly', '');
			iosProps.appendChild(iosLabel);
			iosProps.appendChild(iosInput);
			storeSection.appendChild(iosProps);

			// 创建Android URL部分
			const androidProps = document.createElement('ui-prop');
			const androidLabel = document.createElement('ui-label');
			androidLabel.setAttribute('slot', 'label');
			androidLabel.setAttribute('value', 'Android URL');
			const androidInput = document.createElement('ui-input');
			androidInput.setAttribute('slot', 'content');
			androidInput.setAttribute('value', store.android || '');
			androidInput.setAttribute('readonly', '');
			androidProps.appendChild(androidLabel);
			androidProps.appendChild(androidInput);
			storeSection.appendChild(androidProps);

			// 创建应用按钮容器
			const buttonContainer = document.createElement('div');
			buttonContainer.style.textAlign = 'right';
			buttonContainer.style.marginTop = '4px';

			// 创建应用按钮
			const applyButton = document.createElement('ui-button');
			applyButton.textContent = '应用';
			applyButton.addEventListener(EVENT_TYPES.CLICK, async () => {
				const options = getOptions();
				options.iosUrl = store.ios || '';
				options.androidUrl = store.android || '';
				panel.dispatch('update', `packages.${PACKAGE_NAME}`, options);
			});

			buttonContainer.appendChild(applyButton);
			storeSection.appendChild(buttonContainer);

			container.appendChild(storeSection);
		});
	} catch (err) {
		logger.error('创建商店配置区域时出错:', err);
	}
}
