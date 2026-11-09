import { AppState } from 'react-native';
import {
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
  type DatabaseReference,
} from 'firebase/database';
import { database } from './firebase';

/** One connection per running app; server cleanup also works after a crash or lost network. */
export function startPresence(uid: string, onError: (error: unknown) => void) {
  let stopped = false;
  let connected = false;
  let foreground = AppState.currentState === 'active';
  let connection: DatabaseReference | null = null;
  let pendingCleanup: Promise<void> = Promise.resolve();
  const lastOnline = ref(database, `presence/${uid}/lastOnline`);

  const report = (error: unknown) => {
    if (!stopped) {
      onError(error);
    }
  };
  const leave = (): Promise<void> => {
    const previous = connection;
    connection = null;
    if (!previous) {
      return pendingCleanup;
    }
    // Queue removal even offline so an unacknowledged online write cannot reappear on reconnect.
    pendingCleanup = update(ref(database), {
      [`presence/${uid}/connections/${previous.key}`]: null,
      [`presence/${uid}/lastOnline`]: serverTimestamp(),
    }).then(() => onDisconnect(previous).cancel());
    pendingCleanup.catch(report);
    return pendingCleanup;
  };

  const enter = async () => {
    if (stopped || !connected || !foreground || connection) {
      return;
    }
    const current = push(ref(database, `presence/${uid}/connections`));
    connection = current;
    try {
      // Attach server cleanup BEFORE advertising this connection as online.
      await onDisconnect(current).remove();
      await onDisconnect(lastOnline).set(serverTimestamp());
      if (stopped || !connected || !foreground || connection !== current) {
        await onDisconnect(current).cancel();
        return;
      }
      await set(current, true);
    } catch (error) {
      if (connection === current) {
        connection = null;
      }
      report(error);
    }
  };

  const unsubscribe = onValue(
    ref(database, '.info/connected'),
    snapshot => {
      connected = snapshot.val() === true;
      if (connected) {
        void enter();
      } else {
        void leave();
      }
    },
    report,
  );
  const appStateSubscription = AppState.addEventListener('change', state => {
    foreground = state === 'active';
    if (foreground) {
      void enter();
    } else {
      void leave();
    }
  });

  return async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    unsubscribe();
    appStateSubscription.remove();
    const cleanup = leave();
    // Offline writes have no acknowledgement; don't prevent signing out while offline.
    if (connected) {
      await Promise.race([
        cleanup.catch(() => undefined),
        new Promise<void>(resolve => setTimeout(resolve, 2500)),
      ]);
    }
  };
}
