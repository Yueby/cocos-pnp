'use strict';

import { ICustomPanelThis, ITaskOptions } from '../@types';
import { name as PACKAGE_NAME } from '../package.json';
import { ADAPTER_RC_PATH } from './extensions/constants';
import { readAdapterRCFile } from './extensions/utils/file-system/adapterrc';

let panel: ICustomPanelThis;

const CHANNEL_OPTIONS: TChannel[] = ['AppLovin', 'Facebook', 'Google', 'IronSource', 'Liftoff', 'Mintegral', 'Moloco', 'Pangle', 'Rubeex', 'Tiktok', 'Unity'];

const ORIENTATIONS: string[] = ['auto', 'portrait', 'landscape'];

// 配置常量
const CONFIG = {
	DEFAULT_BUILD_PLATFORM: 'web-mobile',
	DEFAULT_ORIENTATION: 'auto',
	INJECT_FIELDS: ['head', 'body', 'sdkScript'] as const
} as const;

export const style = `
    .channel-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 8px 0;
    }
    .channel-list ui-button {
        min-width: 80px;
    }
    .section-header {
        padding: 12px 0;
        font-size: 14px;
        font-weight: bold;
        border-bottom: 1px solid var(--color-border);
    }
`;

export const template = `
<div class="adapter-panel">
    <div style="text-align: right; margin-bottom: 12px;">
        <ui-button id="importConfig">导入配置</ui-button>
        <ui-button id="exportConfig">导出配置</ui-button>
    </div>
    <div id="noConfigTip" style="display: none;">
        <div style="text-align: center; padding: 20px;">
            <div style="margin-bottom: 12px;">未检测到配置文件，请先创建配置</div>
            <ui-button id="createConfig">创建配置</ui-button>
        </div>
    </div>
    <div id="configPanel">
        <!-- 基础配置 -->
        <ui-prop>
            <ui-label slot="label" value="文件名"></ui-label>
            <ui-input slot="content" id="fileName"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="标题"></ui-label>
            <ui-input slot="content" id="titleName"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="iOS URL"></ui-label>
            <ui-input slot="content" id="iosUrl"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="Android URL"></ui-label>
            <ui-input slot="content" id="androidUrl"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="构建平台"></ui-label>
            <ui-input slot="content" id="buildPlatform" value="web-mobile"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="屏幕方向"></ui-label>
            <ui-select slot="content" id="orientation" value="auto">
                ${ORIENTATIONS.map((o) => `<option value="${o}">${o}</option>`).join('')}
            </ui-select>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="启用图片压缩"></ui-label>
            <ui-checkbox slot="content" id="tinify"></ui-checkbox>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="压缩API Key"></ui-label>
            <ui-input slot="content" id="tinifyApiKey"></ui-input>
        </ui-prop>

        <div class="section-header">导出渠道配置</div>
        <div id="channelContainer" class="channel-list">
            ${CHANNEL_OPTIONS.map(
				(channel) => `
                <ui-button id="${channel}" class="small" type="default">${channel}</ui-button>
            `
			).join('')}
        </div>

        <div class="section-header">注入选项配置</div>
        <div id="injectOptionsContainer">
            ${CHANNEL_OPTIONS.map(
				(channel) => `
                <ui-section id="${channel}-section" header="${channel} 配置" style="display: none;">
                    <ui-prop>
                        <ui-label slot="label" value="head"></ui-label>
                        <ui-textarea slot="content" id="${channel}-head" placeholder="输入 head 注入内容"></ui-textarea>
                    </ui-prop>
                    <ui-prop>
                        <ui-label slot="label" value="body"></ui-label>
                        <ui-textarea slot="content" id="${channel}-body" placeholder="输入 body 注入内容"></ui-textarea>
                    </ui-prop>
                    <ui-prop>
                        <ui-label slot="label" value="sdkScript"></ui-label>
                        <ui-textarea slot="content" id="${channel}-sdkScript" placeholder="输入 SDK 脚本注入内容"></ui-textarea>
                    </ui-prop>
                </ui-section>
            `
			).join('')}
        </div>
    </div>
</div>
`;

