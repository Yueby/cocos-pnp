import { shell } from "electron";
import { existsSync, promises } from "fs";

import { ADAPTER_RC_PATH } from "../../extensions/constants";
import { readAdapterRCFileForPanel } from "../../extensions/utils/file-system/adapterrc";
import { logger } from "../utils/logger";
import {
	CHANNEL_OPTIONS,
	CHANNEL_TIPS,
	CONFIG,
	DEFAULT_TIP,
	EVENT_TYPES,
	IDS,
	SELECTORS,
	STYLE,
	TEMPLATE,
} from "./config";
import {
	type HTMLCustomElement,
	type ICustomPanelThis,
	type ITaskOptions,
	PACKAGE_NAME,
	type TCustomPanelElements,
	type TStoreConfig,
} from "./types";

let panel: ICustomPanelThis;
let unsubscribeBuildState: (() => void) | null = null;
let _eventsInitialized = false;
let _buildStateHandler:
	| ((state: { building: boolean; error?: string }) => void)
	| null = null;
let _updateLanguageHandler: ((lang: string) => void) | null = null;
let isBuilding = false;
let currentBuildTaskId: string | undefined;

const DEFAULT_COMPRESS_QUALITY = 60;

export const style = STYLE;
export const template = TEMPLATE;
export const $ = SELECTORS;

/**
 * 初始化构建状态监听器
 */
function applyBuildState(state: {
	building: boolean;
	taskId?: string;
	error?: string;
}) {
	const { building, taskId, error } = state;
	const stateChanged = isBuilding !== building || currentBuildTaskId !== taskId;
	isBuilding = building;
	currentBuildTaskId = taskId;
	const mask = panel.$[IDS.BUILDING_MASK];
	if (!mask) {
		logger.error("找不到构建遮罩层元素");
		return;
	}

	if (building) {
		mask.classList.add("active");
		if (stateChanged) {
			logger.log("构建中...");
		}
	} else {
		mask.classList.remove("active");
		if (error) {
			logger.error("构建失败:", error);
		}
	}
}

async function syncBuildState() {
	try {
		const state = await Editor.Message.request(
			PACKAGE_NAME,
			"query-build-state",
		);
		applyBuildState(
			state as { building: boolean; taskId?: string; error?: string },
		);
	} catch (error) {
		logger.warn("同步构建状态失败:", error);
	}
}

function initBuildStateListener() {
	_buildStateHandler = (state) => {
		applyBuildState(state);
	};
	Editor.Message.addBroadcastListener(
		"adapter:build-state",
		_buildStateHandler,
	);
	unsubscribeBuildState = () => {
		if (_buildStateHandler) {
			Editor.Message.removeBroadcastListener(
				"adapter:build-state",
				_buildStateHandler,
			);
			_buildStateHandler = null;
		}
	};
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
		logger.error("初始化商店配置失败:", err);
	}
}

/**
 * 初始化面板配置
 * @param config 配置对象
 */
async function initPanelConfig(config: TAdapterRC) {
	try {
		setOptions(config);
		await init();
		await initStoreConfig(config);
	} catch (err) {
		logger.error("初始化面板配置失败:", err);
	}
}

export async function ready(options: ITaskOptions) {
	try {
		// 初始化面板实例
		// @ts-expect-error
		panel = this as ICustomPanelThis;
		panel.options = options;

		// 初始化构建状态监听器
		initBuildStateListener();
		await syncBuildState();

		_updateLanguageHandler = (lang: string) => {
			const config = getOptions();
			config.lang = lang;

			const langInput = panel.$["lang"];
			if (langInput) {
				langInput.value = lang;
			}

			setOptions(config);
			logger.log("面板语言已更新为:", lang);
		};
		Editor.Message.addBroadcastListener(
			"update-panel-language",
			_updateLanguageHandler,
		);

		// 读取配置文件
		const config = readAdapterRCFileForPanel();

		// 初始化面板状态
		initPanelState(!!config);

		// 如果有配置，初始化面板配置
		if (config) {
			await initPanelConfig(config);
		}
	} catch (err) {
		logger.error("面板初始化失败:", err);
	}
}

/**
 * 更新面板配置
 * @param options 任务选项
 * @param key 更新的键
 */
