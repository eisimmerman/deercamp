import * as SecureStore from "expo-secure-store";

/**
 * ⚠️ SecureStore key rules:
 * Only [A-Za-z0-9._-] allowed
 * NO slashes, spaces, parentheses, or dynamic values
 */

/* ===============================
   SAFE, HARD-CODED KEYS
================================ */
const QA_SIGNED_IN_KEY = "qa.signed_in";
const QA_NICKNAME_KEY = "qa.nickname";

/* ===============================
   SIGN-IN STATE
================================ */
export async function qaSetSignedIn(value: boolean) {
  await SecureStore.setItemAsync(QA_SIGNED_IN_KEY, value ? "1" : "0");
}

export async function qaIsSignedIn(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(QA_SIGNED_IN_KEY);
  return v === "1";
}

/* ===============================
   NICKNAME
================================ */
export async function qaSetNickname(nickname: string) {
  await SecureStore.setItemAsync(QA_NICKNAME_KEY, nickname);
}

export async function qaGetNickname(): Promise<string | null> {
  return SecureStore.getItemAsync(QA_NICKNAME_KEY);
}

/* ===============================
   RESET (used on Sign Out)
================================ */
export async function qaClear() {
  await SecureStore.deleteItemAsync(QA_SIGNED_IN_KEY);
  await SecureStore.deleteItemAsync(QA_NICKNAME_KEY);
}
