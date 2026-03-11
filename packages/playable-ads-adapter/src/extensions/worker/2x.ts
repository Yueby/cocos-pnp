import { parentPort, workerData } from 'worker_threads';
import { exec2xAdapter } from 'playable-adapter-core';

const overrideConsole = () => {
  const { log, info, warn, error } = console;
  console.log = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:log',
      msg: args.join(' ')
    });
    log(...args);
  };
  console.info = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:info',
      msg: args.join(' ')
    });
    info(...args);
  };
  console.warn = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:warn',
      msg: args.join(' ')
    });
    warn(...args);
  };
  console.error = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:error',
      msg: args.join(' ')
    });
    error(...args);
  };
};

const task = async () => {
  try {
    overrideConsole();

    const { buildFolderPath, adapterBuildConfig } = workerData;
    await exec2xAdapter({
      buildFolderPath,
      adapterBuildConfig,
    }, {
      mode: 'serial'
    });

    parentPort?.postMessage({
      finished: true,
      msg: 'success',
      event: 'adapter:finished'
    });
  } catch (error) {
    parentPort?.postMessage({
      finished: false,
      msg: error,
      event: 'adapter:finished'
    });
  }
};
task();