import { ADAPTER_FETCH, ORIENTATION_MAP, PLAYABLE_DEFAULT_CONFIG } from "@/constants";
import { TPlayableConfig, TWebOrientations } from '@/typings';
import { join } from "path";
import { writeToPath } from './file-system';

const getPlayableConfig = (options?: { orientation?: TWebOrientations, languages?: string[] }) => {
  const { orientation, languages } = options || {}

  const playableConfig: TPlayableConfig = {
    playable_orientation: orientation ? ORIENTATION_MAP[orientation] : PLAYABLE_DEFAULT_CONFIG.playable_orientation,
    playable_languages: languages || PLAYABLE_DEFAULT_CONFIG.playable_languages
  }

  return playableConfig
}

export const isObjectString = (str: string) => {
  try {
    const obj = JSON.parse(str);
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  } catch (e) {
    return false;
  }
}

// Replacing XMLHttpRequest
export const removeXMLHttpRequest = (codeStr: string) => {
  return codeStr.replace(/XMLHttpRequest/g, ADAPTER_FETCH)
}

export const exportConfigJson = async (options: {
  destPath: string
  orientation?: TWebOrientations;
  languages?: string[];
  customConfig?: Record<string, any>;
}) => {
  const { destPath, orientation, languages, customConfig } = options
  
  const config = customConfig || getPlayableConfig({
    orientation,
    languages
  })
  
  const configJsonPath = join(destPath, '/config.json')
  writeToPath(configJsonPath, JSON.stringify(config))
}