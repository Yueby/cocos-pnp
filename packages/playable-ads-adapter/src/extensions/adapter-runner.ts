import { execAdapter } from "playable-adapter-core";
import { readFileSync } from "fs";

type TLogLevel = "debug" | "log" | "info" | "warn" | "error";

type TAdapterRunnerPayload = {
	buildFolderPath: string;
	adapterBuildConfig: TAdapterRC;
	mode?: "parallel" | "serial";
};

const formatError = (error: Error) =>
	error.stack || error.message || String(error);

const formatLogArg = (arg: unknown): string => {
	if (arg instanceof Error) {
		return formatError(arg);
	}
	if (typeof arg === "string") {
		return arg;
	}
	if (typeof arg === "undefined") {
		return "undefined";
	}
	if (arg === null) {
		return "null";
	}
	try {
		return JSON.stringify(arg);
	} catch (_error) {
		return String(arg);
	}
};

const writeMessage = (message: unknown) => {
	process.stdout.write(`${JSON.stringify(message)}\n`);
};

const createLogPayload = (level: TLogLevel, args: unknown[]) => ({
	level,
	message: args.map(formatLogArg).join(" "),
});

const forwardLog = (level: TLogLevel, args: unknown[]) => {
	writeMessage({
		event: `adapter:${level}`,
		msg: createLogPayload(level, args),
	});
};

const overrideConsole = () => {
	console.debug = (...args: unknown[]) => forwardLog("debug", args);
	console.log = (...args: unknown[]) => forwardLog("log", args);
	console.info = (...args: unknown[]) => forwardLog("info", args);
	console.warn = (...args: unknown[]) => forwardLog("warn", args);
	console.error = (...args: unknown[]) => forwardLog("error", args);
};

const serializeError = (error: unknown) => {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return {
		message: error ? String(error) : "未知错误",
	};
};

const readPayload = (payloadPath: string): TAdapterRunnerPayload => {
	return JSON.parse(readFileSync(payloadPath, "utf-8"));
};

const main = async () => {
	const payloadPath = process.argv[2];
	if (!payloadPath) {
		throw new Error("缺少适配子进程 payload 路径");
	}

	overrideConsole();
	const {
		buildFolderPath,
		adapterBuildConfig,
		mode = "serial",
	} = readPayload(payloadPath);

	await execAdapter(
		{
			buildFolderPath,
			adapterBuildConfig,
		},
		{ mode },
	);

	writeMessage({
		finished: true,
		msg: "success",
		event: "adapter:finished",
	});
};

main().catch((error) => {
	writeMessage({
		finished: false,
		msg: serializeError(error),
		event: "adapter:finished",
	});
	process.exitCode = 1;
});
