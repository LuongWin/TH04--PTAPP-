const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sdk =
  process.env.ANDROID_HOME ||
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const adb = path.join(
  sdk,
  'platform-tools',
  process.platform === 'win32' ? 'adb.exe' : 'adb',
);
const serials = process.argv.slice(2);
if (!serials.length) {
  serials.push('emulator-5554', 'emulator-5556');
}
if (
  serials.length !== 2 ||
  serials.some(serial => !/^emulator-\d+$/.test(serial)) ||
  serials[0] === serials[1]
) {
  throw new Error('Supply two distinct Android emulator serials.');
}
const runId = `qa-${Date.now().toString(36)}`;
const output = path.join(root, '.artifacts', 'android-e2e', runId);
fs.mkdirSync(output, { recursive: true });
const generatedPassword = `Qa-${crypto
  .randomBytes(10)
  .toString('base64url')}-9`;
const naturalDemo = process.env.CHAT_ANDROID_DEMO === '1';
let accounts = serials.map((serial, index) => ({
  serial,
  name: naturalDemo
    ? ['Minh Anh', 'Bảo Ngọc'][index]
    : `QA Android ${index ? 'B' : 'A'} ${runId.slice(-5)}`,
  email: `android.${index ? 'b' : 'a'}.${runId}@example.test`,
  password: generatedPassword,
}));
if (process.env.CHAT_ANDROID_QA_ACCOUNTS) {
  const previousFile = path.resolve(process.env.CHAT_ANDROID_QA_ACCOUNTS);
  const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
  const previousReport = JSON.parse(
    fs.readFileSync(
      path.join(path.dirname(previousFile), 'report.json'),
      'utf8',
    ),
  );
  if (
    previous.length !== 2 ||
    previous.some(
      account =>
        (!account.name.startsWith('QA Android ') &&
          !['Minh Anh', 'Bảo Ngọc'].includes(account.name)) ||
        !/^android\.[ab]\.qa-[a-z0-9]+@example\.test$/.test(account.email),
    )
  ) {
    throw new Error(
      'Only reuse the dedicated QA accounts created by this script.',
    );
  }
  accounts = previous.map((account, index) => ({
    ...account,
    serial: serials[index],
    created:
      account.created ||
      previousReport.steps.some(
        step =>
          step.ok &&
          step.device === (index ? 'B' : 'A') &&
          step.label === 'Registration opens authenticated tabs',
      ),
  }));
}
const saveAccounts = () =>
  fs.writeFileSync(
    path.join(output, 'accounts.json'),
    JSON.stringify(accounts, null, 2),
  );
