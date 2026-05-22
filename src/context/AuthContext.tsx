'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';

/**
 * AuthContext for the Hope Admin PWA.
 *
 * Differs from the CRM AuthContext in two ways:
 *   1. We *enforce* `role === 'admin'` (or `isSuperAdmin === true`). Any other
 *      authenticated user is signed out with a friendly "not authorized" error.
 *   2. We don't carry the CRM's sidebar-order or password-management plumbing —
 *      those are CRM-only operational concerns.
 */

export type UserRole = 'admin' | 'staff' | 'audiologist';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  nickname?: string;
  role: UserRole;
  allowedModules?: string[];
  createdAt: number;
  branchId?: string;
  centerId?: string | null;
  centerIds?: string[] | null;
  isSuperAdmin?: boolean;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  /** Returns a fresh Firebase ID token for calling CRM admin APIs. */
  getIdToken: () => Promise<string | null>;
  resetError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetUserPassword: async () => {},
  getIdToken: async () => null,
  resetError: () => {},
});

/** True when the profile is allowed to use the Admin PWA. */
function isAdminProfile(p: UserProfile | null): boolean {
  if (!p) return false;
  if (p.isSuperAdmin === true) return true;
  return String(p.role || '').toLowerCase().trim() === 'admin';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const { auth, db } = await import('@/firebase/config');
        const { onAuthStateChanged, signOut: firebaseSignOut } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');

        if (!auth) {
          setError('Firebase Auth not initialized');
          setLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, async (authUser) => {
          if (!authUser) {
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setUser(authUser);

          if (!db) {
            setError('Database not available');
            setLoading(false);
            return;
          }

          try {
            const snap = await getDoc(doc(db, 'users', authUser.uid));
            if (!snap.exists()) {
              await firebaseSignOut(auth);
              setUser(null);
              setUserProfile(null);
              setError('Not authorized. Ask the super-admin to add your account first.');
              setLoading(false);
              return;
            }

            const profile = snap.data() as UserProfile;
            if (!isAdminProfile(profile)) {
              await firebaseSignOut(auth);
              setUser(null);
              setUserProfile(null);
              setError(
                'This account is not an administrator. The Admin PWA is restricted to admin and super-admin users.',
              );
              setLoading(false);
              return;
            }

            setUserProfile(profile);
            setError(null);
            setLoading(false);
          } catch (err) {
            console.error('[Hope Admin] profile load failed:', err);
            try {
              await firebaseSignOut(auth);
            } catch {
              /* ignore */
            }
            setUser(null);
            setUserProfile(null);
            setError('Failed to load your access profile. Please try again.');
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('[Hope Admin] auth init error:', err);
        setError('Firebase initialization failed');
        setLoading(false);
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const { auth } = await import('@/firebase/config');
      if (!auth) throw new Error('Auth not initialized');
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const code = err?.code || '';
      let message = err?.message || 'Failed to sign in';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        message = 'Email or password is incorrect.';
      }
      setError(message);
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      const { auth, db } = await import('@/firebase/config');
      if (!auth || !db) throw new Error('Firebase not initialized');
      const { GoogleAuthProvider, signInWithPopup, signOut: firebaseSignOut } = await import(
        'firebase/auth'
      );
      const { doc, getDoc } = await import('firebase/firestore');

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (!snap.exists()) {
        await firebaseSignOut(auth);
        throw new Error(
          'This Google account is not yet provisioned in the CRM. Ask the super-admin to add you first.',
        );
      }
      const profile = snap.data() as UserProfile;
      if (!isAdminProfile(profile)) {
        await firebaseSignOut(auth);
        throw new Error(
          'This account is not an administrator. The Admin PWA is restricted to admin users.',
        );
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google');
      throw err;
    }
  }, [router]);

  const signOut = useCallback(async () => {
    try {
      const { auth } = await import('@/firebase/config');
      if (!auth) return;
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(auth);
      router.push('/login');
    } catch (err: any) {
      console.error('[Hope Admin] sign out error:', err);
      setError(err?.message || 'Failed to sign out');
    }
  }, [router]);

  const resetUserPassword = useCallback(async (email: string) => {
    try {
      setError(null);
      const { auth } = await import('@/firebase/config');
      if (!auth) throw new Error('Auth not initialized');
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email');
      throw err;
    }
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const { auth } = await import('@/firebase/config');
      if (!auth?.currentUser) return null;
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const resetError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        signIn,
        signInWithGoogle,
        signOut,
        resetUserPassword,
        getIdToken,
        resetError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
