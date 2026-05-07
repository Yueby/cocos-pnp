import { promises as fs } from 'fs';
import { dirname } from 'path';

function normalizeWindowsDrivePath(filepath) {
  if (process.platform !== 'win32') {
    return filepath;
  }

  const match = filepath.match(/^\/([a-zA-Z])\/(.*)$/);
  if (!match) {
    return filepath;
  }

  return `${match[1].toUpperCase()}:/${match[2]}`;
}

export default function cocosPluginUpdater(options) {
  const { src, dest } = options;
  return {
    name: 'cocos-plugin-update',
    async closeBundle() {
      if (!src || !dest) {
        return;
      }

      const normalizedDest = normalizeWindowsDrivePath(dest);

      console.log(`cocos-plugin-update copy folder to ${normalizedDest}`);
      console.log('cocos-plugin-update create parent folder...');
      await fs.mkdir(dirname(normalizedDest), { recursive: true });
      console.log('cocos-plugin-update remove old folder...');
      await fs.rm(normalizedDest, { recursive: true, force: true });
      console.log('cocos-plugin-update copy new folder...');
      await fs.cp(src, normalizedDest, { recursive: true });
      console.log('cocos-plugin-update copy folder success');
    }
  };
}
