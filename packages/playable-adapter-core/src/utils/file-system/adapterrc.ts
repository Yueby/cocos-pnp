import path from "path";
import type { TAdapterRC, TChannel, TChannelRC } from "@/typings";
import { getGlobalBuildConfig, getGlobalProjectBuildPath } from "@/global";

export const getAdapterRCJson = (): TAdapterRC | null => {
	return getGlobalBuildConfig();
};

export const getOriginPkgPath = () => {
	const configJson: Partial<TAdapterRC> = getAdapterRCJson() || {};
	const buildPlatform = configJson.buildPlatform || "web-mobile";

	return path.join(getGlobalProjectBuildPath(), buildPlatform!);
};

export const getChannelRCJson = (channel: TChannel): TChannelRC | null => {
	const adapterRCJson = getAdapterRCJson();
	if (
		!adapterRCJson ||
		!adapterRCJson.injectOptions ||
		!adapterRCJson.injectOptions[channel]
	) {
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

export const getRCCompress = (): {
	enable: boolean;
	quality: number;
	skipUuids: string[];
	concurrency: number;
} => {
	const adapterRCJson = getAdapterRCJson();
	if (!adapterRCJson) {
		return {
			enable: false,
			quality: 60,
			skipUuids: [],
			concurrency: require("os").cpus().length,
		};
	}

	return {
		enable: !!adapterRCJson?.compress?.enable,
		quality: adapterRCJson?.compress?.quality ?? 60,
		skipUuids: adapterRCJson?.compress?.skipUuids ?? [],
		concurrency:
			adapterRCJson?.compress?.concurrency ?? require("os").cpus().length,
	};
};

export const getChannelRCSdkScript = (channel: TChannel): string => {
	const channelRCJson = getChannelRCJson(channel);

	return !channelRCJson || !channelRCJson.sdkScript
		? ""
		: channelRCJson.sdkScript;
};
