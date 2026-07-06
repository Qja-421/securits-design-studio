import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getFirestore, Timestamp } from 'firebase/firestore';

const env = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
} satisfies FirebaseOptions;

const requiredKeys = Object.entries(firebaseConfig).filter(([, value]) => !value);

if (requiredKeys.length > 0) {
  const missing = requiredKeys.map(([key]) => key).join(', ');
  throw new Error(`Missing Firebase environment variables: ${missing}`);
}

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);

export type LicenseStatus = 'active' | 'expired' | 'suspended';

export type LicenseRecord = {
  client: string;
  expirationDate: Timestamp | Date | number;
  status: LicenseStatus;
  maxSeats: number;
  createdAt: Timestamp | Date | number;
};

export type LicenseCache = {
  key: string;
  client: string;
  validatedAt: number;
};
