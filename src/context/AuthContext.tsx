import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { UserProfile } from '../types/models';
import * as authService from '../services/authService';
import { startPresence } from '../services/presenceService';
import { errorMessage } from '../services/errors';

type AuthState = {
  user: authService.AuthUser | null;
  profile: UserProfile | null;
  initializing: boolean;
  profileLoading: boolean;
  profileError: string | null;
  presenceError: string | null;
  registering: boolean;
  register: typeof authService.register;
  signOut: () => Promise<void>;
  retryProfile: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<authService.AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [revision, setRevision] = useState(0);
  const stopPresence = useRef<(() => Promise<void>) | null>(null);

  useEffect(
    () =>
      authService.watchAuth(next => {
        setProfile(null);
        setProfileLoading(Boolean(next));
        setProfileError(null);
        setUser(next);
        setInitializing(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    setProfileLoading(true);
    setProfileError(null);
    const unsubscribe = authService.watchProfile(
      user.uid,
      next => {
        if (active) {
          setProfile(next);
          setProfileLoading(false);
        }
      },
      error => {
        if (active) {
          setProfileError(errorMessage(error));
          setProfileLoading(false);
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user, revision]);

  const presenceUid = profile?.uid;
  useEffect(() => {
    setPresenceError(null);
    if (!presenceUid) {
      return;
    }
    let active = true;
    const stop = startPresence(presenceUid, error => {
      if (active) {
        setPresenceError(errorMessage(error));
      }
    });
    stopPresence.current = stop;
    return () => {
      active = false;
      if (stopPresence.current === stop) {
        stopPresence.current = null;
      }
      void stop();
    };
  }, [presenceUid, revision]);

  const signOut = useCallback(async () => {
    await stopPresence.current?.();
    stopPresence.current = null;
    await authService.logout();
  }, []);
  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setRegistering(true);
      try {
        await authService.register(name, email, password);
      } finally {
        setRegistering(false);
      }
    },
    [],
  );
  const retryProfile = useCallback(() => setRevision(value => value + 1), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        initializing,
        profileLoading,
        profileError,
        presenceError,
        registering,
        register,
        signOut,
        retryProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider is missing.');
  }
  return value;
}
