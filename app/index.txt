import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/useAuth";

export default function AppEntry() {
  const router = useRouter();
  const { initializing, user } = useAuth();
  const signedIn = !!user && !user.isAnonymous;

  useEffect(() => {
    if (initializing) return;

    if (signedIn) {
      router.replace("/(tabs)");
    } else {
      router.replace("/sign-in");
    }
  }, [initializing, signedIn, router]);

  return null;
}