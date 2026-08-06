(function () {
  "use strict";

  const COLLECTION_NAME = "feedItems";
  const DEFAULT_LIMIT = 50;

  function getFirestore() {
    if (
      window.firebase &&
      typeof window.firebase.firestore === "function"
    ) {
      return window.firebase.firestore();
    }

    throw new Error(
      "Firestore is unavailable. Confirm firebase-web.js initialized Firebase before the memory provider."
    );
  }

  function getAdapter() {
    const adapter =
      window.DeerCampFirestoreAdapter;

    if (
      !adapter ||
      typeof adapter.adaptFeedItem !== "function"
    ) {
      throw new Error(
        "The Firestore Memory Adapter is unavailable."
      );
    }

    return adapter;
  }

  function applyMode(items, mode) {
    switch (String(mode || "latest")) {
      case "voice":
        return items.filter(function (item) {
          return Boolean(
            item.audio &&
            item.audio.url
          );
        });

      case "photos":
        return items.filter(function (item) {
          return Boolean(
            item.heroImage &&
            item.heroImage.url
          );
        });

      case "latest":
      case "members":
      case "topics":
      case "search":
      default:
        return items;
    }
  }

  function sortNewestFirst(items) {
    return items
      .slice()
      .sort(function (a, b) {
        return Number(b.createdAtMs || 0) -
          Number(a.createdAtMs || 0);
      });
  }

  async function runPrimaryQuery(
    firestore,
    campId,
    limitCount
  ) {
    return firestore
      .collection(COLLECTION_NAME)
      .where("campId", "==", campId)
      .where("published", "==", true)
      .orderBy("createdAtMs", "desc")
      .limit(limitCount)
      .get();
  }

  async function runFallbackQuery(
    firestore,
    campId,
    limitCount
  ) {
    return firestore
      .collection(COLLECTION_NAME)
      .where("campId", "==", campId)
      .where("published", "==", true)
      .limit(limitCount)
      .get();
  }

  async function load(options = {}) {
    const campId =
      String(options.campId || "").trim();

    if (!campId) {
      throw new Error(
        "A campId is required to load live memories."
      );
    }

    const limitCount = Math.max(
      1,
      Math.min(
        Number(options.limit) || DEFAULT_LIMIT,
        100
      )
    );

    const firestore = getFirestore();
    const adapter = getAdapter();

    let snapshot;

    try {
      snapshot = await runPrimaryQuery(
        firestore,
        campId,
        limitCount
      );
    } catch (error) {
      console.warn(
        "Primary feedItems query failed; retrying without orderBy.",
        error
      );

      snapshot = await runFallbackQuery(
        firestore,
        campId,
        limitCount
      );
    }

    const items = [];

    snapshot.forEach(function (documentSnapshot) {
      const data =
        documentSnapshot.data() || {};

      if (data.published === false) {
        return;
      }

      items.push(
        adapter.adaptFeedItem(
          documentSnapshot.id,
          data
        )
      );
    });

    const sorted =
      sortNewestFirst(items);

    const filtered =
      applyMode(
        sorted,
        options.mode
      );

    if (
      window.DeerCampViewerState &&
      typeof window.DeerCampViewerState
        .setItems === "function"
    ) {
      window.DeerCampViewerState.setItems(
        filtered,
        {
          selectedIndex:
            Number(options.selectedIndex) || 0,
          context: {
            campId,
            mode:
              String(options.mode || "latest"),
            collection: COLLECTION_NAME,
            source: "Firestore"
          }
        }
      );
    }

    return {
      items: filtered,
      total: filtered.length,
      source: "Firestore",
      collection: COLLECTION_NAME,
      campId
    };
  }

  window.DeerCampMemoryProvider = {
    load,
    collectionName: COLLECTION_NAME
  };
})();

