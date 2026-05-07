import { checkImgType, getAllFilesFormDir, getOriginPkgPath, getRCTinify, writeToPath } from "@/utils";
import Axios, { AxiosError } from 'axios';
import { readFileSync } from 'fs';
import path from 'path';

const MAX_CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const TINIFY_REQUEST_TIMEOUT_MS = 60_000;

type TinifyErrorType = 'AccountError' | 'ClientError' | 'ServerError' | 'ConnectionError' | 'UnknownError';

const TINIFY_ERROR_TYPE_LABEL: Record<TinifyErrorType, string> = {
  AccountError: '账户错误',
  ClientError: '客户端错误',
  ServerError: '服务端错误',
  ConnectionError: '连接错误',
  UnknownError: '未知错误',
};

const classifyError = (err: unknown): { type: TinifyErrorType; retryable: boolean; message: string } => {
  if (err instanceof AxiosError) {
    if (!err.response) {
      return { type: 'ConnectionError', retryable: true, message: `网络连接失败: ${err.message}` };
    }
    const status = err.response.status;
    if (status === 401 || status === 429) {
      const detail = status === 429 ? 'API 调用频率超限或月度配额已用尽' : 'API Key 无效或账户异常';
      return { type: 'AccountError', retryable: false, message: `账户错误 (${status}): ${detail}` };
    }
    if (status >= 400 && status < 500) {
      return { type: 'ClientError', retryable: false, message: `客户端错误 (${status}): 请求数据有误` };
    }
    if (status >= 500) {
      return { type: 'ServerError', retryable: true, message: `服务端错误 (${status}): TinyPNG 服务暂时不可用` };
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { type: 'UnknownError', retryable: false, message: msg };
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const postFileToRemote = async (filePath: string, data: Buffer): Promise<void> => {
  const { tinifyApiKey } = getRCTinify();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const uploadRes = await Axios.request({
        method: 'post',
        url: 'https://api.tinify.com/shrink',
        auth: { username: `api:${tinifyApiKey}`, password: '' },
        data,
        timeout: TINIFY_REQUEST_TIMEOUT_MS,
      });

      const fileRes = await Axios.request({
        method: 'get',
        url: uploadRes.data.output.url,
        responseType: 'arraybuffer',
        timeout: TINIFY_REQUEST_TIMEOUT_MS,
      });

      const originalSize = data.length;
      const compressedSize = fileRes.data.length;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      writeToPath(filePath, new Uint8Array(fileRes.data));
      return;
    } catch (err) {
      lastError = err;
      const classified = classifyError(err);

      if (!classified.retryable || attempt === MAX_RETRIES) {
        throw new Error(`[${TINIFY_ERROR_TYPE_LABEL[classified.type]}] ${filePath}: ${classified.message}`);
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[压缩] ${filePath} 第${attempt}次失败（${TINIFY_ERROR_TYPE_LABEL[classified.type]}），${delay}ms 后重试...`);
      await sleep(delay);
    }
  }

  throw lastError;
};

const runWithConcurrency = async <T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<PromiseSettledResult<T>[]> => {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  const worker = async () => {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (err) {
        results[i] = { status: 'rejected', reason: err };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
};

const isUuidSkipped = (filePath: string, skipUuids: string[]): boolean => {
  if (skipUuids.length === 0) return false;
  const baseName = path.basename(filePath, path.extname(filePath));
  return skipUuids.includes(baseName);
};

export const execTinify = async (): Promise<{ success: boolean; msg: string }> => {
  const { tinify, tinifyApiKey, tinifySkipUuids } = getRCTinify();

  if (!tinify) {
    return { success: false, msg: '未开启图片压缩' };
  }

  if (!tinifyApiKey) {
    return { success: false, msg: '请提供 API key, 从这里获取: https://tinify.cn/developers' };
  }

  const originPkgPath = getOriginPkgPath();
  const allImgFiles = getAllFilesFormDir(originPkgPath).filter(checkImgType);

  console.log(`[压缩] 扫描目录: ${originPkgPath}`);
  console.log(`[压缩] 发现 ${allImgFiles.length} 个图片文件`);

  const skippedFiles = allImgFiles.filter(f => isUuidSkipped(f, tinifySkipUuids));
  const files = allImgFiles.filter(f => !isUuidSkipped(f, tinifySkipUuids));

  if (skippedFiles.length > 0) {
    console.log(`[压缩] 跳过 ${skippedFiles.length} 个 UUID 匹配的图片`);
  }

  if (files.length === 0) {
    return { success: true, msg: '未发现需要压缩的图片' };
  }

  console.log(`[压缩] 共发现 ${files.length} 个图片文件，并发数: ${MAX_CONCURRENCY}`);

  const tasks = files.map((filePath) => () => postFileToRemote(filePath, readFileSync(filePath)));
  const results = await runWithConcurrency(tasks, MAX_CONCURRENCY);

  const failed = results
    .map((r, i) => ({ result: r, file: files[i] }))
    .filter((item): item is { result: PromiseRejectedResult; file: string } => item.result.status === 'rejected');

  if (failed.length > 0) {
    for (const { result } of failed) {
      console.error(`[压缩] ${result.reason}`);
    }
    const succeeded = files.length - failed.length;
    return {
      success: false,
      msg: `图片压缩部分失败：${succeeded}/${files.length} 成功，${failed.length} 失败`,
    };
  }

  return { success: true, msg: `压缩完成: ${files.length} 个文件全部成功` };
};