fs.writeFileSync(
  path.join(output, 'accounts.json'),
  JSON.stringify(accounts, null, 2),
);
const report = {
  runId,
  startedAt: new Date().toISOString(),
  devices: serials,
  steps: [],
  status: 'running',
};
const devices = serials.map((serial, index) => ({
  serial,
  label: index ? 'B' : 'A',
  sequence: 0,
  directory: `/sdcard/Download/chatfirebase-qa/${runId}`,
}));
const recordVideo = process.env.CHAT_ANDROID_RECORD === '1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const call = (device, args) =>
  execFileSync(adb, ['-s', device.serial, ...args], {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

async function readUntil(device, file, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      return JSON.parse(
        call(device, ['shell', 'cat', `${device.directory}/${file}`]),
      );
    } catch (_error) {
      if (device.runner && device.runner.exitCode !== null) {
        throw new Error(
          `Android test runner exited on ${device.label}; see its instrumentation log.`,
        );
      }
      await sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${device.label}/${file}`);
}

async function send(device, command, label) {
  const sequence = ++device.sequence;
  const local = path.join(output, `command-${device.label}-${sequence}.json`);
  fs.writeFileSync(local, JSON.stringify(command));
  call(device, ['push', local, `${device.directory}/command-${sequence}.tmp`]);
  call(device, [
    'shell',
    'mv',
    `${device.directory}/command-${sequence}.tmp`,
    `${device.directory}/command-${sequence}.json`,
  ]);
  const result = await readUntil(device, `result-${sequence}.json`, 45000);
  if (label) {
    report.steps.push({
      device: device.label,
      label,
      ok: result.ok,
      actual: result.actual,
    });
    console.log(`${result.ok ? 'PASS' : 'FAIL'} [${device.label}] ${label}`);
  }
  if (!result.ok) {
    throw new Error(`${device.label}: ${result.error}`);
  }
  if (result.image) {
    const imagePath = path.join(
      output,
      `${device.label}-${label || `screen-${sequence}`}.png`,
    );
    call(device, ['pull', result.image, imagePath]);
    report.steps.push({ device: device.label, image: imagePath });
  }
  return result;
}

const tap = (device, id) => send(device, { op: 'tap', id });
const type = (device, id, value) => send(device, { op: 'type', id, value });
const assert = (device, id, properties, label) =>
  send(device, { op: 'assert', id, ...properties }, label);
const snapshot = (device, label) => send(device, { op: 'snapshot' }, label);

async function register(device, account) {
  const state = await send(device, { op: 'state' });
  if (state.signedIn && naturalDemo && !account.created) {
    await tap(device, 'tab-settings');
    await send(
      device,
      { op: 'assert', textContains: 'QA Android' },
      'Replacing only the dedicated QA session for a fresh demo',
    );
    await tap(device, 'settings-logout');
    state.signedIn = false;
  }
  if (state.signedIn) {
    await tap(device, 'tab-settings');
    await send(
      device,
      { op: 'assert', text: account.name },
      'Persisted session belongs to the QA account',
    );
    await tap(device, 'tab-home');
    account.created = true;
    saveAccounts();
    return;
  }
  await assert(device, 'login-submit', {}, 'Login screen opens');
  if (account.created) {
    await type(device, 'login-email', account.email);
    await type(device, 'login-password', account.password);
    await tap(device, 'login-submit');
    await assert(device, 'tab-home', {}, 'Existing QA account signs in');
    return;
  }
  await tap(device, 'register-link');
  await type(device, 'register-name', account.name);
  await type(device, 'register-email', account.email);
  await type(device, 'register-password', account.password);
  await type(device, 'register-confirmation', 'does-not-match');
  await tap(device, 'register-submit');
  await send(
    device,
    { op: 'assert', text: 'Mật khẩu nhập lại chưa khớp.' },
    'Registration rejects mismatching passwords',
  );
  await type(device, 'register-confirmation', account.password);
  await tap(device, 'register-submit');
  await assert(device, 'tab-home', {}, 'Registration opens authenticated tabs');
  account.created = true;
  saveAccounts();
}

async function openPartner(device, partner) {
  await tap(device, 'tab-contacts');
  await send(device, {
    op: 'type',
    desc: 'Tìm tên hoặc email…',
    value: partner.email,
  });
  await send(
    device,
    { op: 'assert', desc: `Mở chat với ${partner.name}` },
    'Contact search finds the other registered account',
  );
  await snapshot(device, 'contacts-online');
  await send(device, { op: 'tap', desc: `Mở chat với ${partner.name}` });
  await assert(device, 'chat-status', {}, 'Private chat opens');
}

async function message(device, text, label) {
  await type(device, 'chat-input', text);
  await tap(device, 'chat-send');
  await assert(
    device,
    'chat-input',
    { notContains: text },
    label || 'Message acknowledged and composer cleared',
  );
}

async function main() {
  for (const device of devices) {
    console.log(`Waiting for Android to finish booting on ${device.serial}`);
    const deadline = Date.now() + 300000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        ready =
          call(device, ['shell', 'getprop', 'sys.boot_completed']).trim() ===
            '1' &&
          call(device, ['shell', 'pm', 'path', 'android']).includes('package:');
        if (ready) {
          break;
        }
      } catch (_error) {
        /* A cold-starting emulator may not expose services yet. */
      }
      await sleep(2000);
    }
    if (!ready) {
      throw new Error(`Android did not finish booting on ${device.serial}`);
    }
  }
  for (const device of devices) {
    console.log(`Installing app and Android test APK on ${device.serial}`);
    if (process.env.CHAT_ANDROID_SKIP_INSTALL === '1') {
      for (const packageName of ['com.chatfirebase', 'com.chatfirebase.test']) {
        if (
          !call(device, ['shell', 'pm', 'path', packageName]).includes(
            'package:',
          )
        ) {
          throw new Error(`Required package is not installed: ${packageName}`);
        }
      }
    } else {
      call(device, [
        'install',
        '-r',
        path.join(
          root,
          'android/app/build/outputs/apk/release/app-release.apk',
        ),
      ]);
      call(device, [
        'install',
        '-r',
        path.join(
          root,
          'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk',
        ),
      ]);
    }
    call(device, [
      'shell',
      'pm',
      'grant',
      'com.chatfirebase',
      'android.permission.ACCESS_FINE_LOCATION',
    ]);
    call(device, [
      'shell',
      'pm',
      'grant',
      'com.chatfirebase',
      'android.permission.ACCESS_COARSE_LOCATION',
    ]);
    call(device, ['shell', 'cmd', 'location', 'set-location-enabled', 'true']);
    // Public demonstration coordinates, injected only into the two Android emulators.
    call(device, ['emu', 'geo', 'fix', '106.700806', '10.780889']);
    const log = fs.openSync(
      path.join(output, `${device.label}-instrumentation.log`),
      'w',
    );
    device.runner = spawn(
      adb,
      [
        '-s',
        device.serial,
        'shell',
        'am',
        'instrument',
        '-w',
        '-r',
        '-e',
        'class',
        'com.chatfirebase.ChatDeviceTest',
        '-e',
        'qaRun',
        runId,
        'com.chatfirebase.test/androidx.test.runner.AndroidJUnitRunner',
      ],
      { stdio: ['ignore', log, log], windowsHide: true },
    );
    await readUntil(device, 'ready.json');
  }
  const [a, b] = devices;
  const [accountA, accountB] = accounts;
  await register(a, accountA);
  await register(b, accountB);
  await openPartner(b, accountA);
  await tap(b, 'chat-back');
  await tap(b, 'tab-home');
  await assert(
    b,
    'home-unread',
    { expected: 'Những câu chuyện luôn ở đây.' },
    'Read state starts at zero before sending new messages',
  );
  await tap(a, 'tab-contacts');
  await send(a, {
    op: 'type',
    desc: 'Tìm tên hoặc email…',
    value: accountA.email,
  });
  await send(
    a,
    { op: 'absent', desc: `Mở chat với ${accountA.name}` },
    'Directory excludes the signed-in account',
  );
  await openPartner(a, accountB);
  await assert(
    a,
    'chat-status',
    { expected: 'Đang hoạt động' },
    'Partner online status is realtime',
  );
  await assert(
    a,
    'chat-send',
    { enabled: false },
    'Empty message cannot be sent',
  );
  if (recordVideo) {
    for (const device of devices) {
      device.videoPath = `/sdcard/Download/chatfirebase-qa/${runId}/${device.label}.mp4`;
      device.videoStartedAt = Date.now();
      const log = fs.openSync(
        path.join(output, `${device.label}-recording.log`),
        'w',
      );
      device.recorder = spawn(
        adb,
        [
          '-s',
          device.serial,
          'shell',
          'screenrecord',
          '--size',
          '540x1200',
          '--bit-rate',
          '1500000',
          '--time-limit',
          '100',
          device.videoPath,
        ],
        { stdio: ['ignore', log, log], windowsHide: true },
      );
    }
    console.log('Recording both emulators for 100 seconds.');
    report.recordings = devices.map(device => ({
      serial: device.serial,
      startedAt: device.videoStartedAt,
    }));
    await sleep(2500);
  }
  const first = 'Chiều nay mình ra quán cà phê học bài, bạn đi cùng không?';
  const second = 'Khoảng 4 giờ nhé, mình mang theo laptop.';
  const reply = 'Được nha, gửi mình địa chỉ để lát mình qua nhé.';
  await message(a, first);
  await assert(
    b,
    'home-unread',
    { contains: '1 tin nhắn chưa đọc' },
    'Home unread count becomes 1 in realtime',
  );
  await message(a, second);
  await assert(
    b,
    'home-unread',
    { contains: '2 tin nhắn chưa đọc' },
    'Home unread count increases to 2',
  );
  await snapshot(b, 'home-two-unread');
  await send(b, { op: 'tap', descPrefix: `${accountA.name},` });
  await send(
    b,
    { op: 'assert', text: first },
    'Receiver sees the first message without reloading',
  );
  await send(
    b,
    { op: 'assert', text: second },
    'Receiver sees the latest message',
  );
  await snapshot(b, 'received-chat');
  await message(b, reply, 'Reply sent from the second emulator');
  await send(
    a,
    { op: 'assert', text: reply },
    'Reply arrives in realtime on the first emulator',
  );
  await snapshot(a, 'two-way-chat');
  await tap(a, 'chat-location');
  call(a, ['emu', 'geo', 'fix', '106.700806', '10.780889']);
  await assert(
    a,
    'chat-location',
    { enabled: true, timeout: 30000 },
    'Location message is acknowledged before continuing',
  );
  await send(
    b,
    // Android's emulator GPS converts to NMEA, which can round the final decimal.
    {
      op: 'assert',
      textContains: '10.78088',
      contains: '106.70080',
      timeout: 30000,
    },
    'GPS location arrives on the other emulator',
  );
  await snapshot(b, 'chat-text-and-location');
  await snapshot(a, 'sent-location');
  await tap(b, 'chat-back');
  await assert(
    b,
    'home-unread',
    { expected: 'Những câu chuyện luôn ở đây.' },
    'Opening chat resets unread to zero',
  );
  for (let i = 0; i < 3; i++) {
    await send(b, { op: 'tap', descPrefix: `${accountA.name},` });
    await send(
      b,
      { op: 'count', text: second, count: 1 },
      `No duplicate message after reopening chat ${i + 1}`,
    );
    await tap(b, 'chat-back');
  }
  await send(b, { op: 'home' });
  await assert(
    a,
    'chat-status',
    { notContains: 'Đang hoạt động' },
    'Partner becomes offline when app enters background',
  );
  await snapshot(a, 'partner-offline');
  await send(b, { op: 'launch' });
  await assert(
    a,
    'chat-status',
    { expected: 'Đang hoạt động' },
    'Partner becomes online after reopening',
  );
  await tap(b, 'tab-settings');
  await tap(b, 'settings-logout');
  await assert(b, 'login-submit', {}, 'Logout returns to Login');
  await tap(b, 'register-link');
  await snapshot(b, 'registration');
  await send(b, { op: 'back' });
  await type(b, 'login-email', accountB.email);
  await type(b, 'login-password', 'wrong-password');
  await tap(b, 'login-submit');
  await send(
    b,
    { op: 'assert', text: 'Email hoặc mật khẩu chưa đúng.' },
    'Wrong password displays an error',
  );
  await type(b, 'login-password', accountB.password);
  await tap(b, 'login-submit');
  await assert(b, 'tab-home', {}, 'Correct credentials sign in again');
  report.status = 'passed';
  console.log(`Android two-emulator scenario PASSED. Artifacts: ${output}`);
}

main()
  .catch(error => {
    report.status = 'failed';
    report.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const device of devices) {
      if (device.recorder) {
        console.log(`Finishing ${device.label} screen recording.`);
        await Promise.race([
          new Promise(resolve => {
            if (device.recorder.exitCode !== null) {
              resolve();
            } else {
              device.recorder.once('exit', resolve);
            }
          }),
          sleep(Math.max(0, device.videoStartedAt + 110000 - Date.now())),
        ]);
        try {
          call(device, [
            'pull',
            device.videoPath,
            path.join(output, `${device.label}.mp4`),
          ]);
        } catch (error) {
          report.videoError = error.message;
        }
      }
    }
    for (const device of devices) {
      if (!device.runner) {
        continue;
      }
      try {
        if (device.runner.exitCode === null) {
          await send(device, { op: 'stop' });
          await Promise.race([
            new Promise(resolve => device.runner.once('exit', resolve)),
            sleep(5000),
          ]);
        }
      } catch (_error) {
        device.runner.kill();
      }
      try {
        call(device, [
          'pull',
          device.directory,
          path.join(output, `${device.label}-device`),
        ]);
      } catch (_error) {
        /* Keep the report even if a crashed device cannot export artifacts. */
      }
    }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(output, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(`Report: ${path.join(output, 'report.json')}`);
  });
