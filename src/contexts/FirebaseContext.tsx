import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { upsertUserProfile } from '../services/firebaseSync';

export type CloudSyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  syncStatus: CloudSyncStatus;
  lastCloudSyncAt: string | null;
  setSyncStatus: (status: CloudSyncStatus) => void;
  setLastCloudSyncAt: (iso: string | null) => void;
  setAuthError: (msg: string | null) => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutFirebase: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('offline');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await upsertUserProfile(nextUser);
        } catch (err) {
          console.error('Failed to upsert user profile:', err);
        }
      } else {
        setSyncStatus('offline');
      }
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await upsertUserProfile(cred.user);
      }
      return cred.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else {
        setAuthError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutFirebase = useCallback(async () => {
    try {
      await signOut(auth);
      setSyncStatus('offline');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        signingIn,
        authError,
        syncStatus,
        lastCloudSyncAt,
        setSyncStatus,
        setLastCloudSyncAt,
        setAuthError,
        signInWithGoogle,
        signOutFirebase,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
