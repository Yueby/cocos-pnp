const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PLUGIN_NAME = 'playable-ads-adapter';
const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_PACKAGE_ROOT = path.join(REPO_ROOT, 'packages', PLUGIN_NAME);
const PLUGIN_DIST = path.join(PLUGIN_PACKAGE_ROOT, 'dist');
const PLUGIN_BUILD_DIR = path.join(PLUGIN_DIST, PLUGIN_NAME);
const ZIP_PATH = path.join(PLUGIN_DIST, `${PLUGIN_NAME}.zip`);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
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

  addDirectoryToZip(zip, PLUGIN_BUILD_DIR, path.dirname(PLUGIN_BUILD_DIR));

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(ZIP_PATH, content);
}

async function main() {
  console.log('Packaging the plugin...');

  await run('pnpm', ['run', 'build']);

  if (!fs.existsSync(PLUGIN_BUILD_DIR)) {
    throw new Error(`Build output not found: ${PLUGIN_BUILD_DIR}`);
  }

  fs.rmSync(ZIP_PATH, { force: true });
  await createZip();

  console.log(`Package file: ${ZIP_PATH}`);
  console.log('Packaged the plugin finished.');
  console.log('Remove build folder...');

  fs.rmSync(PLUGIN_BUILD_DIR, { recursive: true, force: true });

  console.log('Remove finished.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
