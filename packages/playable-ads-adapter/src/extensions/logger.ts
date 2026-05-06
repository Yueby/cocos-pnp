export const PACKAGE_NAME = 'playable-ads-adapter';

export type TLogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export type TLogPayload = {
	level: TLogLevel;
	message: string;
};

export const ADAPTER_LOG_EVENT_PREFIX = 'adapter:';

export const getLogPrefix = () => `[${PACKAGE_NAME}]`;

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

const print = (level: TLogLevel, args: unknown[]) => {
	console[level](getLogPrefix(), ...args);
};

export const logger = {
	debug: (...args: unknown[]) => print('debug', args),
	log: (...args: unknown[]) => print('log', args),
	info: (...args: unknown[]) => print('info', args),
	warn: (...args: unknown[]) => print('warn', args),
	error: (...args: unknown[]) => print('error', args)
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
