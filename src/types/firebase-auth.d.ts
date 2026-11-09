import 'firebase/auth';
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

// Firebase exposes this at runtime through its React Native entry, but its
// top-level declaration file currently describes the web entry instead.
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
