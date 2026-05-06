import { TAdapterRC } from './typings';

export { };

declare global {
  var __adapter_jszip_code__: string
  var __adapter_init_code__: string
  var __adapter_main_code__: string

  var __playable_ads_adapter_global__: {
    isMount: boolean,
    buildFolderPath: string,
    buildConfig: TAdapterRC | null,
  }
}
