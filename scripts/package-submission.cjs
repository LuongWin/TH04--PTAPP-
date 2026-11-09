const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const runId = process.argv[2];
if (!/^qa-[a-z0-9]+$/.test(runId || '')) {
  throw new Error('Supply a completed Android QA run ID.');
}
const evidence = path.join(root, '.artifacts/android-e2e', runId);
const report = JSON.parse(
  fs.readFileSync(path.join(evidence, 'report.json'), 'utf8'),
);
if (report.status !== 'passed' || report.videoError) {
  throw new Error(
    'Only package a successful two-emulator test with recordings.',
  );
}
const output = path.join(root, 'submission/TH05-Cham');
for (const directory of ['02-Anh', '03-Video', '04-APK', '05-Kiem-thu']) {
  fs.mkdirSync(path.join(output, directory), { recursive: true });
}
const copy = (source, destination) =>
  fs.copyFileSync(source, path.join(output, destination));
for (const [source, destination] of [
  ['B-registration.png', '01-Dang-ky.png'],
  ['B-home-two-unread.png', '02-Home-chua-doc.png'],
  ['A-contacts-online.png', '03-Danh-ba-online.png'],
  ['B-chat-text-and-location.png', '04-Chat-tin-thuong-va-vi-tri.png'],
]) {
  copy(path.join(evidence, source), `02-Anh/${destination}`);
}
for (const image of [
  '05-Firebase-Data-tin-nhan.png',
  '06-Firebase-Data-vi-tri.png',
]) {
  if (!fs.existsSync(path.join(output, '02-Anh', image))) {
    throw new Error(`Missing genuine Firebase Console screenshot: ${image}`);
  }
  const previousJpeg = path.join(
    output,
    '02-Anh',
    image.replace(/\.png$/, '.jpg'),
  );
  if (fs.existsSync(previousJpeg)) {
    fs.renameSync(
      previousJpeg,
      path.join(evidence, `previous-${path.basename(previousJpeg)}`),
    );
  }
}
copy(
  path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'),
  '04-APK/Cham.apk',
);
copy(path.join(evidence, 'report.json'), '05-Kiem-thu/android-report.json');

const ffmpeg = require('../.tools/video/node_modules/ffmpeg-static');
const ffprobe = require('../.tools/video/node_modules/ffprobe-static').path;
const probe = filename =>
  JSON.parse(
    execFileSync(
      ffprobe,
      ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', filename],
      { encoding: 'utf8' },
    ),
  );
const recordingFiles = ['A', 'B'].map(device =>
  path.join(evidence, `${device}.mp4`),
);
const inputDurations = recordingFiles.map(filename =>
  Number(probe(filename).format.duration),
);
const recordingStarts = report.recordings
  ? report.recordings.map(recording => recording.startedAt)
  : ['A', 'B'].map(
      device =>
        fs.statSync(path.join(evidence, `${device}-recording.log`)).birthtimeMs,
    );
const offset = Math.max(0, (recordingStarts[1] - recordingStarts[0]) / 1000);
const duration = Math.min(75, inputDurations[0] - offset, inputDurations[1]);
if (duration < 60) {
  throw new Error(
    'The demonstration must contain at least 60 seconds of real footage.',
  );
}
const video = path.join(output, '03-Video/demo-2-may-ao.mp4');
console.log(
  `Composing ${duration.toFixed(1)} seconds of synchronized emulator footage.`,
);
const pane = (input, label) =>
  `[${input}:v]scale=540:1200,setsar=1,setpts=PTS-STARTPTS,pad=540:1248:0:48:color=0x153d30,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${label}':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=12[v${input}]`;