export async function update(options: ITaskOptions, key: string) {
	try {
		const config = options.packages[PACKAGE_NAME];
		if (config) {
			await applyConfig(config);
			await saveConfigToFile(config);
		} else {
			if (!key) {
				await init();
			} else {
				logger.warn(`update() 收到 key "${key}" 但 config 不存在，已忽略`);
			}
		}
	} catch (err: any) {
		logger.error("更新配置失败:", err.message);
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
		_eventsInitialized = false;

		if (unsubscribeBuildState) {
			unsubscribeBuildState();
			unsubscribeBuildState = null;
		}

		if (_updateLanguageHandler) {
			Editor.Message.removeBroadcastListener(
				"update-panel-language",
				_updateLanguageHandler,
			);
			_updateLanguageHandler = null;
		}

		// 移除根元素
		const root = panel.$.root;
		if (root) {
			root.remove();
		}

		// 清空面板的 $ 对象
		panel.$ = {} as TCustomPanelElements;
	} catch (err) {
		logger.error("关闭面板时出错:", err);
	}
}

// 工具函数
function addEventListenerWithDispatch(
	element: any,
	eventType: string,
	field: string,
) {
	element.addEventListener(eventType, (event: any) => {
		// 使用正确的字段路径格式
		panel.dispatch(
			"update",
			`packages.${PACKAGE_NAME}.${field}`,
			event.target.value,
		);
	});
}

function addChannelInputListeners(channel: TChannel) {
	CONFIG.INJECT_FIELDS.forEach((field) => {
		const input = panel.$[`${channel}-${field}`];
		if (input) {
			addEventListenerWithDispatch(
				input,
				"confirm",
				`injectOptions.${channel}.${field}`,
			);
		}
	});
}

function normalizeQuality(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_COMPRESS_QUALITY;
	}
	return Math.min(100, Math.max(1, Math.round(parsed)));
}

type TCompressFormState = {
	enable: boolean;
	quality: number;
	skipUuids: string[];
	concurrency?: number;
};

function ensureCompressConfig(config: TAdapterRC): TCompressFormState {
	const normalized: TCompressFormState = {
		enable: !!config.compress?.enable,
		quality: normalizeQuality(
			config.compress?.quality ?? DEFAULT_COMPRESS_QUALITY,
		),
		skipUuids: config.compress?.skipUuids ?? [],
	};
	if (config.compress?.concurrency && config.compress.concurrency > 0) {
		normalized.concurrency = config.compress.concurrency;
	}
	config.compress = normalized;
	return normalized;
}

function updateCompressVisibility(isVisible: boolean) {
	const subsection = panel.$[IDS.COMPRESS_SUBSECTION];
	if (subsection) {
		subsection.style.display = isVisible ? "" : "none";
	}
}

// compress 复选框的事件处理函数
const handleCompressEnableChange = (event: any) => {
	const config = getOptions();
	const compress = ensureCompressConfig(config);
	compress.enable = event.target.value === true;
	config.compress = compress;
	updateCompressVisibility(compress.enable);
	panel.options.packages[PACKAGE_NAME] = config;
	panel.dispatch("update", `packages.${PACKAGE_NAME}.compress`, compress);
	saveConfigToFile(config).catch((err: any) => {
		logger.error("保存压缩配置失败:", err.message);
	});
};

const handleCompressQualityChange = (event: any) => {
	const rawValue = event?.target?.value ?? event?.detail?.value;
	const quality = normalizeQuality(rawValue);

	const config = getOptions();
	const compress = ensureCompressConfig(config);
	compress.quality = quality;
	config.compress = compress;

	const slider = panel.$[IDS.COMPRESS_QUALITY];
	if (slider) {
		slider.value = quality;
		slider.setAttribute("value", String(quality));
	}

	panel.options.packages[PACKAGE_NAME] = config;
	panel.dispatch("update", `packages.${PACKAGE_NAME}.compress`, compress);
	saveConfigToFile(config).catch((err: any) => {
		logger.error("保存压缩质量失败:", err.message);
	});
};

const handleCompressConcurrencyChange = (event: any) => {
	const rawValue = event?.target?.value ?? event?.detail?.value;
	const parsed = Number(rawValue);
	const concurrency =
		Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;

	const config = getOptions();
	const compress = ensureCompressConfig(config);
	if (concurrency) {
		compress.concurrency = concurrency;
	} else {
		delete compress.concurrency;
	}
	config.compress = compress;
	panel.options.packages[PACKAGE_NAME] = config;
	panel.dispatch("update", `packages.${PACKAGE_NAME}.compress`, compress);
	saveConfigToFile(config).catch((err: any) => {
		logger.error("保存压缩并发数失败:", err.message);
	});
};

