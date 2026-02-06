import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export function useAuth() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });

    return unsub;
  }, []);

  return { initializing, user };
}
