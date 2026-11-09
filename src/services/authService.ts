import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { get, onValue, ref, serverTimestamp, set } from 'firebase/database';
import type { UserProfile } from '../types/models';
import { auth, database } from './firebase';

export type AuthUser = User;
export const watchAuth = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

export function watchProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `users/${uid}`),
    snapshot => {
      callback(snapshot.exists() ? { ...snapshot.val(), uid } : null);
    },
    onError,
  );
}

export async function completeProfile(user: User, name: string): Promise<void> {
  const fullName = name.trim();
  if (!fullName || fullName.length > 100 || /[\r\n]/.test(fullName)) {
    throw new Error('Họ tên cần từ 1 đến 100 ký tự, trên một dòng.');
  }
  const profileRef = ref(database, `users/${user.uid}`);
  const existing = await get(profileRef);
  if (!existing.exists()) {
    await set(profileRef, {
      fullName,
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
  // The database profile is authoritative; a later sign-in can recover this optional Auth display name.
  await updateProfile(user, {
    displayName: existing.val()?.fullName ?? fullName,
  }).catch(() => undefined);
}

export async function register(
  fullName: string,
  email: string,
  password: string,
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );
  await completeProfile(credential.user, fullName);
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export const logout = () => signOut(auth);