// enableSplash 复选框的事件处理函数
const handleEnableSplashChange = (event: any) => {
	panel.dispatch(
		"update",
		`packages.${PACKAGE_NAME}.enableSplash`,
		event.target.value,
	);
};

// skipBuild 复选框的事件处理函数
const handleSkipBuildChange = (event: any) => {
	panel.dispatch(
		"update",
		`packages.${PACKAGE_NAME}.skipBuild`,
		event.target.value,
	);
};

// isZip 复选框的事件处理函数
const handleIsZipChange = (event: any) => {
	panel.dispatch(
		"update",
		`packages.${PACKAGE_NAME}.isZip`,
		event.target.value,
	);
};

async function initBaseConfig() {
	const config = getOptions();

	// 基础配置字段
	const baseFields = [
		"fileName",
		"lang",
		"title",
		"iosUrl",
		"androidUrl",
		"buildPlatform",
	] as const;
	baseFields.forEach((field) => {
		const input: HTMLCustomElement = panel.$[field];
		input.value = config[field] ?? "";
		if (!_eventsInitialized) {
			addEventListenerWithDispatch(input, "confirm", field);
		}
	});

	// 商店配置路径
	const storePath = panel.$["storePath"];
	if (storePath) {
		storePath.value = config.storePath ?? "";
		if (!_eventsInitialized) {
			storePath.addEventListener(EVENT_TYPES.CHANGE, async (event: any) => {
				const path = event.target.value;
				panel.dispatch("update", `packages.${PACKAGE_NAME}.storePath`, path);

				if (path) {
					try {
						const storeConfig = await readStoreConfig(path);
						createStoreSection(storeConfig);
					} catch (err) {
						logger.error("处理商店配置失败:", err);
					}
				} else {
					createStoreSection([]);
				}
			});
		}
	}

	// 屏幕方向
	panel.$["orientation"].value =
		config.orientation ?? CONFIG.DEFAULT_ORIENTATION;
	if (!_eventsInitialized) {
		addEventListenerWithDispatch(
			panel.$["orientation"],
			"change",
			"orientation",
		);
	}

	// 启用图片压缩
	const compress = ensureCompressConfig(config);
	const compressEnable = panel.$[IDS.COMPRESS_ENABLE];
	compressEnable.value = compress.enable;

	const compressQuality = panel.$[IDS.COMPRESS_QUALITY];
	compressQuality.value = compress.quality;
	compressQuality.setAttribute("value", String(compress.quality));
	updateCompressVisibility(compress.enable);

	if (!_eventsInitialized) {
		compressEnable.addEventListener(
			EVENT_TYPES.CHANGE,
			handleCompressEnableChange,
		);
		compressQuality.addEventListener(
			EVENT_TYPES.CHANGE,
			handleCompressQualityChange,
		);
		compressQuality.addEventListener(
			EVENT_TYPES.CONFIRM,
			handleCompressQualityChange,
		);
	}

	// 跳过压缩 UUID 列表
	initSkipUuidsList(compress.skipUuids ?? []);
	const addBtn = panel.$[IDS.COMPRESS_SKIP_ADD];
	if (addBtn) {
		addBtn.style.flex = "0 0 auto";
		addBtn.style.width = "32px";
		addBtn.style.marginLeft = "auto";
		addBtn.onclick = () => addSkipUuidRow("");
	}

	// 压缩并发数（可选，留空则用 CPU 核心数）
	const compressConcurrency = panel.$[IDS.COMPRESS_CONCURRENCY];
	if (compressConcurrency) {
		compressConcurrency.value = compress.concurrency ?? "";
		compressConcurrency.setAttribute(
			"value",
			compress.concurrency != null ? String(compress.concurrency) : "",
		);
		if (!_eventsInitialized) {
			compressConcurrency.addEventListener(
				EVENT_TYPES.CHANGE,
				handleCompressConcurrencyChange,
			);
			compressConcurrency.addEventListener(
				EVENT_TYPES.CONFIRM,
				handleCompressConcurrencyChange,
			);
		}
	}

	// 启用插屏
	const enableSplash = panel.$["enableSplash"];
	enableSplash.value = config.enableSplash;
	if (!_eventsInitialized) {
		enableSplash.addEventListener(EVENT_TYPES.CHANGE, handleEnableSplashChange);
	}

	// 跳过构建
	const skipBuild = panel.$["skipBuild"];
	skipBuild.value = config.skipBuild;
	if (!_eventsInitialized) {
		skipBuild.addEventListener(EVENT_TYPES.CHANGE, handleSkipBuildChange);
	}

	// isZip 复选框
	const isZip = panel.$["isZip"];
	isZip.value = config.isZip;
	if (!_eventsInitialized) {
		isZip.addEventListener(EVENT_TYPES.CHANGE, handleIsZipChange);
	}
}

