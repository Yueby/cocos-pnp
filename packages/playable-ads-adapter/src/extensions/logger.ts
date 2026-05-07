export const PACKAGE_NAME = 'playable-ads-adapter';

export type TLogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export type TLogPayload = {
	level: TLogLevel;
	message: string;
};

export const ADAPTER_LOG_EVENT_PREFIX = 'adapter:';

const LOG_LEVEL_LABEL: Record<TLogLevel, string> = {
	debug: '调试',
	log: '日志',
	info: '信息',
	warn: '警告',
	error: '错误'
};

export const getLogPrefix = () => `[${PACKAGE_NAME}]`;

const padTime = (value: number) => value.toString().padStart(2, '0');

export const getLogTime = () => {
	const now = new Date();
	return `${padTime(now.getHours())}:${padTime(now.getMinutes())}:${padTime(now.getSeconds())}`;
};

const formatError = (error: Error) => {
	return error.stack || error.message || String(error);
};

export const formatLogArg = (arg: unknown): string => {
	if (arg instanceof Error) {
		return formatError(arg);
	}

	if (typeof arg === 'string') {
		return arg;
	}

	if (typeof arg === 'undefined') {
		return 'undefined';
	}

	if (arg === null) {
		return 'null';
	}

	try {
		return JSON.stringify(arg);
	} catch (_error) {
		return String(arg);
	}
};

export const formatLogArgs = (args: unknown[]) => args.map(formatLogArg).join(' ');

export const isFormattedAdapterLog = (message: string) => message.startsWith(`${getLogPrefix()}[`);

export const formatLogMessage = (level: TLogLevel, args: unknown[]) => {
	const message = formatLogArgs(args);
	return isFormattedAdapterLog(message) ? message : `${getLogPrefix()}[${LOG_LEVEL_LABEL[level]}][${getLogTime()}] ${message}`;
};

const print = (level: TLogLevel, args: unknown[]) => {
	console[level](formatLogMessage(level, args));
};

export const logger = {
	debug: (...args: unknown[]) => print('debug', args),
	log: (...args: unknown[]) => print('log', args),
	info: (...args: unknown[]) => print('info', args),
	warn: (...args: unknown[]) => print('warn', args),
	error: (...args: unknown[]) => print('error', args)
};

export const withFormattedConsole = async <T>(task: () => Promise<T>) => {
	const originalConsole = {
		debug: console.debug,
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error
	};

	console.debug = (...args: unknown[]) => originalConsole.debug.call(console, formatLogMessage('debug', args));
	console.log = (...args: unknown[]) => originalConsole.log.call(console, formatLogMessage('log', args));
	console.info = (...args: unknown[]) => originalConsole.info.call(console, formatLogMessage('info', args));
	console.warn = (...args: unknown[]) => originalConsole.warn.call(console, formatLogMessage('warn', args));
	console.error = (...args: unknown[]) => originalConsole.error.call(console, formatLogMessage('error', args));

	try {
		return await task();
	} finally {
		console.debug = originalConsole.debug;
		console.log = originalConsole.log;
		console.info = originalConsole.info;
		console.warn = originalConsole.warn;
		console.error = originalConsole.error;
	}
};

export const toAdapterLogEvent = (level: TLogLevel) => `${ADAPTER_LOG_EVENT_PREFIX}${level}` as const;

export const parseAdapterLogLevel = (event: string): TLogLevel | null => {
	if (!event.startsWith(ADAPTER_LOG_EVENT_PREFIX)) {
		return null;
	}

	const level = event.slice(ADAPTER_LOG_EVENT_PREFIX.length) as TLogLevel;
	return ['debug', 'log', 'info', 'warn', 'error'].includes(level) ? level : null;
};

export const createLogPayload = (level: TLogLevel, args: unknown[]): TLogPayload => ({
	level,
	message: formatLogArgs(args)
});
