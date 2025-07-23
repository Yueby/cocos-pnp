import { TRANSPARENT_GIF } from '@/constants';
import { jszipCode } from '@/helpers/injects';
import { getAdapterRCJson, getBase64FromFile, getFileSize, getOriginPkgPath, getResourceMapper, readToPath, writeToPath } from '@/utils';
import { CheerioAPI, load } from 'cheerio';
import { deflate } from 'pako';
import { join } from 'path';

type TOptions = {
	singleFilePath: string;
	injectsCode: {
		init: string;
		main: string;
	};
};

const paddingStyleTags = ($: CheerioAPI) => {
	const { enableSplash, title } = getAdapterRCJson() || {};
	// Original package path
	const originPkgPath = getOriginPkgPath();

	// Convert external CSS files into inline tags
	$('link[type="text/css"]')
		.toArray()
		.forEach((item) => {
			const href = $(item).attr('href');
			if (!href) {
				return;
			}
			const cssStr = readToPath(join(originPkgPath, href), 'utf-8');
			// Add some tags
			$(`<style>${cssStr}</style>`).appendTo('head');
		});
	// Hide progress bar, set the opacity to 0, and set the visibility to hidden
	if (!enableSplash) {
		$(`<style>#splash .progress-bar{opacity:0;visibility:hidden}</style>`).appendTo('head');
	}

	$('link[type="text/css"]').remove();

	if (title) {
		$('title').text(title);
	}

	// Support for splash screen
	$('head')
		.find('style')
		.each((_index, elem) => {
			// Match css url
			const cssUrlReg = /url\("?'?.*"?'?\)/g;
			let styleTagStr = $(elem).html() || '';

			const matchStrList = styleTagStr.match(cssUrlReg);
			if (!matchStrList) return;

			matchStrList.forEach((str) => {
				// Match url
				const strReg = /"|'|url|\(|\)/g;
				const imgUrl = str.replace(strReg, '');
				const imgBase64 = enableSplash ? getBase64FromFile(join(originPkgPath, imgUrl)) : TRANSPARENT_GIF;
				styleTagStr = styleTagStr.replace(cssUrlReg, `url(${imgBase64})`);
			});

			$(elem).html(styleTagStr).html();
		});
};

const paddingScriptTags = ($: CheerioAPI) => {
	// Original package path
	const originPkgPath = getOriginPkgPath();

	let scriptTags = '';
	$('script[type="systemjs-importmap"]')
		.toArray()
		.forEach((item) => {
			const href = $(item).attr('src');
			if (!href) {
				return;
			}
			let scriptStr = readToPath(join(originPkgPath, href), 'utf-8');
			// Add some tags
			scriptTags += `<script type="systemjs-importmap">${scriptStr}</script>`;
		});

	// Clear script tags in HTML
	$('head link').remove();
	$('body script').remove();
	$(scriptTags).appendTo('body');
};

const getJsListFromSettingsJson = (data: string): { jsList: string[]; settingsData: { [key: string]: any } } => {
	let jsonData = JSON.parse(data);
	jsonData.plugins = {
		jsList: [],
		...jsonData.plugins
	};
	const jsList = [...jsonData.plugins.jsList];
	jsonData.plugins.jsList = [];
	return {
		jsList,
		settingsData: jsonData
	};
};

const getJsListFromSettingsJs = (data: string): { jsList: string[]; settingsData: string } => {
	const originData = {
		jsList: [],
		settingsData: data
	};

	// check jsList
	let settingsStrList = data.split('jsList:');
	if (settingsStrList.length < 2) {
		return originData;
	}

	// get jsList
	const settingsStr = settingsStrList.pop() || '';
	const regExp = /\[[^\]]*\]/;
	const jsListStrRegExp = regExp.exec(settingsStr);
	if (!jsListStrRegExp) {
		return originData;
	}
	const jsListStr = jsListStrRegExp[0];
	return {
		jsList: JSON.parse(jsListStr),
		settingsData: data.replace(jsListStr, '[]')
	};
};

