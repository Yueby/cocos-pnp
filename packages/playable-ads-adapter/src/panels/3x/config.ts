import { TAdapterRCKeysExcluded, TPanelSelector } from './types';

export const CHANNEL_OPTIONS: TChannel[] = ['AppLovin', 'Facebook', 'Google', 'IronSource', 'Liftoff', 'Mintegral', 'Moloco', 'Pangle', 'Rubeex', 'Tiktok', 'Unity', 'SnapChat', 'Yandex'];
export const ORIENTATIONS: TWebOrientations[] = ['auto', 'portrait', 'landscape'];

export type TTipLevel = 'info' | 'warn' | 'error';

export type TChannelTip = {
	message: string;
	link?: string;
	linkText?: string;
	level?: TTipLevel;
};

export const DEFAULT_TIP: TChannelTip = {
	message: '需要将构建发布面板中的"原生代码打包模式"改成AmsJS或者将物理引擎改成其他的，Bullet和Wasm就会引发如"i.xxx is not a function"的错误',
	link: 'https://github.com/ppgee/cocos-pnp/issues/33',
	linkText: '查看',
	level: 'info'
};

export const CHANNEL_TIPS: Partial<Record<TChannel, TChannelTip>> = {
	Mintegral: {
		message: '需要在结束页面出现时调用 <b>Playable.tryGameEnd()</b> 函数来通知平台游戏已结束',
		link: 'https://www.playturbo.cn/review/doc',
		linkText: '查看详情',
		level: 'warn'
	},
	Yandex: {
		message: '要求最大存档大小为 <b>3 MB</b>，请确保构建产物压缩后不超过此限制',
		link: 'https://yandex.ru/support/direct/zh/products-mobile-apps-ads/recommendations',
		linkText: '查看详情',
		level: 'warn'
	}
};

// 配置常量
export const CONFIG = {
    DEFAULT_BUILD_PLATFORM: 'web-mobile',
    DEFAULT_ORIENTATION: 'auto',
    INJECT_FIELDS: ['head', 'body', 'sdkScript'] as const
} as const;

export const IDS = {
    CONFIG_BUTTONS: 'configButtons',
    CREATE_BUTTONS: 'createButtons',
    NO_CONFIG_TIP: 'noConfigTip',
    CONFIG_PANEL: 'configPanel',
    OPEN_BUILD_FOLDER: 'openBuildFolder',
    OPEN_CONFIG: 'openConfig',
    IMPORT_CONFIG: 'importConfig',
    EXPORT_CONFIG: 'exportConfig',
    IMPORT_CONFIG_CREATE: 'importConfigCreate',
    CREATE_CONFIG: 'createConfig',
    BUILD: 'build',
    BUILDING_MASK: 'buildingMask',
    STORE_CONTAINER: 'storeContainer'
} as const;

// 事件类型
export const EVENT_TYPES = {
    CLICK: 'click',
    CHANGE: 'change',
    CONFIRM: 'confirm'
} as const;

export const STYLE = `
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
    padding: 12px 0 0 0;
    font-size: 14px;
    font-weight: bold;
    border-bottom: 1px solid var(--color-border);
}

.loading-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 999;
}

.loading-mask.active {
    display: flex;
}

.loading-content {
    text-align: center;
    color: white;
}

.loading-text {
    margin-top: 10px;
    font-size: 14px;
}

`;

