import { MAX_ZIP_SIZE, REPLACE_SYMBOL } from '@/constants';
import { getGlobalProjectBuildPath } from '@/global';
import { injectFromRCJson } from '@/helpers/dom';
import { jszipCode } from '@/helpers/injects';
import { TBuilderOptions, TResourceData, TZipFromSingleFileOptions } from '@/typings';
import { copyDirToPath, getAdapterRCJson, getOriginPkgPath, readToPath, replaceGlobalSymbol, writeToPath } from '@/utils';
import { CheerioAPI, load } from 'cheerio';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import JSZip from 'jszip';
import { deflate } from 'pako';
import path, { basename, extname, join } from 'path';

const FILE_MAX_SIZE = MAX_ZIP_SIZE * 0.8;

const globalReplacer = (options: Pick<TBuilderOptions, 'channel' | 'resMapper'> & { $: CheerioAPI }) => {
	const { channel, resMapper } = options;
	if (!resMapper) {
		return {} as TResourceData;
	}

	// Non-compressed files are not required.
	for (const [key, value] of Object.entries(resMapper)) {
		resMapper[key] = value.replaceAll(REPLACE_SYMBOL, channel);
	}

	return resMapper;
};

const compressScripts = ($: CheerioAPI, payload: { resMapper: TBuilderOptions['resMapper'] }) => {
	const { resMapper } = payload;

	// Add compressed files.
	const zip = deflate(JSON.stringify(resMapper));
	let strBase64 = Buffer.from(zip).toString('base64');

	let splitSize = Number(FILE_MAX_SIZE.toFixed(0));
	let splitCount = Math.ceil(strBase64.length / splitSize);
	for (let index = 0; index < splitCount; index++) {
		const str = strBase64.slice(index * splitSize, (index + 1) * splitSize);
		if (index === 0) {
			$(`script[data-id="adapter-zip-0"]`).html(`window.__adapter_zip__="${str}";`);
		} else {
			$(`script[data-id="adapter-zip-${index - 1}"]`).after(`<script data-id="adapter-zip-${index}">window.__adapter_zip__+="${str}";</script>`);
		}
	}

	// Inject decompression library.
	$(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body');
};

const restoreScripts = ($: CheerioAPI, payload: { resMapper: TBuilderOptions['resMapper'] }) => {
	const appendScript = (content: TResourceData, index: number) => {
		const str = JSON.stringify(content);
		const scriptTag = `<script data-id="adapter-resource-${index}">Object.assign(window.__adapter_resource__, ${str});</script>`;

		if (index === 0) {
			$(`script[data-id="adapter-resource-0"]`).html(`window.__adapter_resource__=${str};`);
			return;
		}
		$(`script[data-id="adapter-resource-${index - 1}"]`).after(scriptTag);
	};

	const { resMapper } = payload;
	if (!resMapper) {
		return;
	}

	// chunk resMapper to avoid the maximum size of the script tag
	const splitSize = Number(FILE_MAX_SIZE.toFixed(0));
	let currentChunkSize = 0;
	let currentChunkIndex = 0;
	let currentChunk: TResourceData = {};

	for (const [key, value] of Object.entries(resMapper)) {
		const valueLength = value.length;

		// If a single resource exceeds the chunk size, then create a separate script tag for it.
		if (valueLength >= splitSize) {
			appendScript({ [key]: value }, currentChunkIndex);
			currentChunkIndex++;
			continue;
		}

		// Determine whether the current chunk, when combined with the new resource, will exceed the limit.
		if (currentChunkSize + valueLength >= splitSize) {
			// If it does, first append the current chunk, then reset the chunk size and content.
			appendScript(currentChunk, currentChunkIndex);
			currentChunk = {};
			currentChunkSize = 0;
			currentChunkIndex++;
		}

		// Add the new resource to the current chunk.
		currentChunk[key] = value;
		currentChunkSize += valueLength;
	}

	// If the last chunk has content, it also needs to be appended to the script.
	if (currentChunkSize > 0) {
		appendScript(currentChunk, currentChunkIndex);
	}
};

const fillCodeToHTML = ($: CheerioAPI, options: TBuilderOptions) => {
	let { channel, resMapper, compDiff } = options;
	// Replace global variables.
	resMapper = globalReplacer({
		channel,
		resMapper: resMapper ? { ...resMapper } : {},
		$
	});

	const isCompress = (compDiff ?? 0) > 0;
	if (isCompress) {
		compressScripts($, { resMapper });
	} else {
		restoreScripts($, { resMapper });
	}
};

export const exportSingleFile = async (singleFilePath: string, options: TBuilderOptions) => {
	const { channel, transformHTML, transform } = options;

	console.info(`[适配] 开始适配 ${channel} 渠道`);
	const { fileName = '' } = getAdapterRCJson() || {};

	try {
		const singleHtml = readToPath(singleFilePath, 'utf-8');
		const targetPath = join(getGlobalProjectBuildPath(), `${fileName}${channel.toLowerCase()}.html`);

		// Replace global variables.
		let $ = load(singleHtml);
		fillCodeToHTML($, options);

		// Inject additional configuration.
		await injectFromRCJson($, channel);
		writeToPath(targetPath, $.html());

		if (transformHTML) {
			await transformHTML($);
			writeToPath(targetPath, $.html());
		}

		if (transform) {
			await transform(targetPath);
		}

		console.info(`[适配] ${channel} 渠道适配完成`);
	} catch (error) {
		console.error(`[适配] ${channel} 渠道适配失败:`, error);
		throw error;
	}
};

export const exportZipFromPkg = async (options: TBuilderOptions) => {
	const { channel, transformHTML, transform } = options;

	console.info(`[适配] 开始适配 ${channel} 渠道`);
	const { fileName = '' } = getAdapterRCJson() || {};

	try {
		// Copy the folder.
		const originPkgPath = getOriginPkgPath();
		const projectBuildPath = getGlobalProjectBuildPath();
		const destPath = join(projectBuildPath, `${fileName}${channel.toLowerCase()}`);
		copyDirToPath(originPkgPath, destPath);

		// Replace global variables.
		replaceGlobalSymbol(destPath, channel);

		// Inject additional configuration.
		const singleHtmlPath = join(destPath, '/index.html');
		const singleHtml = readToPath(singleHtmlPath, 'utf-8');
		const $ = load(singleHtml);
		await injectFromRCJson($, channel);

		// Add the SDK script.
		if (transformHTML) {
			await transformHTML($);
		}

		// Update the HTML file.
		writeToPath(singleHtmlPath, $.html());

		if (transform) {
			await transform(destPath);
		}

		// 创建新的JSZip实例
		const newZip = new JSZip();

		// Pack in zip
		await createZip(getGlobalProjectBuildPath(), [destPath], `${fileName}${channel.toLowerCase()}`, newZip);

		console.info(`[适配] ${channel} 渠道适配完成`);
	} catch (error) {
		console.error(`[适配] ${channel} 渠道适配失败:`, error);
		throw error;
	}
};

export const exportZipFromSingleFile = async (singleFilePath: string, options: TZipFromSingleFileOptions) => {
	const { channel, transformHTML, transform, transformScript, exportType } = options;

	console.info(`[适配] 开始适配 ${channel} 渠道`);
	const { fileName = '' } = getAdapterRCJson() || {};

	try {
		// Copy the folder.
		const singleHtmlPath = singleFilePath;
		const projectBuildPath = getGlobalProjectBuildPath();
		const destPath = join(projectBuildPath, `${fileName}${channel.toLowerCase()}`);

		// Create destination directory
		mkdirSync(destPath, { recursive: true });

		// HTML file path.
		const htmlPath = join(destPath, '/index.html');

		let $ = load(readToPath(singleHtmlPath, 'utf-8'));
		fillCodeToHTML($, options);

		// Inject configuration file.
		await injectFromRCJson($, channel);

		// To extract all scripts and generate a JavaScript file
		const scriptNodes = $('body script[type!="systemjs-importmap"]');

		if (exportType === 'dirZip') {
			// Create a "js" directory.
			const jsDirname = '/js';
			const jsDirPath = join(destPath, jsDirname);
			mkdirSync(jsDirPath, { recursive: true });

			// Process scripts and move them to js directory
			for (let index = 0; index < scriptNodes.length; index++) {
				const scriptNode = $(scriptNodes[index]);
				if (transformScript) {
					await transformScript(scriptNode);
				}
				let jsStr = scriptNode.text();
				const jsFileName = `index${index}.js`;
				const jsPath = join(jsDirPath, jsFileName);
				scriptNode.replaceWith(`<script src=".${jsDirname}/${jsFileName}"></script>`);
				writeToPath(jsPath, jsStr);
			}
		} else {
			// For zip type, keep all files in the same directory

			for (let index = 0; index < scriptNodes.length; index++) {
				const scriptNode = $(scriptNodes[index]);
				if (transformScript) {
					await transformScript(scriptNode);
				}
				let jsStr = scriptNode.text();
				const jsFileName = `index${index}.js`;
				const jsPath = join(destPath, jsFileName);
				scriptNode.replaceWith(`<script src="./${jsFileName}"></script>`);
				writeToPath(jsPath, jsStr);
			}
		}

		// Add base tag to ensure correct resource paths
		if ($('head base').length === 0) {
			$('head').prepend('<base href="./">');
		}

		writeToPath(htmlPath, $.html());

		if (transformHTML) {
			await transformHTML($);
			writeToPath(htmlPath, $.html());
		}

		if (transform) {
			await transform(destPath);
		}

		// Pack in zip
		const newZip = new JSZip();

		await createZip(getGlobalProjectBuildPath(), [destPath], `${fileName}${channel.toLowerCase()}`, newZip);

		console.info(`[适配] ${channel} 渠道适配完成`);
	} catch (error) {
		console.error(`[适配] ${channel} 渠道适配失败:`, error);
		throw error;
	}
};

//打包成一个zip文件
export const createZip = async (destPath: string, filePaths: string[], zipName: string, zip: JSZip | null) => {
	if (filePaths.length === 0) {
		throw new Error('[创建zip文件] filePath array is empty.');
	}

	try {
		// 遍历文件路径数组
		for (let filePath of filePaths) {
			// 检查文件是否存在
			if (!existsSync(filePath)) {
				console.error(`[创建zip文件] file ${filePath} not exists.`);
				continue;
			}

			if (lstatSync(filePath).isDirectory()) {
				readDir(zip, filePath, false);
			} else {
				readFile(zip, filePath, basename(filePath), false);
			}
		}
		// 生成 zip 文件的内容
		const zipContent = await zip!.generateAsync({ type: 'nodebuffer' });

		// 将 zip 内容写入到文件中
		let file_path = path.join(destPath, `${zipName}.zip`);

		try {
			// 检查文件是否存在，如果存在则先尝试删除
			if (existsSync(file_path)) {
				try {
					unlinkSync(file_path);
				} catch (err: any) {
					if (err.code === 'EBUSY') {
						throw new Error(`文件 ${file_path} 正在被其他程序使用，无法覆盖。请关闭可能正在使用该文件的程序后重试。`);
					}
					throw err;
				}
			}

			writeFileSync(file_path, new Uint8Array(zipContent));
			console.info(`[创建zip文件] 成功创建zip文件: ${file_path}`);
		} catch (err: any) {
			if (err.code === 'EBUSY') {
				console.error(`文件 ${file_path} 正在被其他程序使用，无法写入。请关闭可能正在使用该文件的程序后重试。`);
				throw err;
			} else {
				throw err;
			}
		}

		// 现在可以安全地删除原始文件
		for (let filePath of filePaths) {
			if (existsSync(filePath)) {
				if (lstatSync(filePath).isDirectory()) {
					readDir(zip, filePath, true);
				} else {
					readFile(zip, filePath, basename(filePath), true);
				}
			}
		}

		return file_path;
	} catch (error) {
		console.error('[创建zip文件] 创建zip文件失败:', error);
		throw error;
	}
};

export const readDir = (zip: JSZip | null, nowPath: string, shouldDelete: boolean = true): void => {
	try {
		let files = readdirSync(nowPath);

		files.forEach(function (fileName, index) {
			let filePath = nowPath + '/' + fileName;
			try {
				let file = statSync(filePath);

				if (file.isDirectory()) {
					let dirlist = zip!.folder(fileName);
					readDir(dirlist, filePath, shouldDelete);
				} else {
					readFile(zip, filePath, fileName, shouldDelete);
				}
			} catch (error: any) {
				if (error.code === 'EBUSY') {
					console.error(`文件 ${filePath} 正在被其他程序使用，无法访问。请关闭可能正在使用该文件的程序后重试。`);
				} else {
					throw error;
				}
			}
		});

		// 只有在shouldDelete为true时才删除目录
		if (shouldDelete && existsSync(nowPath)) {
			try {
				rmdirSync(nowPath);
			} catch (error: any) {
				if (error.code === 'EBUSY') {
					console.error(`目录 ${nowPath} 正在被其他程序使用，无法删除。请关闭可能正在使用该目录的程序后重试。`);
				} else if (error.code === 'ENOTEMPTY') {
					console.warn(`目录 ${nowPath} 不为空，无法删除。这可能是因为某些文件被锁定或正在使用。`);
				} else {
					throw error;
				}
			}
		}
	} catch (error: any) {
		if (error.code === 'EBUSY') {
			console.error(`目录 ${nowPath} 正在被其他程序使用，无法读取。请关闭可能正在使用该目录的程序后重试。`);
		} else {
			throw error;
		}
	}
};

export const readFile = (zip: JSZip | null, filePath: string, fileName: string, shouldDelete: boolean = true): void => {
	if (extname(filePath) === '.html' && fileName !== 'index.html') {
		let newPath = path.join(path.dirname(filePath), `index.html`);
		try {
			renameSync(filePath, newPath);
			filePath = newPath;
			fileName = basename(filePath);
		} catch (error: any) {
			if (error.code === 'EBUSY') {
				console.error(`文件 ${filePath} 正在被其他程序使用，无法重命名。请关闭可能正在使用该文件的程序后重试。`);
			} else {
				throw error;
			}
		}
	}

	try {
		const fileContent = readFileSync(filePath);
		zip!.file(fileName, new Uint8Array(fileContent));
	} catch (error: any) {
		if (error.code === 'EBUSY') {
			console.error(`文件 ${filePath} 正在被其他程序使用，无法读取。请关闭可能正在使用该文件的程序后重试。`);
		} else {
			throw error;
		}
	}

	// 只有在shouldDelete为true时才删除文件
	if (shouldDelete && existsSync(filePath)) {
		try {
			unlinkSync(filePath);
		} catch (error: any) {
			if (error.code === 'EBUSY') {
				console.error(`文件 ${filePath} 正在被其他程序使用，无法删除。请关闭可能正在使用该文件的程序后重试。`);
			} else {
				throw error;
			}
		}
	}
};