const paddingAllResToMapped = async (options: { injectsCode: TOptions['injectsCode']; $: CheerioAPI }) => {
	const { isZip = true, enableSplash = true, lang } = getAdapterRCJson() || {};

	const { injectsCode, $ } = options;
	// Original package path
	const originPkgPath = getOriginPkgPath();

	let pluginJsList: string[] = [];
	const { resMapper } = await getResourceMapper({
		dirPath: originPkgPath,
		rmHttp: true,
		lang,
		mountCbFn: (objKey, data) => {
			if (objKey.indexOf('src/settings.json') !== -1) {
				// get jsList in settings.json
				const { jsList, settingsData } = getJsListFromSettingsJson(data);
				pluginJsList = jsList;
				// Remove the splash screen in version 3.x.x.
				if (!enableSplash && settingsData?.splashScreen?.totalTime) {
					settingsData.splashScreen.totalTime = 0;
				}

				return JSON.stringify(settingsData);
			} else if (objKey.indexOf('src/settings.js') !== -1) {
				// get jsList in settings.js
				const { jsList, settingsData } = getJsListFromSettingsJs(data);
				pluginJsList = jsList;
				return settingsData;
			}

			return data;
		}
	});

	let resStr = JSON.stringify(resMapper);
	let compDiff = 0;

	if (isZip) {
		console.info('[压缩] 开始压缩资源包...');
		const zip = deflate(resStr);
		const zipStr = Buffer.from(zip).toString('base64');

		const originalSize = resStr.length;
		const compressedSize = zipStr.length;
		const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

		console.info(`[压缩] 资源包大小 - 原始: ${(originalSize / 1024).toFixed(2)}kb, 压缩后: ${(compressedSize / 1024).toFixed(2)}kb`);

		if (zipStr.length < resStr.length) {
			compDiff = resStr.length - zipStr.length;
			console.info(`[压缩] 压缩率: ${ratio}%, 节省空间: ${(compDiff / 1024).toFixed(2)}kb`);
			resStr = zipStr;
		} else {
			console.warn('[压缩] 压缩后文件更大,将使用原始资源包');
		}
	}

	if (compDiff > 0) {
		console.info('[压缩] 注入解压缩库...');
		// Inject decompression library
		$(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body');
		// Inject compressed files
		$(`<script data-id="adapter-zip-0">window.__adapter_zip__="${resStr}";</script>`).appendTo('body');
	} else {
		console.info('[压缩] 使用未压缩资源包');
		// Inject uncompressed files
		$(`<script data-id="adapter-resource-0">window.__adapter_resource__=${resStr}</script>`).appendTo('body');
	}

	// Inject related code
	$(`<script data-id="adapter-plugins">window.__adapter_plugins__=${JSON.stringify(pluginJsList)}</script>`).appendTo('body');
	$(`<script data-id="adapter-init">${injectsCode.init}</script>`).appendTo('body');
	$(`<script data-id="adapter-main">${injectsCode.main}</script>`).appendTo('body');

	return {
		resMapper,
		compDiff
	};
};

export const genSingleFile = async (options: TOptions) => {
	const { singleFilePath, injectsCode } = options;
	// Original package path
	const originPkgPath = getOriginPkgPath();

	// Build related directories and file paths
	const htmlPath = join(originPkgPath, '/index.html');
	const htmlStr = readToPath(htmlPath, 'utf-8');

	const $ = load(htmlStr);

	// Fill style files into HTML
	paddingStyleTags($);

	// Clear script tags in HTML
	paddingScriptTags($);

	// Embed resources into HTML
	const { resMapper, compDiff } = await paddingAllResToMapped({
		injectsCode,
		$
	});

	writeToPath(singleFilePath, $.html());

	console.info(`[合并] 生成单文件成功, 文件大小: ${(getFileSize(singleFilePath) / 1024).toFixed(2)}kb`);

	return {
		resMapper,
		compDiff
	};
};
