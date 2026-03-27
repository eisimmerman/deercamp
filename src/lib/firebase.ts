import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCjw3z52JzomgclqczxJguGGlltlXWU45w",
  authDomain: "deercamp-47c12.firebaseapp.com",
  projectId: "deercamp-47c12",
  storageBucket: "deercamp-47c12.firebasestorage.app",
  messagingSenderId: "343631330837",
  appId: "1:343631330837:web:246adec6a15421c390d81c",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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