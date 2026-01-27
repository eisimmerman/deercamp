import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

export type UserProfile = {
  uid: string;
  email?: string;
  displayName?: string;
};

async function ensureUserDoc(u: { uid: string; email?: string | null }) {
  const ref = firestore().collection("users").doc(u.uid);
  const snap = await ref.get();

  if (!snap.exists()) {
    await ref.set(
      {
        uid: u.uid,
        email: u.email ?? "",
        displayName: "",
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged((u) => {
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      let unsubProfile: null | (() => void) = null;

      (async () => {
        try {
          await ensureUserDoc({ uid: u.uid, email: u.email });

          unsubProfile = firestore()
            .collection("users")
            .doc(u.uid)
            .onSnapshot(
              (snap) => {
                setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
                setLoading(false);
              },
              (err) => {
                console.error("Profile snapshot error", err);
                setProfile(null);
                setLoading(false);
              }
            );
        } catch (err) {
          console.error("ensureUserDoc failed", err);
          setProfile(null);
          setLoading(false);
        }
      })();

      return () => {
        if (unsubProfile) unsubProfile();
      };
    });

    return () => unsubAuth();
  }, []);

  return { profile, loading };
}
