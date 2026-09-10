import { getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
// @ts-ignore - Firebase React Native persistence is runtime-valid but may be missing from TS resolution.
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const productionFirebaseConfig = {
  apiKey: "AIzaSyCjw3z52JzomgclqczxJguGGlltlXWU45w",
  authDomain: "deercamp-47c12.firebaseapp.com",
  projectId: "deercamp-47c12",
  storageBucket: "deercamp-47c12.firebasestorage.app",
  messagingSenderId: "343631330837",
  appId: "1:343631330837:web:246adec6a15421c390d81c",
};

const stagingFirebaseConfig = {
  apiKey: "AIzaSyAmRaOMp_uwtIOoIqXI-BwWvn03meL16rs",
  authDomain: "deercamp-staging.firebaseapp.com",
  projectId: "deercamp-staging",
  storageBucket: "deercamp-staging.firebasestorage.app",
  messagingSenderId: "671704622402",
  appId: "1:671704622402:web:4be041fc784b05e07a54db",
};

const firebaseConfig = __DEV__
  ? stagingFirebaseConfig
  : productionFirebaseConfig;

const firebaseAppName = __DEV__ ? "deercamp-staging-mobile" : "[DEFAULT]";
const existingApp = getApps().find((candidate) => candidate.name === firebaseAppName);

const app = existingApp
  ? existingApp
  : __DEV__
    ? initializeApp(firebaseConfig, firebaseAppName)
    : initializeApp(firebaseConfig);

const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;