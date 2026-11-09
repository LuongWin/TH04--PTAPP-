const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major >= 26 || (major === 24 && minor >= 12);
const localNode = path.join(
  root,
  '.tools',
  'node',
  'node_modules',
  'node',
  'bin',
  process.platform === 'win32' ? 'node.exe' : 'node',
);
const runtime = supported
  ? process.execPath
  : fs.existsSync(localNode)
  ? localNode
  : null;
if (!runtime) {
  console.error(
    'Cần Node 24.12+ (nhánh 24) hoặc Node 26+. Có thể cài công cụ riêng: npm install --prefix .tools/node node@24',
  );
  process.exit(1);
}
const command = process.argv[2];
const commands = {
  start: ['node_modules/react-native/cli.js', 'start'],
  android: ['node_modules/react-native/cli.js', 'run-android'],
  ios: ['node_modules/react-native/cli.js', 'run-ios'],
  test: ['node_modules/jest/bin/jest.js'],
  lint: [
    'node_modules/eslint/bin/eslint.js',
    '.',
    '--ext',
    '.js,.cjs,.ts,.tsx',
    '--max-warnings',
    '0',
  ],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit'],
  'test:android': ['scripts/test-android.cjs'],
  'test:firebase': [
    '.tools/firebase/node_modules/firebase-tools/lib/bin/firebase.js',
    'emulators:exec',
    '--project',
    'demo-chatfirebase',
    '--config',
    'firebase.test.json',
    '--only',
    'auth,database',
    'node scripts/test-firebase.cjs',
  ],
};
if (!commands[command]) {
  console.error('Lệnh không được hỗ trợ.');
  process.exit(1);
}
const [entry, ...args] = commands[command];
if (!fs.existsSync(path.join(root, entry))) {
  console.error(
    command === 'test:firebase'
      ? 'Cài công cụ kiểm thử: npm install --prefix .tools/firebase firebase-tools @firebase/rules-unit-testing'
      : 'Hãy chạy npm install trước.',
  );
  process.exit(1);
}
const env = { ...process.env };
const pathKey =
  Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = `${path.dirname(runtime)}${path.delimiter}${env[pathKey] ?? ''}`;
const result = spawnSync(
  runtime,
  [path.join(root, entry), ...args, ...process.argv.slice(3)],
  { cwd: root, env, stdio: 'inherit' },
);
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
