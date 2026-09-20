(function () {
  "use strict";

  let feedUnsubscribe = null;
  let topLevelEntries = [];
  let legacyEntries = [];

  function timestampToMs(value) {
    if (!value) return Date.now();
    if (typeof value === "number") return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;

    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function formatFeedWhen(createdAtMs) {
    const value = Number(createdAtMs || 0);

    if (!value) {
      return "";
    }

    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return "";
    }
  }

  function mapFeedDoc(doc) {
    const item =
      doc && typeof doc.data === "function"
        ? doc.data()
        : {};

    const createdAtMs = Number(
      item.createdAtMs ||
      item.clientCreatedAt ||
      timestampToMs(item.createdAt)
    );

    const id = String(
      (doc && doc.id) ||
      item.id ||
      item.localMemoryId ||
      `feed-${createdAtMs}`
    ).trim();

    const audioUrl = String(
      item.audioUrl ||
      item.voiceUrl ||
      ""
    ).trim();

    const imageUrl = String(
      item.thumbUrl ||
      item.thumbnailUrl ||
      item.thumbnail ||
      item.displayUrl ||
      item.imageUrl ||
      item.photoUrl ||
      ""
    ).trim();

    const title = String(
      item.title ||
      (audioUrl ? "Field Memory" : "Field Photo")
    ).trim();

    const copy = String(
      item.caption ||
      item.body ||
      item.details ||
      item.description ||
      (audioUrl
        ? "Photo + voice captured in DeerCamp Field Mode."
        : "Photo captured in DeerCamp Field Mode.")
    ).trim();

    const author = String(
      item.authorName ||
      item.author ||
      item.member ||
      "DeerCamp Member"
    ).trim();

    return {
      id,
      room: audioUrl ? "Memory & Voice" : "CampFeed",
      title,
      copy,
      meta: [
        author,
        formatFeedWhen(createdAtMs)
      ].filter(Boolean).join(" • "),
      imageUrl,
      audioUrl,
      createdAtMs,
      published: item.published !== false
    };
  }

  function mapSnapshot(snapshot) {
    const entries = [];

    if (
      !snapshot ||
      typeof snapshot.forEach !== "function"
    ) {
      return entries;
    }

    snapshot.forEach(function (doc) {
      const entry = mapFeedDoc(doc);

      const hasDisplayableContent =
        Boolean(entry.imageUrl) ||
        Boolean(entry.audioUrl) ||
        Boolean(entry.title) ||
        Boolean(entry.copy);

      if (
        hasDisplayableContent &&
        entry.published !== false
      ) {
        entries.push(entry);
      }
    });

    return entries.sort(
      (a, b) =>
        Number(b.createdAtMs || 0) -
        Number(a.createdAtMs || 0)
    );
  }

  function mergeFeedSources(...sources) {
    const byId = new Map();

    sources.forEach(function (source) {
      (Array.isArray(source) ? source : [])
        .forEach(function (entry) {
          if (
            !entry ||
            entry.published === false
          ) {
            return;
          }

          const id = String(
            entry.id || ""
          ).trim();

          const key =
            id ||
            [
              entry.title || "",
              entry.imageUrl || "",
              entry.createdAtMs || ""
            ].join("|");

          const existing =
            byId.get(key);

          if (
            !existing ||
            Number(entry.createdAtMs || 0) >=
              Number(existing.createdAtMs || 0)
          ) {
            byId.set(key, entry);
          }
        });
    });

    return Array.from(
      byId.values()
    ).sort(
      (a, b) =>
        Number(b.createdAtMs || 0) -
        Number(a.createdAtMs || 0)
    );
  }

  function renderLiveFeed() {
    const container =
      document.getElementById("roomFeed");

    if (!container) {
      return;
    }

    const entries =
      mergeFeedSources(
        topLevelEntries,
        legacyEntries
      );

    container.innerHTML = "";

    if (!entries.length) {
      const empty =
        document.createElement("article");

      empty.className =
        "room-engine-feed-card";

      const title =
        document.createElement("h3");

      title.textContent =
        "No CampFeed activity yet";

      const copy =
        document.createElement("p");

      copy.textContent =
        "Photos, voice memories, and other camp activity will appear here when they are shared.";

      empty.append(
        title,
        copy
      );

      container.appendChild(empty);

      return;
    }

    entries.forEach(function (entry) {
      const card =
        document.createElement("article");

      card.className =
        "room-engine-feed-card";

      const room =
        document.createElement("span");

      room.className =
        "room-engine-feed-room";

      room.textContent =
        entry.room || "CampFeed";

      const title =
        document.createElement("h3");

      title.textContent =
        entry.title || "Camp activity";

      const copy =
        document.createElement("p");

      copy.textContent =
        entry.copy || "";

      const meta =
        document.createElement("small");

      meta.textContent =
        entry.meta || "";

      card.append(
        room,
        title,
        copy,
        meta
      );

      container.appendChild(card);
    });
  }

  async function loadFeed(campId) {
    if (
      !campId ||
      !window.firebase ||
      typeof firebase.firestore !== "function"
    ) {
      return;
    }

    const db =
      firebase.firestore();

    const results =
      await Promise.all([
        db.collection("feedItems")
          .where("campId", "==", campId)
          .where("published", "==", true)
          .get()
          .catch(function (error) {
            console.warn(
              "V2 top-level feedItems could not load.",
              error
            );

            return null;
          }),

        db.collection("camps")
          .doc(campId)
          .collection("campfeed")
          .get()
          .catch(function (error) {
            console.warn(
              "V2 legacy CampFeed could not load.",
              error
            );

            return null;
          })
      ]);

    if (results[0]) {
      topLevelEntries =
        mapSnapshot(results[0]);
    }

    if (results[1]) {
      legacyEntries =
        mapSnapshot(results[1]);
    }

    renderLiveFeed();
  }

  function subscribeToFeed(campId) {
    if (
      !campId ||
      !window.firebase ||
      typeof firebase.firestore !== "function"
    ) {
      return false;
    }

    if (
      typeof feedUnsubscribe === "function"
    ) {
      try {
        feedUnsubscribe();
      } catch (error) {}
    }

    const db =
      firebase.firestore();

    const unsubscribers = [];

    unsubscribers.push(
      db.collection("feedItems")
        .where("campId", "==", campId)
        .where("published", "==", true)
        .onSnapshot(
          function (snapshot) {
            topLevelEntries =
              mapSnapshot(snapshot);

            renderLiveFeed();
          },
          function (error) {
            console.warn(
              "V2 realtime feedItems subscription failed.",
              error
            );
          }
        )
    );

    unsubscribers.push(
      db.collection("camps")
        .doc(campId)
        .collection("campfeed")
        .onSnapshot(
          function (snapshot) {
            legacyEntries =
              mapSnapshot(snapshot);

            renderLiveFeed();
          },
          function (error) {
            console.warn(
              "V2 realtime legacy CampFeed subscription failed.",
              error
            );
          }
        )
    );

    feedUnsubscribe =
      function () {
        unsubscribers.forEach(
          function (unsubscribe) {
            if (
              typeof unsubscribe ===
              "function"
            ) {
              try {
                unsubscribe();
              } catch (error) {}
            }
          }
        );
      };

    return true;
  }

  async function start() {
    const room =
      await window.DeerCampRoomEngine.initialize({
        roomId: "campfeed",
        feedItems: []
      });

    if (
      !room ||
      !room.campId
    ) {
      return;
    }

    await loadFeed(room.campId);
    subscribeToFeed(room.campId);
  }

  document.addEventListener(
    "deercamp:room-action",
    function (event) {
      const detail =
        event.detail || {};

      const actionLabel =
        detail.actionType === "view"
          ? "View"
          : "Create";

      console.log(
        "CampFeed action selected:",
        detail.actionType,
        detail.actionId
      );

      alert(
        `${actionLabel} action: ${detail.actionId}`
      );
    }
  );

  window.addEventListener(
    "beforeunload",
    function () {
      if (
        typeof feedUnsubscribe ===
        "function"
      ) {
        try {
          feedUnsubscribe();
        } catch (error) {}
      }
    }
  );

  start().catch(function (error) {
    console.error(
      "CampFeed room initialization failed.",
      error
    );
  });
})();
