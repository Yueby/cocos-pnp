import { SKIP_ADAPTER_HOOK_ENV } from "@/extensions/constants";
import {
	initBuildFinishedEvent,
	initBuildStartEvent,
} from "@/extensions/builder";
import { logger } from "@/extensions/logger";
import type {
	IBuildResult,
	IBuildTaskOption,
} from "~types/packages/builder/@types";

const shouldSkipAdapterHook = (options?: IBuildTaskOption) =>
	process.env[SKIP_ADAPTER_HOOK_ENV] === "1" ||
	options?.packages?.["playable-ads-adapter"]?.[SKIP_ADAPTER_HOOK_ENV] === true;

export function onBeforeBuild(options: IBuildTaskOption) {
	if (shouldSkipAdapterHook(options)) {
		logger.debug("手动面板构建子进程跳过构建前适配钩子");
		return;
	}
	logger.debug("执行构建前适配钩子", options);
	return initBuildStartEvent(options);
}

export function onAfterBuild(options: IBuildTaskOption, _result: IBuildResult) {
	if (shouldSkipAdapterHook(options)) {
		logger.debug("手动面板构建子进程跳过构建后适配钩子");
		return;
	}
	logger.debug("执行构建后适配钩子", options, _result);
	return initBuildFinishedEvent(options);
}
