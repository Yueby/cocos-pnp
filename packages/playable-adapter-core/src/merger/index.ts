import { genSingleFile as baseGenSingleFile } from './base';
import {
  getSingleFilePath,
} from "@/utils";
import {
  injectsCode,
} from '@/helpers/injects';

export const genSingleFile = async () => {
  const resp = await baseGenSingleFile({
    injectsCode: injectsCode,
    singleFilePath: getSingleFilePath()
  });

  return resp;
};
