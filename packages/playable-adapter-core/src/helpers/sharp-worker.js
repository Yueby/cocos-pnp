const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function resolveSharp(extensionRoot) {
	const req = createRequire(path.join(extensionRoot, "package.json"));
	return req("sharp");
}

function isSupportedImage(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
}

async function compressFile(sharp, filePath, quality) {
	if (!isSupportedImage(filePath)) {
		return "skipped";
	}

	const ext = path.extname(filePath).toLowerCase();
	const input = await fs.promises.readFile(filePath);
	let output;

	if (ext === ".png") {
		output = await sharp(input, { failOn: "none" })
			.png({
				palette: true,
				quality,
				compressionLevel: 9,
				effort: 7,
			})
			.toBuffer();
	} else if (ext === ".webp") {
		output = await sharp(input, { failOn: "none" })
			.webp({
				quality,
				effort: 4,
			})
			.toBuffer();
	} else {
		output = await sharp(input, { failOn: "none" })
			.jpeg({
				quality,
				mozjpeg: true,
			})
			.toBuffer();
	}

	if (output.length < input.length) {
		await fs.promises.writeFile(filePath, output);
		return "compressed";
	}

	return "kept";
}

async function run() {
	const payloadPath = process.argv[2];
	if (!payloadPath) {
		throw new Error("缺少压缩任务参数");
	}

	const payload = JSON.parse(await fs.promises.readFile(payloadPath, "utf-8"));
	const sharp = resolveSharp(payload.extensionRoot);
	const files = Array.isArray(payload.files) ? payload.files : [];
	const quality = Number(payload.quality) || 60;

	const summary = {
		compressed: 0,
		kept: 0,
		skipped: 0,
		failed: [],
	};

	for (const filePath of files) {
		try {
			const status = await compressFile(sharp, filePath, quality);
			summary[status] += 1;
		} catch (error) {
			summary.failed.push({
				filePath,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	process.stdout.write(JSON.stringify(summary));
}

run().catch((error) => {
	console.error(error instanceof Error ? error.stack || error.message : error);
	process.exit(1);
});
