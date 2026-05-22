/**
 * Firebase client initialization for Hope Admin PWA.
 *
 * Mirrors `hearing-hope-crm/src/firebase/config.ts` so admin PWA users
 * share the same auth session if they sign in via the CRM domain origin.
 * In practice, the admin PWA is a separate origin so users sign in here
 * independently — but the project, collections, and rules are identical.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

const sanitize = (v: string | undefined): string | undefined =>
  v ? v.replace(/\n/g, '').replace(/\r/g, '').trim() : v;

const firebaseConfig = {
  apiKey: sanitize(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || 'demo-api-key',
  authDomain:
    sanitize(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
    'demo-project.firebaseapp.com',
  projectId: sanitize(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || 'demo-project',
  storageBucket:
    sanitize(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
    'demo-project.appspot.com',
  messagingSenderId:
    sanitize(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || '123456789',
  appId:
    sanitize(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) ||
    '1:123456789:web:abcdef123456',
  measurementId: sanitize(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

const isConfigValid =
  !!sanitize(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  !!sanitize(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  !!sanitize(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) &&
  sanitize(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) !== 'demo-api-key';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

try {
  if (isConfigValid || process.env.NODE_ENV === 'development') {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    if (!isConfigValid && process.env.NODE_ENV === 'development') {
      console.warn(
        '[Hope Admin] Firebase env vars missing — initializing with demo values for dev only.',
      );
    }
  } else {
    // During production builds, Next.js evaluates client modules while prerendering
    // static pages. Leave Firebase uninitialized until real env vars are present
    // rather than failing the build or printing scary stack traces.
    console.warn('[Hope Admin] Firebase env vars are missing; app will require .env.local at runtime.');
  }
} catch (err) {
  console.error('[Hope Admin] Firebase initialization error:', err);
  app = null;
  db = null;
  auth = null;
  storage = null;
}

if (typeof window !== 'undefined' && auth) {
  setPersistence(auth, browserLocalPersistence).catch((err) =>
    console.warn('[Hope Admin] setPersistence failed:', err),
  );
}

if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' &&
  app &&
  db &&
  auth &&
  storage
) {
  const fsUrl = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_URL;
  if (fsUrl) {
    const [host, portStr] = fsUrl.split(':');
    connectFirestoreEmulator(db, host, parseInt(portStr, 10));
  }
  const authUrl = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (authUrl) {
    connectAuthEmulator(auth, authUrl);
  }
  const storageUrl = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_URL;
  if (storageUrl) {
    const [host, portStr] = storageUrl.split(':');
    connectStorageEmulator(storage, host, parseInt(portStr, 10));
  }
}

export { app, db, auth, storage };
