import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import config from './firebaseConfig.json';

const alreadyInitialized = getApps().length > 0;
export const firebaseApp = alreadyInitialized
  ? getApp()
  : initializeApp(config);
export const auth = alreadyInitialized
  ? getAuth(firebaseApp)
  : initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(
        createAsyncStorage('chatfirebase-auth'),
      ),
    });
export const database = getDatabase(firebaseApp);
