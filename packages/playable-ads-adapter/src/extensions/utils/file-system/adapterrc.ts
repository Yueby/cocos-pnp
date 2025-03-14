import { ADAPTER_RC_PATH } from '@/extensions/constants';
import { existsSync } from 'fs';
import { join } from 'path';
import { readToPath } from './base';

const iosTag: string = '<ios>';
const androidTag: string = '<android>';

// 基础读取配置文件的函数
export const readAdapterRCFileBase = (): TAdapterRC | null => {
	try {
		const projectRootPath = Editor.Project.path;
		const adapterRCJsonPath = `${projectRootPath}${ADAPTER_RC_PATH}`;
		const legacyAdapterRCPath = `${projectRootPath}/.adapterrc`;
		
		let configPath = '';
		if (existsSync(adapterRCJsonPath)) {
			configPath = adapterRCJsonPath;
		} else if (existsSync(legacyAdapterRCPath)) {
			configPath = legacyAdapterRCPath;
		}
		
		if (!configPath) return null;
		
		const fileContent = readToPath(configPath);
		if (!fileContent) return null;
		
		let config = <TAdapterRC>JSON.parse(fileContent);
		return config;
	} catch (error) {
		console.error('读取配置文件失败:', error);
		return null;
	}
};

// 用于构建时读取配置，会替换占位符
export const readAdapterRCFile = (): TAdapterRC | null => {
	const config = readAdapterRCFileBase();
	if (!config) return null;

	// 处理注入选项
	if (config.injectOptions) {
		for (const channel in config.injectOptions) {
			if (config.injectOptions.hasOwnProperty(channel)) {
				const typedChannel = channel as keyof typeof config.injectOptions;
				const channelConfig = config.injectOptions[typedChannel];
				if (channelConfig && channelConfig.body) {
					config.injectOptions[typedChannel].body = modifyBody(channelConfig.body, config);
				}
			}
		}
	}
	return config;
};

// 用于面板读取配置，保持占位符
export const readAdapterRCFileForPanel = (): TAdapterRC | null => {
	return readAdapterRCFileBase();
};

export const modifyBody = (body: string, config: TAdapterRC): string => {
	if (!body) return '';
	const { iosUrl = '', androidUrl = '' } = config || {};
	return body.replaceAll(iosTag, iosUrl).replaceAll(androidTag, androidUrl);
};

export const getAdapterConfig = () => {
	const projectRootPath = Editor.Project.path;
	const projectBuildPath = '/build';
	const adapterBuildConfig = readAdapterRCFile();
	let buildPlatform: TPlatform = adapterBuildConfig?.buildPlatform ?? 'web-mobile';

	return {
		projectRootPath,
		projectBuildPath,
		buildPlatform,
		originPkgPath: join(projectRootPath, projectBuildPath, buildPlatform),
		adapterBuildConfig
	};
};

export const getAdapterRCJson = (): TAdapterRC | null => {
	return readAdapterRCFile();
};

export const getChannelRCJson = (channel: TChannel): TChannelRC | null => {
	const adapterRCJson = getAdapterRCJson();
	if (!adapterRCJson || !adapterRCJson.injectOptions || !adapterRCJson.injectOptions[channel]) {
		return null;
	}

	return adapterRCJson.injectOptions[channel];
};

export const getRCSkipBuild = (): boolean => {
	const adapterRCJson = getAdapterRCJson();
	if (!adapterRCJson) {
		return false;
	}

	return adapterRCJson.skipBuild ?? false;
};

export const getRCTinify = (): { tinify: boolean; tinifyApiKey: string; } => {
	const adapterRCJson = getAdapterRCJson();
	if (!adapterRCJson) {
		return {
			tinify: false,
			tinifyApiKey: ''
		};
	}

	return {
		tinify: !!adapterRCJson.tinify,
		tinifyApiKey: adapterRCJson.tinifyApiKey || ''
	};
};

export const getChannelRCSdkScript = (channel: TChannel): string => {
	const channelRCJson = getChannelRCJson(channel);
	return !channelRCJson || !channelRCJson.sdkScript ? '' : channelRCJson.sdkScript;
};