export const TEMPLATE = `
<div id="adapter-panel">
    <div class="loading-mask" id="${IDS.BUILDING_MASK}">
        <div class="loading-content">
            <ui-loading></ui-loading>
            <div class="loading-text">构建中...</div>
        </div>
    </div>
    <div id="${IDS.CONFIG_BUTTONS}" style="text-align: right; margin-bottom: 12px; display: none;">
        <ui-button id="${IDS.OPEN_BUILD_FOLDER}">打开构建文件夹</ui-button>
        <ui-button id="${IDS.OPEN_CONFIG}">打开配置</ui-button>
        <ui-button id="${IDS.IMPORT_CONFIG}">导入配置</ui-button>
        <ui-button id="${IDS.EXPORT_CONFIG}">导出配置</ui-button>
        <ui-button id="${IDS.BUILD}" type="primary">构建</ui-button>
    </div>
    <div id="${IDS.CREATE_BUTTONS}" style="text-align: right; margin-bottom: 12px;">
        <ui-button id="${IDS.IMPORT_CONFIG_CREATE}">导入配置</ui-button>
    </div>
    <div id="${IDS.NO_CONFIG_TIP}" style="display: none;">
        <div style="text-align: center; padding: 20px;">
            <div style="margin-bottom: 12px;">未检测到配置文件，请先创建配置</div>
            <ui-button id="${IDS.CREATE_CONFIG}">创建配置</ui-button>
        </div>
    </div>
    <div id="${IDS.CONFIG_PANEL}">
        <div class="section-header">基础配置</div>
        <ui-prop>
            <ui-label slot="label" value="iOS URL"></ui-label>
            <ui-input slot="content" id="iosUrl"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="Android URL"></ui-label>
            <ui-input slot="content" id="androidUrl"></ui-input>
        </ui-prop>
        <ui-section id="${IDS.STORE_CONTAINER}" header="商店配置选项">
            <ui-file id="storePath" value="" type="file"></ui-file>
            <!-- 内容动态添加 -->
        </ui-section>
        <ui-prop>
            <ui-label slot="label" value="文件名"></ui-label>
            <ui-input slot="content" id="fileName"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="语言"></ui-label>
            <ui-input slot="content" id="lang"></ui-input>
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
            <ui-label slot="label" value="启用插屏"></ui-label>
            <ui-checkbox slot="content" id="enableSplash"></ui-checkbox>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="跳过构建"></ui-label>
            <ui-checkbox slot="content" id="skipBuild"></ui-checkbox>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="启用图片压缩"></ui-label>
            <ui-checkbox slot="content" id="tinify"></ui-checkbox>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="压缩API Key"></ui-label>
            <ui-input slot="content" id="tinifyApiKey"></ui-input>
        </ui-prop>
        <ui-prop>
            <ui-label slot="label" value="启用Pako压缩"></ui-label>
            <ui-checkbox slot="content" id="isZip"></ui-checkbox>
        </ui-prop>

        <div class="section-header">导出渠道配置</div>
        <div id="defaultTipContainer"></div>
        <div id="channelContainer" class="channel-list">
            ${CHANNEL_OPTIONS.map(
    (channel) => `
                <ui-button id="${channel}" class="small" type="default">${channel}</ui-button>
            `
).join('')}
        </div>
        <div id="channelTipsContainer"></div>

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
        <ui-prop>
            <ui-label slot="label" value="HTML标题"></ui-label>
            <ui-input slot="content" id="title"></ui-input>
        </ui-prop>
    </div>
</div>
`;

export const SELECTORS: TPanelSelector<TAdapterRCKeysExcluded> = {
    root: '#adapter-panel',
    // 基本配置选择器
    fileName: '#fileName',
    title: '#title',
    iosUrl: '#iosUrl',
    androidUrl: '#androidUrl',
    buildPlatform: '#buildPlatform',
    orientation: '#orientation',
    tinify: '#tinify',
    tinifyApiKey: '#tinifyApiKey',
    enableSplash: '#enableSplash',
    skipBuild: '#skipBuild',
    isZip: '#isZip',
    lang: '#lang',
    storePath: '#storePath',

    // DOM_IDS 中的选择器
    [IDS.CONFIG_BUTTONS]: `#${IDS.CONFIG_BUTTONS}`,
    [IDS.CREATE_BUTTONS]: `#${IDS.CREATE_BUTTONS}`,
    [IDS.NO_CONFIG_TIP]: `#${IDS.NO_CONFIG_TIP}`,
    [IDS.CONFIG_PANEL]: `#${IDS.CONFIG_PANEL}`,
    [IDS.OPEN_BUILD_FOLDER]: `#${IDS.OPEN_BUILD_FOLDER}`,
    [IDS.OPEN_CONFIG]: `#${IDS.OPEN_CONFIG}`,
    [IDS.IMPORT_CONFIG]: `#${IDS.IMPORT_CONFIG}`,
    [IDS.EXPORT_CONFIG]: `#${IDS.EXPORT_CONFIG}`,
    [IDS.IMPORT_CONFIG_CREATE]: `#${IDS.IMPORT_CONFIG_CREATE}`,
    [IDS.CREATE_CONFIG]: `#${IDS.CREATE_CONFIG}`,
    [IDS.BUILD]: `#${IDS.BUILD}`,
    [IDS.BUILDING_MASK]: `#${IDS.BUILDING_MASK}`,
    [IDS.STORE_CONTAINER]: `#${IDS.STORE_CONTAINER}`,

    // 渠道相关选择器
    ...CHANNEL_OPTIONS.reduce(
        (acc, channel) => ({
            ...acc,
            [channel]: `#${channel}`,
            [`${channel}-section`]: `#${channel}-section`,
            [`${channel}-head`]: `#${channel}-head`,
            [`${channel}-body`]: `#${channel}-body`,
            [`${channel}-sdkScript`]: `#${channel}-sdkScript`,
            [`${channel}-tip`]: `#${channel}-tip`
        }),
        {}
    ),
    channelTipsContainer: '#channelTipsContainer',
    defaultTipContainer: '#defaultTipContainer'
};