function collectSkipUuids(): string[] {
	const list = panel.$[IDS.COMPRESS_SKIP_LIST];
	if (!list || !(list instanceof HTMLElement)) return [];
	const uuids: string[] = [];
	list.querySelectorAll("ui-asset").forEach((asset: any) => {
		const val = asset.value;
		if (val) uuids.push(val);
	});
	return uuids;
}

function dispatchSkipUuids() {
	const uuids = collectSkipUuids();
	const config = getOptions();
	const compress = ensureCompressConfig(config);
	compress.skipUuids = uuids;
	config.compress = compress;
	panel.options.packages[PACKAGE_NAME] = config;
	panel.dispatch("update", `packages.${PACKAGE_NAME}.compress`, compress);
	saveConfigToFile(config).catch((err: any) => {
		logger.error("保存跳过 UUID 配置失败:", err.message);
	});
}

function refreshSkipUuidIndices() {
	const list = panel.$[IDS.COMPRESS_SKIP_LIST];
	if (!list || !(list instanceof HTMLElement)) return;
	const rows = list.querySelectorAll(".skip-uuid-row");
	rows.forEach((row, i) => {
		const idx = row.querySelector(".skip-uuid-index");
		if (idx) idx.textContent = String(i + 1);
	});
}

function refreshSkipUuidEmptyHint() {
	const list = panel.$[IDS.COMPRESS_SKIP_LIST];
	if (!list || !(list instanceof HTMLElement)) return;
	const existingHint = list.querySelector(".skip-uuid-empty");
	const hasRows = list.querySelector(".skip-uuid-row") !== null;
	if (!hasRows && !existingHint) {
		const hint = document.createElement("div");
		hint.className = "skip-uuid-empty";
		hint.textContent = "未添加跳过项，点击右上 + 按钮添加";
		list.appendChild(hint);
	} else if (hasRows && existingHint) {
		existingHint.remove();
	}
}

function addSkipUuidRow(uuid: string) {
	const list = panel.$[IDS.COMPRESS_SKIP_LIST];
	if (!list || !(list instanceof HTMLElement)) return;

	const row = document.createElement("div");
	row.className = "skip-uuid-row";

	const index = document.createElement("span");
	index.className = "skip-uuid-index";

	const asset = document.createElement("ui-asset") as HTMLCustomElement;
	asset.setAttribute("droppable", "cc.ImageAsset");
	if (uuid) asset.value = uuid;
	asset.addEventListener("confirm", () => dispatchSkipUuids());
	asset.addEventListener("change", () => dispatchSkipUuids());

	const removeBtn = document.createElement("ui-button") as HTMLCustomElement;
	removeBtn.textContent = "×";
	removeBtn.className = "skip-uuid-remove";
	removeBtn.setAttribute("tooltip", "移除");
	removeBtn.onclick = () => {
		row.remove();
		refreshSkipUuidIndices();
		dispatchSkipUuids();
		refreshSkipUuidEmptyHint();
	};

	row.appendChild(index);
	row.appendChild(asset);
	row.appendChild(removeBtn);
	list.appendChild(row);

	refreshSkipUuidIndices();
	refreshSkipUuidEmptyHint();
}

function clearElementChildren(element: HTMLElement) {
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

function appendTipMessage(parent: HTMLElement, message: string) {
	const boldPattern = /<b>(.*?)<\/b>/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = boldPattern.exec(message)) !== null) {
		if (match.index > lastIndex) {
			parent.appendChild(
				document.createTextNode(message.slice(lastIndex, match.index)),
			);
		}
		const bold = document.createElement("b");
		bold.textContent = match[1];
		parent.appendChild(bold);
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < message.length) {
		parent.appendChild(document.createTextNode(message.slice(lastIndex)));
	}
}

