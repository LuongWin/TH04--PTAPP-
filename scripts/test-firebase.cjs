const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('../.tools/firebase/node_modules/@firebase/rules-unit-testing');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} = require('firebase/auth');

const projectId = 'demo-chatfirebase';
const stamp = { '.sv': 'timestamp' };
let checks = 0;
const check = async (name, callback) => {
  await callback();
  checks++;
  console.log(`PASS ${name}`);
};

async function main() {
  assert.match(
    process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '',
    /^127\.0\.0\.1:/,
    'Only run against local emulators.',
  );
  assert.match(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '',
    /^127\.0\.0\.1:/,
    'An Auth emulator is required.',
  );
  const env = await initializeTestEnvironment({
    projectId,
    database: { rules: fs.readFileSync('database.rules.json', 'utf8') },
  });
  const alice = env
    .authenticatedContext('alice', { email: 'alice@example.test' })
    .database();
  const bob = env
    .authenticatedContext('bob', { email: 'bob@example.test' })
    .database();
  const stranger = env
    .authenticatedContext('mallory', { email: 'mallory@example.test' })
    .database();
  const anonymous = env.unauthenticatedContext().database();
  try {
    await check('anonymous directory read denied', () =>
      assertFails(anonymous.ref('users').get()),
    );
    await check('create own profile with server time', () =>
      assertSucceeds(
        alice.ref('users/alice').set({
          fullName: 'Alice',
          email: 'alice@example.test',
          createdAt: stamp,
        }),
      ),
    );
    await check('Bob creates own profile', () =>
      assertSucceeds(
        bob.ref('users/bob').set({
          fullName: 'Bob',
          email: 'bob@example.test',
          createdAt: stamp,
        }),
      ),
    );
    await check('authenticated directory read allowed', () =>
      assertSucceeds(bob.ref('users').get()),
    );
    await check('other profile modification denied', () =>
      assertFails(bob.ref('users/alice/fullName').set('Fake Alice')),
    );
    await check('profile email spoofing denied', () =>
      assertFails(alice.ref('users/alice/email').set('someone@example.test')),
    );
    await check('profile creation timestamp cannot change', () =>
      assertFails(alice.ref('users/alice/createdAt').set(1)),
    );
    await check('create private chat with existing profiles', () =>
      assertSucceeds(
        alice
          .ref('chats/chat')
          .set({ memberA: 'alice', memberB: 'bob', createdAt: stamp }),
      ),
    );
    await check('third party cannot read metadata', () =>
      assertFails(stranger.ref('chats/chat').get()),
    );
    await check('membership cannot be changed', () =>
      assertFails(alice.ref('chats/chat/memberB').set('mallory')),
    );
    await check('both member indexes created atomically', () =>
      assertSucceeds(
        alice
          .ref()
          .update({ 'userChats/alice/chat': true, 'userChats/bob/chat': true }),
      ),
    );
    await check('fake third member index denied', () =>
      assertFails(alice.ref('userChats/mallory/chat').set(true)),
    );
    await check('another account inbox cannot be read', () =>
      assertFails(bob.ref('userChats/alice').get()),
    );
    await check('sender can send multiline Vietnamese text', () =>
      assertSucceeds(
        alice
          .ref('messages/chat/m1')
          .set({ senderId: 'alice', text: 'Xin chào\nBob!', createdAt: stamp }),
      ),
    );
    await check('receiver can read the new message', async () => {
      const snapshot = await bob.ref('messages/chat/m1').get();
      assert.equal(snapshot.val().text, 'Xin chào\nBob!');
    });
    await check('third party cannot read messages', () =>
      assertFails(stranger.ref('messages/chat').get()),
    );
    await check('third party cannot send messages', () =>
      assertFails(
        stranger
          .ref('messages/chat/fake')
          .set({ senderId: 'mallory', text: 'fake', createdAt: stamp }),
      ),
    );
    await check('member cannot spoof sender', () =>
      assertFails(
        bob
          .ref('messages/chat/fake')
          .set({ senderId: 'alice', text: 'fake', createdAt: stamp }),
      ),
    );
    await check('whitespace-only message denied', () =>
      assertFails(
        alice
          .ref('messages/chat/empty')
          .set({ senderId: 'alice', text: ' \n\t ', createdAt: stamp }),
      ),
    );
    await check('unknown message field denied', () =>
      assertFails(
        alice.ref('messages/chat/extra').set({
          senderId: 'alice',
          text: 'hello',
          createdAt: stamp,
          admin: true,
        }),
      ),
    );
    await check('sent message cannot be overwritten', () =>
      assertFails(alice.ref('messages/chat/m1/text').set('changed')),
    );
    await check('sent message cannot be deleted', () =>
      assertFails(alice.ref('messages/chat/m1').remove()),
    );
    await check(
      'read receipt and new message do not overwrite each other',
      async () => {
        await Promise.all([
          bob.ref('messageReads/chat/bob/m1').set(true),
          alice
            .ref('messages/chat/m2')
            .set({ senderId: 'alice', text: 'Tin mới', createdAt: stamp }),
        ]);
        const [messages, reads] = await Promise.all([
          bob.ref('messages/chat').get(),
          bob.ref('messageReads/chat/bob').get(),
        ]);
        const unread = Object.entries(messages.val()).filter(
          ([id, message]) => message.senderId !== 'bob' && !reads.val()?.[id],
        );
        assert.deepEqual(
          unread.map(([id]) => id),
          ['m2'],
        );
      },
    );
    await check('other account read receipts cannot be modified', () =>
      assertFails(alice.ref('messageReads/chat/bob/m2').set(true)),
    );
    await check('receipt for nonexistent message denied', () =>
      assertFails(bob.ref('messageReads/chat/bob/missing').set(true)),
    );
    await check('presence updated by owner', () =>
      assertSucceeds(alice.ref('presence/alice/connections/device').set(true)),
    );
    await check('presence cannot be overwritten by another account', () =>
      assertFails(bob.ref('presence/alice/connections/device').remove()),
    );
    await check('owner can go offline', () =>
      assertSucceeds(alice.ref('presence/alice/connections/device').remove()),
    );
    await check(
      'realtime listener receives a new message exactly once and stops after unsubscribe',
      async () => {
        let seen = 0;
        let received;
        const arrived = new Promise(resolve => {
          received = resolve;
        });
        const target = bob.ref('messages/chat/realtime');
        const callback = snapshot => {
          if (snapshot.exists()) {
            seen++;
            received();
          }
        };
        target.on('value', callback);
        await alice
          .ref('messages/chat/realtime')
          .set({ senderId: 'alice', text: 'Realtime', createdAt: stamp });
        let timer;
        await Promise.race([
          arrived,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Realtime callback timed out')),
              5000,
            );
          }),
        ]).finally(() => clearTimeout(timer));
        target.off('value', callback);
        assert.equal(seen, 1);
      },
    );
    await check('member can send a location message', () =>
      assertSucceeds(
        alice.ref('messages/chat/location').set({
          senderId: 'alice',
          text: '📍 Vị trí được chia sẻ',
          createdAt: stamp,
          location: { latitude: 10.776889, longitude: 106.700806 },
        }),
      ),
    );
    await check('receiver reads the same coordinates', async () => {
      const snapshot = await bob.ref('messages/chat/location/location').get();
      assert.deepEqual(snapshot.val(), {
        latitude: 10.776889,
        longitude: 106.700806,
      });
    });
    for (const [name, location] of [
      ['latitude out of range', { latitude: 91, longitude: 106 }],
      ['longitude out of range', { latitude: 10, longitude: -181 }],
      ['missing coordinate', { latitude: 10 }],
      ['string coordinate', { latitude: '10', longitude: 106 }],
      [
        'unknown location field',
        { latitude: 10, longitude: 106, tracking: true },
      ],
    ]) {
      await check(`location rejects ${name}`, () =>
        assertFails(
          alice.ref('messages/chat/invalid-location').set({
            senderId: 'alice',
            text: 'Vị trí',
            createdAt: stamp,
            location,
          }),
        ),
      );
    }
  } finally {
    await env.cleanup();
  }

  const app = initializeApp(
    { apiKey: 'demo-key', projectId },
    'auth-integration',
  );
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(
    auth,
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
    { disableWarnings: true },
  );
  try {
    await check('Email/Password registration works', async () => {
      await createUserWithEmailAndPassword(
        auth,
        'signup@example.test',
        'Test-password-123',
      );
      assert.ok(auth.currentUser);
    });
    await check('logout clears current account', async () => {
      await signOut(auth);
      assert.equal(auth.currentUser, null);
    });
    await check('wrong password rejected', async () => {
      await assert.rejects(
        signInWithEmailAndPassword(
          auth,
          'signup@example.test',
          'wrong-password',
        ),
      );
    });
    await check('correct credentials sign in', async () => {
      await signInWithEmailAndPassword(
        auth,
        'signup@example.test',
        'Test-password-123',
      );
      assert.equal(auth.currentUser.email, 'signup@example.test');
    });
  } finally {
    await deleteApp(app);
  }
  console.log(
    `\n${checks} Firebase emulator checks passed. Production was not used.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
