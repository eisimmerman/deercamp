import { Redirect } from "expo-router";

/**
 * This file defines the base `/entry` route.
 * Without it, Expo Router cannot navigate to "entry" as a segment.
 * We immediately redirect to the main feed.
 */
export default function EntryIndex() {
  return <Redirect href="/entry/feed" />;
}