function initSkipUuidsList(uuids: string[]) {
	const list = panel.$[IDS.COMPRESS_SKIP_LIST];
	if (!list || !(list instanceof HTMLElement)) return;
	clearElementChildren(list);
	uuids.forEach((uuid) => addSkipUuidRow(uuid));
	refreshSkipUuidEmptyHint();
}

function initChannels() {
	const config = getOptions();
	const selectedChannels = config.exportChannels || [];

	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel];
		button.setAttribute(
			"type",
			selectedChannels.includes(channel) ? "primary" : "default",
		);
		if (!_eventsInitialized) {
			button.addEventListener("click", onChannelClick);
			addChannelInputListeners(channel);
		}
	});
}

function onChannelClick(event: any) {
	const button = event.target;
	const isSelected = button.getAttribute("type") === "primary";

	// 切换按钮状态
	button.setAttribute("type", isSelected ? "default" : "primary");

	// 更新选中的渠道
	const selectedChannels = CHANNEL_OPTIONS.filter(
		(ch) => panel.$[ch].getAttribute("type") === "primary",
	);

	// 使用正确的字段路径格式
	panel.dispatch(
		"update",
		`packages.${PACKAGE_NAME}.exportChannels`,
		selectedChannels,
	);

	// 更新注入选项区域
	updateInjectOptions();
	// 更新渠道提示
	updateChannelTips();
}

async function init() {
	await initBaseConfig();
	initChannels();
	updateInjectOptions();
	updateDefaultTip();
	updateChannelTips();
	_eventsInitialized = true;
}

function updateInjectOptions() {
	const config = getOptions();

	// 更新每个渠道的配置显示状态和内容
	CHANNEL_OPTIONS.forEach((channel) => {
		const button = panel.$[channel];

		// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
		const isSelected = button.getAttribute("type") === "primary";
		getStyle(`${channel}-section`).display = isSelected ? "" : "none";

		if (isSelected) {
			const headInput = panel.$[`${channel}-head`];
			const bodyInput = panel.$[`${channel}-body`];
			const sdkScriptInput = panel.$[`${channel}-sdkScript`];

			// 确保injectOptions存在
			const channelConfig =
				config.injectOptions && config.injectOptions[channel]
					? config.injectOptions[channel]
					: { head: "", body: "", sdkScript: "" };

			// 设置输入框的值
			headInput.value = channelConfig.head || "";
			bodyInput.value = channelConfig.body || "";
			sdkScriptInput.value = channelConfig.sdkScript || "";
		}
	});
}

function updateDefaultTip() {
	const defaultTipContainer = panel.$["defaultTipContainer"];

	if (!defaultTipContainer || !(defaultTipContainer instanceof HTMLElement)) {
		return;
	}

	clearElementChildren(defaultTipContainer);

	const level = DEFAULT_TIP.level || "info";
	const levelColors: Record<string, string> = {
		warn: "#faad14",
		error: "#ff4d4f",
	};

	const section = document.createElement("ui-section");
	section.setAttribute("header", "提示");
	section.setAttribute("expand", "");

	if (level !== "info" && levelColors[level]) {
		const wrapper = document.createElement("div");
		wrapper.style.borderLeft = `3px solid ${levelColors[level]}`;
		wrapper.style.paddingLeft = "4px";
		wrapper.style.marginLeft = "-4px";
		wrapper.className = "tip-section";
		wrapper.setAttribute("data-level", level);

		const prop = document.createElement("ui-prop");
		const label = document.createElement("ui-label");

		const textNode = document.createTextNode(DEFAULT_TIP.message);
		label.appendChild(textNode);

		if (DEFAULT_TIP.link) {
			const link = document.createElement("ui-link");
			link.setAttribute("tooltip", DEFAULT_TIP.linkText || "查看");
			link.setAttribute("value", DEFAULT_TIP.link);
			const icon = document.createElement("ui-icon");
			icon.setAttribute("value", "help");
			link.appendChild(icon);
			label.appendChild(link);
		}

		prop.appendChild(label);
		section.appendChild(prop);
		wrapper.appendChild(section);
		defaultTipContainer.appendChild(wrapper);
	} else {
		const prop = document.createElement("ui-prop");
		const label = document.createElement("ui-label");

		const textNode = document.createTextNode(DEFAULT_TIP.message);
		label.appendChild(textNode);

		if (DEFAULT_TIP.link) {
			const link = document.createElement("ui-link");
			link.setAttribute("tooltip", DEFAULT_TIP.linkText || "查看");
			link.setAttribute("value", DEFAULT_TIP.link);
			const icon = document.createElement("ui-icon");
			icon.setAttribute("value", "help");
			link.appendChild(icon);
			label.appendChild(link);
		}

		prop.appendChild(label);
		section.appendChild(prop);
		defaultTipContainer.appendChild(section);
	}
}

