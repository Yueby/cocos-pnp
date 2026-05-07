const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PLUGIN_NAME = 'playable-ads-adapter';
const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_PACKAGE_ROOT = path.join(REPO_ROOT, 'packages', PLUGIN_NAME);
const PLUGIN_DIST = path.join(PLUGIN_PACKAGE_ROOT, 'dist');
const PLUGIN_BUILD_DIR = path.join(PLUGIN_DIST, PLUGIN_NAME);
const ZIP_PATH = path.join(PLUGIN_DIST, `${PLUGIN_NAME}.zip`);
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
      ...options,
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`命令执行超时：${command} ${args.join(' ')}，已等待 ${BUILD_TIMEOUT_MS / 1000} 秒`));
    }, BUILD_TIMEOUT_MS);

    const finish = (cb, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb(value);
    };

    child.on('error', (error) => finish(reject, error));
    child.on('close', (code) => {
      if (code === 0) {
        finish(resolve);
        return;
      }

      finish(reject, new Error(`命令执行失败：${command} ${args.join(' ')}，退出码 ${code}`));
    });
  });
}

function addDirectoryToZip(zip, sourceDir, baseDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const fullPath = path.join(sourceDir, entry.name);
    const zipEntryName = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      zip.folder(zipEntryName);
      addDirectoryToZip(zip, fullPath, baseDir);
      continue;
    }

    if (entry.isFile()) {
      zip.file(zipEntryName, fs.readFileSync(fullPath));
    }
  }
}

async function createZip() {
  const JSZip = require(require.resolve('jszip', { paths: [PLUGIN_PACKAGE_ROOT] }));
  const zip = new JSZip();

  console.log(`添加待打包文件：${PLUGIN_BUILD_DIR}`);
  addDirectoryToZip(zip, PLUGIN_BUILD_DIR, path.dirname(PLUGIN_BUILD_DIR));

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(ZIP_PATH, content);
}

async function main() {
  console.log('开始打包插件...');

  await run('pnpm', ['run', 'build']);

  if (!fs.existsSync(PLUGIN_BUILD_DIR)) {
    throw new Error(`未找到构建产物：${PLUGIN_BUILD_DIR}`);
  }

  fs.rmSync(ZIP_PATH, { force: true });
  await createZip();

  console.log(`插件包文件：${ZIP_PATH}`);
  console.log('插件打包完成');
  fs.rmSync(PLUGIN_BUILD_DIR, { recursive: true, force: true });

  console.log('临时构建目录已删除');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
