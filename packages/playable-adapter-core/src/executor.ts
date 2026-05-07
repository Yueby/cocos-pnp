import { mountGlobalVars, unmountGlobalVars } from "@/global";
import { execTinify } from "@/helpers/tinify";
import { genSingleFile } from '@/merger';
import { genChannelsPkg } from '@/packager';
import { TMode } from "@/packager/base";
import { TAdapterRC } from "@/typings";
import { getAdapterRCJson } from "@/utils";

type TOptions = {
  buildFolderPath: string,
  adapterBuildConfig?: TAdapterRC | null;
};

export const execAdapter = async (options: TOptions, config?: { mode: TMode; }) => {
  mountGlobalVars(options);
  try {
    try {
      console.log('【执行图片压缩】');
      const { success, msg } = await execTinify();
      if (!success) {
        console.warn(`${msg}，跳过图片压缩`);
      } else {
        console.log('图片压缩完成');
      }
    } catch (error) {
      console.error('图片压缩失败:', error);
    }

    console.log('【生成单文件】');
    const { resMapper, compDiff } = await genSingleFile();
    console.log('单文件生成完成');

    const { orientation = 'auto', lang } = getAdapterRCJson() || {};
    const { mode = 'parallel' } = config ?? { mode: 'parallel' };

    console.log('【生成渠道包】');
    await genChannelsPkg({
      orientation,
      resMapper,
      compDiff,
      lang
    }, mode);
    console.log('渠道包生成完成');
  } finally {
    unmountGlobalVars();
  }
};