execFileSync(
  ffmpeg,
  [
    '-y',
    '-v',
    'warning',
    '-ss',
    offset.toFixed(3),
    '-i',
    recordingFiles[0],
    '-i',
    recordingFiles[1],
    '-filter_complex',
    `${pane(0, 'MAY AO A')} ; ${pane(
      1,
      'MAY AO B',
    )} ; [v0][v1]hstack=inputs=2[v]`,
    '-map',
    '[v]',
    '-an',
    '-t',
    duration.toFixed(3),
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    video,
  ],
  { stdio: 'inherit' },
);
const media = probe(video);
const finalDuration = Number(media.format.duration);
if (finalDuration < 60 || finalDuration > 120) {
  throw new Error(`Unexpected video length: ${finalDuration}s`);
}
fs.writeFileSync(
  path.join(output, '05-Kiem-thu/video.json'),
  JSON.stringify(
    {
      sourceRun: runId,
      durationSeconds: finalDuration,
      width: media.streams[0].width,
      height: media.streams[0].height,
      sourceDurations: inputDurations,
      synchronizationOffsetSeconds: offset,
      edits:
        'Side by side with device labels; original speed; no cuts within the demonstrated interval.',
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(output, 'HUONG_DAN.md'),
  `# Bài thực hành 5 — Chạm\n\n` +
    `- **01-Ma-nguon.zip**: mã nguồn React Native CLI, Firebase JS SDK, React Navigation và luật database. Không chứa node_modules, thư mục build, ios/Pods, cache hay thông tin đăng nhập QA.\n` +
    `- **02-Anh/**: Đăng ký; Home có 2 tin chưa đọc; Danh bạ online; Chat có tin thường và tin vị trí; Firebase Console tab Data.\n` +
    `- **03-Video/demo-2-may-ao.mp4**: ${finalDuration.toFixed(
      1,
    )} giây; hai máy ảo A/B cùng hiển thị; quay app kết nối Firebase thật, phát đúng tốc độ gốc.\n` +
    `- **04-APK/Cham.apk**: APK chạy độc lập không cần Metro, ký bằng debug keystore cho bài thực hành.\n` +
    `- **05-Kiem-thu/**: kết quả kiểm thử Android và thông số video.\n\n` +
    `Vị trí trong demo là tọa độ mô phỏng trên Android Emulator; không phải vị trí cá nhân. Ảnh lấy trực tiếp từ app/Firebase Console.\n\n` +
    `## Chạy mã nguồn\n\nGiải nén 01-Ma-nguon.zip. Cài Node 24.12+ (nhánh 24) hoặc 26+, JDK và Android SDK. Chạy npm install, npm start rồi npm run android trong terminal thứ hai. Xem README.md và FIREBASE_SETUP.md trong mã nguồn.\n\n` +
    `Firebase project: chatfirebase-9600c. Luật trong database.rules.json đã được xuất bản. Dữ liệu demo dùng hai tài khoản QA riêng. Chưa kiểm thử iOS; phạm vi nộp bài là Android.\n`,
);

// Archive source from an explicit allow-through traversal, excluding generated/private directories everywhere.
const ignoredDirectories = new Set([
  'node_modules',
  'build',
  'Pods',
  '.git',
  '.gradle',
  '.cxx',
  '.kotlin',
  '.tools',
  '.artifacts',
  '.agents',
  '.codex',
  '.idea',
  'submission',
  'coverage',
]);
const files = [];
function walk(directory) {
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name));
      }
    } else if (
      entry.isFile() &&
      !/\.log$|^local\.properties$|^\.DS_Store$|^\.xcode\.env\.local$/.test(
        entry.name,
      )
    ) {
      files.push(
        path
          .relative(root, path.join(directory, entry.name))
          .split(path.sep)
          .join('/'),
      );
    }
  }
}
walk(root);
const fileList = path.join(evidence, 'source-files.txt');
fs.writeFileSync(fileList, `${files.join('\n')}\n`);
const sourceArchive = path.join(output, '01-Ma-nguon.zip');
execFileSync(
  'tar',
  ['-a', '-c', '-f', sourceArchive, '-C', root, '-T', fileList],
  { stdio: 'inherit' },
);
const entries = execFileSync('tar', ['-t', '-f', sourceArchive], {
  encoding: 'utf8',
})
  .trim()
  .split(/\r?\n/);
if (
  entries.length !== files.length ||
  entries.some(entry =>
    /(^|\/)(node_modules|build|Pods|\.artifacts|\.tools|\.git|submission)(\/|$)/.test(
      entry,
    ),
  )
) {
  throw new Error('Source archive verification failed.');
}
const deliverables = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(filename);
    } else if (entry.name !== 'manifest.json') {
      const content = fs.readFileSync(filename);
      deliverables.push({
        file: path.relative(output, filename).split(path.sep).join('/'),
        bytes: content.length,
        sha256: crypto.createHash('sha256').update(content).digest('hex'),
      });
    }
  }
}
collect(output);
fs.writeFileSync(
  path.join(output, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceFileCount: files.length,
      deliverables,
    },
    null,
    2,
  ),
);
console.log(`Submission ready: ${output}`);
const completeArchive = path.join(root, 'submission/TH05-Cham-Bo-nop.zip');
execFileSync(
  'tar',
  [
    '-a',
    '-c',
    '-f',
    completeArchive,
    '-C',
    path.dirname(output),
    path.basename(output),
  ],
  { stdio: 'inherit' },
);
console.log(`Complete archive: ${completeArchive}`);
