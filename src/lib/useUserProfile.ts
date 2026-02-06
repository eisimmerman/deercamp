// src/lib/useUserProfile.ts
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

export type UserProfile = {
  uid: string;
  /** User-chosen name shown in UI */
  nickname?: string;
  /** Optional legacy / auth display name */
  displayName?: string;
};

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // User has no profile doc yet
          setProfile({
            uid: user.uid,
            displayName: user.displayName ?? undefined,
          });
          setLoading(false);
          return;
        }

        const data = snap.data();

        setProfile({
          uid: user.uid,
          nickname: typeof data.nickname === "string" ? data.nickname : undefined,
          displayName:
            typeof data.displayName === "string"
              ? data.displayName
              : user.displayName ?? undefined,
        });

        setLoading(false);
      },
      (err) => {
        console.error("useUserProfile error:", err);
        setProfile({
          uid: user.uid,
          displayName: user.displayName ?? undefined,
        });
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { profile, loading };
}
