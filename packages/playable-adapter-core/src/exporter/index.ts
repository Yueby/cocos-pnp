import { TBuilderOptions, TZipFromSingleFileOptions } from '@/typings';
import { getSingleFilePath } from '@/utils';
import { exportSingleFile as baseExportSingleFile, exportZipFromPkg as baseExportZipFromPkg, exportZipFromSingleFile as baseExportZipFromSingleFile } from './base';

export const exportSingleFile = async (options: TBuilderOptions) => {
	await baseExportSingleFile(getSingleFilePath(), options);
};

export const exportZipFromPkg = async (options: TBuilderOptions) => {
	await baseExportZipFromPkg(options);
};

export const exportZipFromSingleFile = async (options: TZipFromSingleFileOptions) => {
	await baseExportZipFromSingleFile(getSingleFilePath(), options);
};
