import { REPLACE_SYMBOL, REPLACE_SYMBOL_2, TO_SKIP_EXTNAME, TO_STRING_EXTNAME } from "@/constants";
import { readdirSync, statSync } from "fs";
import { lookup } from "mime-types";
import path, { extname } from "path";
import { removeXMLHttpRequest } from "../extends";
import { getAllFilesFormDir, readToPath, writeToPath } from "./base";

type TResourceData = { [key: string]: string }

type TResZipInfo = {
  key: string,
  ratio: number,
}

export const getRealPath = (pathStr: string) => {
  let realPath = pathStr
  // To adapt paths for Windows, use backslashes (\) as separators.
  if (realPath.indexOf('\\') !== -1) {
    realPath = realPath.replace(/\\/g, '/')
  }

  return realPath
}

// Replace global variables.
export const replaceGlobalSymbol = (dirPath: string, replaceText: string, langText?: string) => {
  const fileList = readdirSync(dirPath)
  fileList.forEach((file) => {
    const absPath = path.join(dirPath, file)
    const statInfo = statSync(absPath)
    // If it is a directory, recursively search downward for files.
    if (statInfo.isDirectory()) {
      replaceGlobalSymbol(absPath, replaceText, langText)
    } else if (statInfo.isFile() && path.extname(file) === '.js') {
      let dataStr = readToPath(absPath, 'utf-8')
      let hasChanges = false
      
      if (dataStr.indexOf(REPLACE_SYMBOL) !== -1) {
        dataStr = dataStr.replaceAll(REPLACE_SYMBOL, replaceText)
        hasChanges = true
      }
      
      if (langText && dataStr.indexOf(REPLACE_SYMBOL_2) !== -1) {
        dataStr = dataStr.replaceAll(REPLACE_SYMBOL_2, langText)
        hasChanges = true
      }
      
      if (hasChanges) {
        writeToPath(absPath, dataStr)
      }
    }
  })
}

// Determine if the image type is supported for upload: supported `true`, not supported `false`.
export const checkImgType = (name: string) => {
  let extname = lookup(name)
  if (typeof extname === 'boolean') {
    return false
  }
  return /(gif|jpg|jpeg|png|webp|image)/i.test(extname)
}

export const getBase64FromFile = (filePath: string) => {
  let data = readToPath(filePath, 'base64')
  return `data:${lookup(filePath)};base64,${data}`
}

export const getTargetResData = (filePath: string) => {
  let resData: string = ''
  const fileExtname = extname(filePath)

  if (!fileExtname) {
    return ''
  }

  if (TO_STRING_EXTNAME.includes(fileExtname)) {
    resData = readToPath(filePath, 'utf-8')
  } else {
    resData = getBase64FromFile(filePath)
  }

  return resData
}

export const getResourceMapper = async (options: {
  dirPath: string
  skipFiles?: Array<string>
  mountCbFn?: (objKey: string, data: string) => string // single file mount callback function
  unmountCbFn?: (objKey: string, data: string) => void // single file unmount callback function
  rmHttp?: boolean
  lang?: string // Add language parameter
}) => {
  const { dirPath, rmHttp = false, unmountCbFn, mountCbFn, skipFiles = [], lang } = options

  let resMapper: TResourceData = {}

  // To iterate through each file and determine whether to decompress based on the compression ratio of each file
  const resFiles = getAllFilesFormDir(dirPath)
  for (let index = 0; index < resFiles.length; index++) {
    const filePath = resFiles[index];
    const fileExtname = extname(filePath)

    // To remove unnecessary file extensions
    if (TO_SKIP_EXTNAME.includes(fileExtname)) {
      continue
    }

    // To remove unnecessary files
    if (skipFiles.length > 0 && skipFiles.includes(filePath)) {
      continue
    }

    // To remove unnecessary path prefixes from file paths
    const readPkgPath = getRealPath(`${dirPath}/`)
    const objKey = getRealPath(filePath).replace(readPkgPath, '')

    let data = getTargetResData(filePath)
    if (mountCbFn) {
      data = mountCbFn(objKey, data)
    }

    if (rmHttp && fileExtname === '.js') {
      data = removeXMLHttpRequest(data)
    }

    // Replace language placeholder if lang is provided
    if (lang && data.indexOf(REPLACE_SYMBOL_2) !== -1) {
      data = data.replaceAll(REPLACE_SYMBOL_2, lang)
    }

    resMapper[objKey] = data

    unmountCbFn && unmountCbFn(objKey, data)
  }

  return {
    resMapper
  }
}