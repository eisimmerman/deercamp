// lib/useUserProfile.ts
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/src/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type UserProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  updatedAt?: any;
};

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile({ uid });
        } else {
          const data = snap.data() as any;
          setProfile({
            uid,
            displayName: data?.displayName ?? "",
            email: data?.email ?? "",
            updatedAt: data?.updatedAt,
          });
        }
        setLoading(false);
      },
      () => {
        setProfile({ uid });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  const displayName = useMemo(() => {
    return (
      profile?.displayName?.trim() ||
      auth.currentUser?.displayName?.trim() ||
      "Hunter"
    );
  }, [profile?.displayName]);

  return { profile, displayName, loading };
}