export const $ = {
	noConfigTip: '#noConfigTip',
	configPanel: '#configPanel',
	createConfig: '#createConfig',
	importConfig: '#importConfig',
	exportConfig: '#exportConfig',
	fileName: '#fileName',
	titleName: '#titleName',
	iosUrl: '#iosUrl',
	androidUrl: '#androidUrl',
	buildPlatform: '#buildPlatform',
	orientation: '#orientation',
	tinify: '#tinify',
	tinifyApiKey: '#tinifyApiKey',
	...CHANNEL_OPTIONS.reduce(
		(acc, channel) => ({
			...acc,
			[channel]: `#${channel}`,
			[`${channel}-section`]: `#${channel}-section`,
			[`${channel}-head`]: `#${channel}-head`,
			[`${channel}-body`]: `#${channel}-body`,
			[`${channel}-sdkScript`]: `#${channel}-sdkScript`
		}),
		{}
	)
};

/**
 * all change of options dispatched will enter here
 * @param options
 * @param key
 * @returns
 */
export async function update(options: ITaskOptions, key: string) {
	try {
		await saveConfigToFile(options);
		console.log('配置文件已更新');
	} catch (err: any) {
		console.error('配置文件更新失败:', err.message);
	}

	if (!key) {
		init();
		return;
	}
}

async function saveConfigToFile(options: ITaskOptions) {
	const fs = require('fs');
	const projectPath = Editor.Project.path;
	const configPath = `${projectPath}${ADAPTER_RC_PATH}`;
	// 直接使用内存中的配置
	const config = options.packages[PACKAGE_NAME as keyof typeof options.packages];
	await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}

export function ready(options: ITaskOptions) {
	// @ts-ignore
	panel = this as ICustomPanelThis;
	panel.options = options;

	// 读取配置文件
	const config = readAdapterRCFile();
	if (config) {
		// 直接使用读取到的配置
		panel.options.packages[PACKAGE_NAME] = config;
		showConfigPanel();
		init();
	} else {
		hideConfigPanel();
		initCreateButton();
	}
}

export function close() {
	// 移除渠道按钮的事件监听
	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel as string];
		if (button) {
			button.removeEventListener('click', onChannelClick);
		}
	});

	// 移除 tinify 复选框的事件监听
	panel.$.tinify.removeEventListener('change');

	console.log('close');
}

// 工具函数
function addEventListenerWithDispatch(element: any, eventType: string, field: string) {
	element.addEventListener(eventType, (event: any) => {
		// 使用正确的字段路径格式
		panel.dispatch('update', `packages.${PACKAGE_NAME}.${field}`, event.target.value);
	});
}

function addChannelInputListeners(channel: TChannel) {
	CONFIG.INJECT_FIELDS.forEach(field => {
		const input = panel.$[`${channel}-${field}`];
		addEventListenerWithDispatch(input, 'confirm', `injectOptions.${channel}.${field}`);
	});
}

function initBaseConfig() {
	const config = panel.options.packages[PACKAGE_NAME] as TAdapterRC;
	
	// 基础配置字段
	const baseFields = ['fileName', 'titleName', 'iosUrl', 'androidUrl', 'buildPlatform'] as const;
	baseFields.forEach(field => {
		const input = panel.$[field];
		// 设置初始值
		input.value = config[field] ?? '';
		// 添加事件监听
		addEventListenerWithDispatch(input, 'confirm', field);
	});

	// 屏幕方向
	panel.$.orientation.value = config.orientation ?? CONFIG.DEFAULT_ORIENTATION;
	addEventListenerWithDispatch(panel.$.orientation, 'change', 'orientation');
	
	// tinify 相关配置
	panel.$.tinify.value = config.tinify ?? false;
	panel.$.tinifyApiKey.value = config.tinifyApiKey ?? '';
	
	// 根据启用状态控制 API Key 输入框的显示
	updateTinifyKeyVisibility(panel.$.tinify.value);
	
	// tinify 复选框事件
	panel.$.tinify.addEventListener('change', (event: any) => {
		updateTinifyKeyVisibility(event.target.value);
		panel.dispatch('update', `packages.${PACKAGE_NAME}.tinify`, event.target.value);
	});

	addEventListenerWithDispatch(panel.$.tinifyApiKey, 'confirm', 'tinifyApiKey');
}

function updateTinifyKeyVisibility(isVisible: boolean) {
	panel.$.tinifyApiKey.parentElement!.style.display = isVisible ? '' : 'none';
}

