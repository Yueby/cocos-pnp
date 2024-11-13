import { ADAPTER_RC_PATH } from '@/extensions/constants';
import { existsSync } from 'fs';
import { join } from 'path';
import { readToPath } from './base';

const iosTag: string = '<ios>';
const androidTag: string = '<android>';

export const readAdapterRCFile = (): TAdapterRC | null => {
	const projectRootPath = Editor.Project.path;
	const adapterRCJsonPath = `${projectRootPath}${ADAPTER_RC_PATH}`;
	if (existsSync(adapterRCJsonPath)) {
		let config = <TAdapterRC>JSON.parse(readToPath(adapterRCJsonPath));

		if (config.injectOptions) {
			for (const channel in config.injectOptions) {
				if (config.injectOptions.hasOwnProperty(channel)) {
					const typedChannel = channel as keyof typeof config.injectOptions;
					config.injectOptions[typedChannel].body = modifyBody(config.injectOptions[typedChannel].body, config);
				}
			}
		}
		return config;
	}

	return null;
};

const modifyBody = (body: string, config: TAdapterRC): string => {
	const { iosUrl, androidUrl } = config || {};
	return body.replaceAll(iosTag, iosUrl!).replaceAll(androidTag, androidUrl!);
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
