export * from './file-system';
export * from './os';

export function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
