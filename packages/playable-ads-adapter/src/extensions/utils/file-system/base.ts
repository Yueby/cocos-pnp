import { readFileSync } from 'fs';

export const getRealPath = (pathStr: string) => {
  let realPath = pathStr;
  // 适配window路径
  if (realPath.indexOf('\\') !== -1) {
    realPath = realPath.replace(/\\/g, '/');
  }

  return realPath;
};

export const readToPath = (filepath: string, encoding?: BufferEncoding) => {
  try {
    const fileBuffer = readFileSync(filepath);
    return fileBuffer.toString(encoding);
  } catch (error) {
    console.error(`读取文件失败 (${filepath}):`, error);
    return '';
  }
};