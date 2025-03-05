import { execTinify } from "@/helpers/tinify";
import { genSingleFile as gen2xSingleFile } from '@/merger/2x';
import { genSingleFile as gen3xSingleFile } from '@/merger/3x';
import { genChannelsPkg as gen2xChannelsPkg } from '@/packager/2x';
import { genChannelsPkg as gen3xChannelsPkg } from '@/packager/3x';
import { TMode } from "@/packager/base";
import { TAdapterRC } from "@/typings";
import { getAdapterRCJson } from "@/utils";
import { mountGlobalVars, unmountGlobalVars } from "@/global";

type TOptions = {
  buildFolderPath: string,
  adapterBuildConfig?: TAdapterRC | null;
};

export const exec2xAdapter = async (options: TOptions, config?: { mode: TMode; }) => {
  console.info('[构建] 开始构建 2.x 版本');
  mountGlobalVars(options);
  try {
    console.info('[压缩] 开始压缩图片');
    const { success, msg } = await execTinify();
    if (!success) {
      console.warn(`[压缩] ${msg}，跳过图片压缩`);
    } else {
      console.info('[压缩] 图片压缩完成');
    }
  } catch (error) {
    console.error('[压缩] 压缩失败:', error);
  }

  console.info('[合并] 开始生成单文件');
  const { resMapper, compDiff } = await gen2xSingleFile();
  console.info('[合并] 单文件生成完成');

  const { orientation = 'auto' } = getAdapterRCJson() || {};
  const { mode = 'parallel' } = config ?? { mode: 'parallel' };

  console.info('[打包] 开始生成渠道包');
  await gen2xChannelsPkg({
    orientation,
    resMapper,
    compDiff
  }, mode);
  console.info('[打包] 渠道包生成完成');

  unmountGlobalVars();
  console.info('[构建] 构建完成');
};

export const exec3xAdapter = async (options: TOptions, config?: { mode: TMode; }) => {
  mountGlobalVars(options);
  try {
    console.info('【执行图片压缩】');
    const { success, msg } = await execTinify();
    if (!success) {
      console.warn(`${msg}，跳过图片压缩`);
    } else {
      console.info('图片压缩完成');
    }
  } catch (error) {
    console.error('图片压缩失败:', error);
  }

  console.info('【生成单文件】');
  const { resMapper, compDiff } = await gen3xSingleFile();
  console.info('单文件生成完成');

  const { orientation = 'auto' } = getAdapterRCJson() || {};
  const { mode = 'parallel' } = config ?? { mode: 'parallel' };

  console.info('【生成渠道包】');
  await gen3xChannelsPkg({
    orientation,
    resMapper,
    compDiff
  }, mode);
  console.info('渠道包生成完成');

  unmountGlobalVars();
};
