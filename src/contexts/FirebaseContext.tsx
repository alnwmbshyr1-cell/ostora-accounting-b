import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
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
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<User | null>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  reloadAuthUser: () => Promise<User | null>;
  signOutFirebase: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function formatFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة / Invalid email or password';
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مسجل مسبقاً / Email is already registered';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة (6 أحرف على الأقل) / Password must be at least 6 characters';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة / Invalid email format';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة متكررة، يرجى الانتظار قليلاً / Too many attempts, try again later';
    case 'auth/operation-not-allowed':
      return 'يرجى تفعيل تسجيل الدخول بالبريد/كلمة المرور من Firebase Console / Enable Email/Password in Firebase Console';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم، تحقق من الإنترنت / Network error';
    default:
      return err instanceof Error ? err.message : String(err);
  }
}

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
        setAuthError(formatFirebaseAuthError(err));
      }
      return null;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<User | null> => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        await upsertUserProfile(cred.user);
      }
      return cred.user;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return null;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string): Promise<User | null> => {
      setSigningIn(true);
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (cred.user) {
          if (name.trim()) {
            await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
          }
          await sendEmailVerification(cred.user).catch(() => undefined);
          await upsertUserProfile(cred.user).catch(() => undefined);
        }
        return cred.user;
      } catch (err: unknown) {
        setAuthError(formatFirebaseAuthError(err));
        return null;
      } finally {
        setSigningIn(false);
      }
    },
    [],
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    if (!email.trim()) {
      setAuthError('أدخل البريد الإلكتروني أولاً لاستعادة كلمة المرور / Enter your email first');
      return false;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    }
  }, []);

  const reloadAuthUser = useCallback(async (): Promise<User | null> => {
    if (!auth.currentUser) return null;
    try {
      await reload(auth.currentUser);
      const refreshed = auth.currentUser;
      setUser(refreshed ? ({ ...refreshed } as User) : null);
      if (refreshed?.emailVerified) {
        await upsertUserProfile(refreshed).catch(() => undefined);
      }
      return refreshed;
    } catch {
      return auth.currentUser;
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
        signInWithEmail,
        registerWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        reloadAuthUser,
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
