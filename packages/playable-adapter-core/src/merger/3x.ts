import { genSingleFile as baseGenSingleFile } from './base';
import {
  get3xSingleFilePath,
} from "@/utils";
import {
  injects3xCode,
} from '@/helpers/injects';
import { TAdapterRC } from "@/typings";

export const genSingleFile = async () => {
  const resp = await baseGenSingleFile({
    injectsCode: injects3xCode,
    singleFilePath: get3xSingleFilePath()
  });

  return resp;
};