function updateChannelTips() {
	const config = getOptions();
	const selectedChannels = config.exportChannels || [];
	const tipsContainer = panel.$["channelTipsContainer"];

	if (!tipsContainer || !(tipsContainer instanceof HTMLElement)) {
		return;
	}

	clearElementChildren(tipsContainer);

	selectedChannels.forEach((channel) => {
		const tip = CHANNEL_TIPS[channel];
		if (!tip) {
			return;
		}

		const level = tip.level || "info";
		const levelColors: Record<string, string> = {
			warn: "#faad14",
			error: "#ff4d4f",
		};

		const section = document.createElement("ui-section");
		section.setAttribute("header", `${channel} 提示`);
		section.setAttribute("expand", "");

		const prop = document.createElement("ui-prop");
		const label = document.createElement("ui-label");

		const messageSpan = document.createElement("span");
		appendTipMessage(messageSpan, tip.message);
		label.appendChild(messageSpan);

		if (tip.link) {
			const link = document.createElement("ui-link");
			link.setAttribute("tooltip", tip.linkText || "查看详情");
			link.setAttribute("value", tip.link);
			const icon = document.createElement("ui-icon");
			icon.setAttribute("value", "help");
			link.appendChild(icon);
			label.appendChild(link);
		}

		prop.appendChild(label);
		section.appendChild(prop);

		if (level !== "info" && levelColors[level]) {
			const wrapper = document.createElement("div");
			wrapper.style.borderLeft = `3px solid ${levelColors[level]}`;
			wrapper.style.paddingLeft = "4px";
			wrapper.style.marginLeft = "-4px";
			wrapper.className = "tip-section";
			wrapper.setAttribute("data-level", level);
			wrapper.appendChild(section);
			tipsContainer.appendChild(wrapper);
		} else {
			tipsContainer.appendChild(section);
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
		const filteredArray = obj.filter(
			(item) =>
				item !== null &&
				item !== undefined &&
				item !== "" &&
				item !== "undefined",
		);
		return filteredArray.length > 0
			? filteredArray.map((item) => removeEmptyValues(item))
			: undefined;
	}

	if (typeof obj === "object") {
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
	if (typeof obj === "string") {
		return obj === "" || obj === "undefined" ? undefined : obj;
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
		await promises.writeFile(configPath, configStr, {
			encoding: "utf8",
			flag: "w",
		});
		logger.log(`配置已保存到 ${configPath}`);
	} catch (err) {
		logger.error("保存配置失败:", err);
		throw new Error("配置格式无效，无法保存");
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
	panel.dispatch("update", `packages.${PACKAGE_NAME}`, options);
}

/**
 * 创建默认的注入选项
 */
function createDefaultInjectOptions(): Record<TChannel, TChannelRC> {
	return CHANNEL_OPTIONS.reduce(
		(acc, channel) => {
			acc[channel] = {
				head: "",
				body: "",
				sdkScript: "",
			};
			return acc;
		},
		{} as Record<TChannel, TChannelRC>,
	);
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
		fileName: "",
		lang: "",
		title: "",
		iosUrl: "",
		androidUrl: "",
		compress: {
			enable: false,
			quality: DEFAULT_COMPRESS_QUALITY,
			skipUuids: [],
		},
		enableSplash: false,
		skipBuild: false,
		isZip: false,
	};
}

/**
 * 应用配置到UI
 * @param config 配置对象
 */
async function applyConfig(config: TAdapterRC) {
	try {
		// 更新配置
		setOptions(config);

		// 更新 UI
		showConfigPanel();
		initConfigPanelButtons();
		await init();

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
		await applyConfig(defaultConfig);

		// 完整替换文件内容
		await promises.writeFile(
			configPath,
			JSON.stringify(defaultConfig, null, 2),
			{ encoding: "utf8", flag: "w" },
		);
		logger.log("成功创建并保存默认配置");
	} catch (err: any) {
		logger.error("创建配置文件失败:", err.message);
	}
};

function showConfigPanel() {
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
	getStyle(IDS.NO_CONFIG_TIP).display = "none";
	getStyle(IDS.CONFIG_PANEL).display = "";
	getStyle(IDS.CONFIG_BUTTONS).display = "";
	getStyle(IDS.CREATE_BUTTONS).display = "none";
}

function hideConfigPanel() {
	getStyle(IDS.NO_CONFIG_TIP).display = "";
	getStyle(IDS.CONFIG_PANEL).display = "none";
	getStyle(IDS.CONFIG_BUTTONS).display = "none";
	getStyle(IDS.CREATE_BUTTONS).display = "";
}

// 抽取公共的文件操作函数
async function handleFileOperation(
	operation: "import" | "export",
): Promise<void> {
	const dialogConfig = getDialogConfig(operation);
	const result = await Editor.Dialog.select(dialogConfig);

	if (!result.filePaths?.[0]) {
		return;
	}

	try {
		await processFileOperation(operation, result.filePaths[0]);
		logger.log(`配置已成功${operation === "import" ? "导入" : "导出"}`);
	} catch (err: any) {
		logger.error(
			`配置${operation === "import" ? "导入" : "导出"}失败: ${err.message}`,
		);
	}
}

function getDialogConfig(operation: "import" | "export") {
	return operation === "import"
		? {
				title: "选择配置文件",
				type: "file" as const,
				filters: [{ name: "JSON", extensions: ["json"] }],
			}
		: {
				title: "选择导出目录",
				type: "directory" as const,
			};
}

async function processFileOperation(
	operation: "import" | "export",
	filePath: string,
) {
	if (operation === "import") {
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
		const content = await promises.readFile(filePath, "utf8");
		let config: TAdapterRC;

		try {
			config = JSON.parse(content);
		} catch (err) {
			logger.error("配置文件格式无效，请确保是有效的 JSON 格式");
			return;
		}

		// 获取目标路径
		// const projectPath = Editor.Project.path;
		// const targetPath = `${projectPath}${ADAPTER_RC_PATH}`;

		await applyConfig(config);
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
		await promises.writeFile(exportPath, configStr, {
			encoding: "utf8",
			flag: "w",
		});
		logger.log(`配置已导出到 ${exportPath}`);
	} catch (err: any) {
		logger.error(`导出配置失败: ${err.message}`);
	}
}

// 定义事件处理函数
const handleOpenBuildFolderClick = () => handleOpenBuildFolder();
const handleOpenConfigClick = () => handleOpenConfig();
const handleImportClick = () => handleFileOperation("import");
const handleExportClick = () => handleFileOperation("export");
const handleImportCreateClick = () => handleFileOperation("import");
const handleBuildClick = () => handleBuild();
const handleCancelBuildClick = () => handleCancelBuild();
function initConfigPanelButtons() {
	// 由于 initPanelElements 已确保所有元素都不为空，可以直接添加事件监听器
	// 配置面板上的按钮
	panel.$[IDS.OPEN_BUILD_FOLDER].addEventListener(
		EVENT_TYPES.CLICK,
		handleOpenBuildFolderClick,
	);
	panel.$[IDS.OPEN_CONFIG].addEventListener(
		EVENT_TYPES.CLICK,
		handleOpenConfigClick,
	);
	panel.$[IDS.IMPORT_CONFIG].addEventListener(
		EVENT_TYPES.CLICK,
		handleImportClick,
	);
	panel.$[IDS.EXPORT_CONFIG].addEventListener(
		EVENT_TYPES.CLICK,
		handleExportClick,
	);
	panel.$[IDS.BUILD].addEventListener(EVENT_TYPES.CLICK, handleBuildClick);
	panel.$[IDS.CANCEL_BUILD]?.addEventListener(
		EVENT_TYPES.CLICK,
		handleCancelBuildClick,
	);
}

/**
 * 初始化创建面板上的按钮
 */
function initCreatePanelButtons() {
	// 由于 initPanelElements 已确保所有元素都不为空，不再需要检查元素是否存在
	// 创建面板上的导入配置按钮
	panel.$[IDS.IMPORT_CONFIG_CREATE].addEventListener(
		EVENT_TYPES.CLICK,
		handleImportCreateClick,
	);
	panel.$[IDS.CREATE_CONFIG].addEventListener(
		EVENT_TYPES.CLICK,
		handleCreateConfigClick,
	);

	// 确保配置面板按钮不可见

	getStyle(IDS.CONFIG_BUTTONS).display = "none";

	// 确保创建面板按钮可见
	getStyle(IDS.CREATE_BUTTONS).display = "";
}

function handleBuild() {
	if (isBuilding) {
		return;
	}
	Editor.Message.send(PACKAGE_NAME, "adapter-build");
}

function handleCancelBuild() {
	if (!isBuilding) {
		return;
	}
	logger.warn("请求停止构建...");
	Editor.Message.send(PACKAGE_NAME, "cancel-build");
}

/**
 * 打开构建文件夹
 */
async function handleOpenBuildFolder() {
	try {
		const projectPath = Editor.Project.path;
		const buildPath = `${projectPath}/build`;

		// 检查文件夹是否存在
		if (existsSync(buildPath)) {
			await shell.openPath(buildPath);
			logger.log(`打开构建文件夹: ${buildPath}`);
		} else {
			logger.warn(`构建文件夹不存在: ${buildPath}，请先执行构建`);
		}
	} catch (err: any) {
		logger.error(`打开构建文件夹失败: ${err.message}`);
	}
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
		const content = await promises.readFile(storePath, "utf8");
		return JSON.parse(content);
	} catch (err) {
		logger.error("读取商店配置失败:", err);
		return [];
	}
}

// 修改创建商店配置区域的函数
function createStoreSection(storeConfig: TStoreConfig) {
	const container = panel.$[IDS.STORE_CONTAINER];
	if (!container || !(container instanceof HTMLElement)) {
		logger.error("商店配置容器无效或不是 HTMLElement");
		return;
	}

	// 获取 ui-file 元素
	const storePathElement = panel.$["storePath"];
	if (!storePathElement || !(storePathElement instanceof HTMLElement)) {
		logger.error("商店配置路径输入框无效或不是 HTMLElement");
		return;
	}

	// 清除除了 ui-file 以外的所有内容
	Array.from(container.children).forEach((child) => {
		if (child !== storePathElement && child.id !== "storePath") {
			container.removeChild(child);
		}
	});

	// 如果没有配置，直接返回
	if (!Array.isArray(storeConfig) || storeConfig.length === 0) {
		logger.log("没有商店配置数据");
		return;
	}

	try {
		storeConfig.forEach((store) => {
			if (!store || typeof store !== "object") {
				logger.warn("无效的商店配置项:", store);
				return;
			}

			// 创建商店配置组
			const storeSection = document.createElement("ui-section");
			storeSection.setAttribute("header", store.name || "未命名商店");

			// 创建iOS URL部分
			const iosProps = document.createElement("ui-prop");
			const iosLabel = document.createElement("ui-label");
			iosLabel.setAttribute("slot", "label");
			iosLabel.setAttribute("value", "iOS URL");
			const iosInput = document.createElement("ui-input");
			iosInput.setAttribute("slot", "content");
			iosInput.setAttribute("value", store.ios || "");
			iosInput.setAttribute("readonly", "");
			iosProps.appendChild(iosLabel);
			iosProps.appendChild(iosInput);
			storeSection.appendChild(iosProps);

			// 创建Android URL部分
			const androidProps = document.createElement("ui-prop");
			const androidLabel = document.createElement("ui-label");
			androidLabel.setAttribute("slot", "label");
			androidLabel.setAttribute("value", "Android URL");
			const androidInput = document.createElement("ui-input");
			androidInput.setAttribute("slot", "content");
			androidInput.setAttribute("value", store.android || "");
			androidInput.setAttribute("readonly", "");
			androidProps.appendChild(androidLabel);
			androidProps.appendChild(androidInput);
			storeSection.appendChild(androidProps);

			// 创建应用按钮容器
			const buttonContainer = document.createElement("div");
			buttonContainer.style.textAlign = "right";
			buttonContainer.style.marginTop = "4px";

			// 创建应用按钮
			const applyButton = document.createElement("ui-button");
			applyButton.textContent = "应用";
			applyButton.addEventListener(EVENT_TYPES.CLICK, async () => {
				const options = getOptions();
				options.iosUrl = store.ios || "";
				options.androidUrl = store.android || "";
				panel.dispatch("update", `packages.${PACKAGE_NAME}`, options);
			});

			buttonContainer.appendChild(applyButton);
			storeSection.appendChild(buttonContainer);

			container.appendChild(storeSection);
		});
	} catch (err) {
		logger.error("创建商店配置区域时出错:", err);
	}
}