function initChannels() {
	const config = panel.options.packages[PACKAGE_NAME];
	const selectedChannels = config.exportChannels;

	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel];
		if (button) {
			button.setAttribute('type', selectedChannels.includes(channel) ? 'primary' : 'default');
			button.addEventListener('click', onChannelClick);
		}
		addChannelInputListeners(channel);
	});
}

function onChannelClick(event: any) {
	const button = event.target;
	const isSelected = button.getAttribute('type') === 'primary';
	
	// 切换按钮状态
	button.setAttribute('type', isSelected ? 'default' : 'primary');
	
	// 更新选中的渠道
	const selectedChannels = CHANNEL_OPTIONS.filter(ch => 
		panel.$[ch].getAttribute('type') === 'primary'
	);
	
	// 使用正确的字段路径格式
	panel.dispatch('update', `packages.${PACKAGE_NAME}.exportChannels`, selectedChannels);
	
	// 更新注入选项区域
	updateInjectOptions();
}

function init() {
	initBaseConfig();
	initChannels();
	updateInjectOptions();
	initImportExport();
}

function updateInjectOptions() {
	const config = panel.options.packages[PACKAGE_NAME];

	// 更新每个渠道的配置显示状态和内容
	CHANNEL_OPTIONS.forEach((channel) => {
		const section = panel.$[`${channel}-section`];
		const isSelected = panel.$[channel].getAttribute('type') === 'primary';

		// 更新显示状态
		section.style.display = isSelected ? '' : 'none';

		if (isSelected && config.injectOptions?.[channel]) {
			const channelConfig = config.injectOptions[channel];

			// 更新各输入框的值
			panel.$[`${channel}-head`].value = channelConfig.head;
			panel.$[`${channel}-body`].value = channelConfig.body;
			panel.$[`${channel}-sdkScript`].value = channelConfig.sdkScript;
		}
	});
}

function initCreateButton() {
	panel.$.createConfig.addEventListener('click', () => {
		const defaultConfig = {
			buildPlatform: CONFIG.DEFAULT_BUILD_PLATFORM,
			orientation: CONFIG.DEFAULT_ORIENTATION,
			exportChannels: [],
			injectOptions: {},
			tinify: false
		};
		
		// 更新配置
		panel.options.packages[PACKAGE_NAME] = defaultConfig;
		
		// 逐个字段发送更新事件
		Object.entries(defaultConfig).forEach(([key, value]) => {
			panel.dispatch('update', `packages.${PACKAGE_NAME}.${key}`, value);
		});
		
		showConfigPanel();
		init();
	});
}

function showConfigPanel() {
	panel.$.noConfigTip.style.display = 'none';
	panel.$.configPanel.style.display = '';
}

function hideConfigPanel() {
	panel.$.noConfigTip.style.display = '';
	panel.$.configPanel.style.display = 'none';
}

// 抽取公共的文件操作函数
async function handleFileOperation(operation: 'import' | 'export'): Promise<void> {
	const dialogConfig = getDialogConfig(operation);
	const result = await Editor.Dialog.select(dialogConfig);

	if (!result.filePaths?.[0]) return;

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
	const fs = require('fs');
	if (operation === 'import') {
		await handleImport(fs, filePath);
	} else {
		await handleExport(fs, filePath);
	}
}

async function handleImport(fs: any, filePath: string) {
	const content = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
	if (content) {
		const projectPath = Editor.Project.path;
		const configPath = `${projectPath}${ADAPTER_RC_PATH}`;
		
		// 更新配置
		panel.options.packages[PACKAGE_NAME] = content;
		
		// 逐个字段发送更新事件
		Object.entries(content).forEach(([key, value]) => {
			panel.dispatch('update', `packages.${PACKAGE_NAME}.${key}`, value);
		});
		
		await fs.promises.writeFile(configPath, JSON.stringify(content, null, 2));
		showConfigPanel();
		init();
	}
}

async function handleExport(fs: any, dirPath: string) {
	const config = panel.options.packages[PACKAGE_NAME];
	const exportPath = `${dirPath}${ADAPTER_RC_PATH}`;
	await fs.promises.writeFile(exportPath, JSON.stringify(config, null, 2));
}

function initImportExport() {
	// 导入配置
	panel.$.importConfig.addEventListener('click', () => handleFileOperation('import'));

	// 导出配置
	panel.$.exportConfig.addEventListener('click', () => handleFileOperation('export'));
}
