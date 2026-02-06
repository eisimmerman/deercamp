// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, initializeAuth, type Auth, type AuthError } from "firebase/auth";

/**
 * Firebase config
 */
const firebaseConfig = {
  apiKey: "AIzaSyCjw3z52JzomgclqczxJguGGlltlXWU45w",
  authDomain: "deercamp-47c12.firebaseapp.com",
  projectId: "deercamp-47c12",
  storageBucket: "deercamp-47c12.firebasestorage.app",
  messagingSenderId: "343631330837",
  appId: "1:343631330837:web:246adec6a15421c390d81c",
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Cache auth globally to survive Fast Refresh
const g = globalThis as unknown as {
  __FIREBASE_AUTH__?: Record<string, Auth>;
};

function isAlreadyInitializedError(e: unknown) {
  const err = e as Partial<AuthError>;
  return err?.code === "auth/already-initialized";
}

function buildAuth(): Auth {
  const cached = g.__FIREBASE_AUTH__?.[app.name];
  if (cached) return cached;

  // Pull RN persistence helper dynamically if your firebase version has it.
  // If not, Auth still initializes, but you may see the AsyncStorage warning until you upgrade firebase.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authMod = require("firebase/auth") as any;
  const maybeGetRNP = authMod.getReactNativePersistence;

  const deps =
    typeof maybeGetRNP === "function"
      ? { persistence: maybeGetRNP(AsyncStorage) }
      : undefined;

  try {
    const created = initializeAuth(app, deps);
    g.__FIREBASE_AUTH__ = { ...(g.__FIREBASE_AUTH__ || {}), [app.name]: created };
    return created;
  } catch (e) {
    if (isAlreadyInitializedError(e)) {
      const existing = getAuth(app);
      g.__FIREBASE_AUTH__ = { ...(g.__FIREBASE_AUTH__ || {}), [app.name]: existing };
      return existing;
    }
    throw e;
  }
}

export const auth = buildAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
