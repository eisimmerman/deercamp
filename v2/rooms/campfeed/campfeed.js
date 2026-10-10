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

    const elapsed = Math.max(0, Date.now() - value);
    const minutes = Math.floor(elapsed / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  function formatAuthorName(value) {
    const author =
      String(value || "").trim();

    if (!author) {
      return "DeerCamp Member";
    }

    if (!author.includes("@")) {
      return author;
    }

    return author
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (character) {
        return character.toUpperCase();
      });
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

    const author = formatAuthorName(
      item.authorName ||
      item.author ||
      item.member ||
      "DeerCamp Member"
    );

    return {
      id,
      room: String(item.room || "").toLowerCase() === "campfeed" ? "CampFeed" : (audioUrl ? "Memories Room" : "CampFeed"),
      title,
      copy,
      author,
      when: formatFeedWhen(createdAtMs),
      meta: [
        author,
        formatFeedWhen(createdAtMs)
      ].filter(Boolean).join(" \u2022 "),
      imageUrl,
      audioUrl,
      mediaType: item.mediaType || "",
      type: item.type || "",
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

  function renderCampFeedStats() {
    const entries =
      mergeFeedSources(
        topLevelEntries,
        legacyEntries
      );

    const now = new Date();

    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();

    const weekStartDate =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const daysSinceMonday =
      (weekStartDate.getDay() + 6) % 7;

    weekStartDate.setDate(
      weekStartDate.getDate() - daysSinceMonday
    );

    const weekStart =
      weekStartDate.getTime();

    let conversations = 0;
    let voice = 0;
    let photos = 0;
    let memories = 0;
    let thisWeek = 0;
    let today = 0;

    entries.forEach(function (entry) {
      const isMemory =
        String(entry.mediaType || "").toLowerCase() === "memory" ||
        String(entry.type || "").toLowerCase() === "memory";

      const hasVoice =
        Boolean(entry.audioUrl);

      const hasPhoto =
        Boolean(entry.imageUrl);

      if (isMemory) {
        memories += 1;
      } else if (hasVoice) {
        voice += 1;
      } else if (hasPhoto) {
        photos += 1;
      } else {
        conversations += 1;
      }

      const createdAtMs =
        Number(entry.createdAtMs || 0);

      if (
        createdAtMs >= weekStart &&
        createdAtMs <= now.getTime()
      ) {
        thisWeek += 1;
      }

      if (
        createdAtMs >= todayStart &&
        createdAtMs <= now.getTime()
      ) {
        today += 1;
      }
    });

    const values = {
      campfeedStatConversations: conversations,
      campfeedStatVoice: voice,
      campfeedStatPhotos: photos,
      campfeedStatMemories: memories,
      campfeedStatWeek: thisWeek,
      campfeedStatToday: today
    };

    Object.keys(values).forEach(
      function (id) {
        const element =
          document.getElementById(id);

        if (element) {
          element.textContent =
            String(values[id]);
        }
      }
    );
  }
  function renderLiveFeed() {
    renderCampFeedStats();
    const container =
      document.getElementById("roomFeed");

    if (!container) {
      return;
    }

    const entries =
      mergeFeedSources(
        topLevelEntries,
        legacyEntries
      ).slice(0, 3);

    container.innerHTML = "";

    if (!entries.length) {
      return;
    }

    entries.forEach(function (entry) {
      const card =
        document.createElement("article");

      card.className =
        "campfeed-live-card";

      if (entry.imageUrl) {
        const image =
          document.createElement("img");

        image.className =
          "campfeed-live-image";

        image.src =
          entry.imageUrl;

        image.alt =
          entry.title || "CampFeed photo";

        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute(
          "aria-label",
          "Open " + (entry.title || "CampFeed photo")
        );

        const openPhoto = function () {
          if (
            window.DeerCampUniversalViewer &&
            typeof window.DeerCampUniversalViewer.show === "function"
          ) {
            window.DeerCampUniversalViewer.show({
              kicker: "CAMPFEED",
              title: (
                String(entry.mediaType || "").toLowerCase() === "memory" ||
                String(entry.type || "").toLowerCase() === "memory"
              ) ? "Memory / Story" : "Photo Share",
              items: [entry],
              startIndex: 0
            });
          }
        };

        image.addEventListener("click", openPhoto);
        image.addEventListener("keydown", function (event) {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openPhoto();
          }
        });
        card.appendChild(image);
      }
      if (entry.audioUrl) {
        card.classList.add("campfeed-live-card-audio");
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute(
          "aria-label",
          "Open voice story " + (entry.title || "Voice Story")
        );

        const openVoiceStory = function () {
          if (
            window.DeerCampUniversalViewer &&
            typeof window.DeerCampUniversalViewer.show === "function"
          ) {
            window.DeerCampUniversalViewer.show({
              kicker: "CAMPFEED",
              title: "Voice Story",
              items: [entry],
              startIndex: 0
            });
          }
        };

        card.addEventListener("click", openVoiceStory);
        card.addEventListener("keydown", function (event) {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openVoiceStory();
          }
        });
      }
      if (
        !entry.imageUrl &&
        !entry.audioUrl &&
        (
          String(entry.mediaType || "").toLowerCase() === "memory" ||
          String(entry.type || "").toLowerCase() === "memory"
        )
      ) {
        card.classList.add("campfeed-live-card-memory");
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute(
          "aria-label",
          "Open memory " + (entry.title || "Camp Memory")
        );

        const openMemoryStory = function () {
          if (
            window.DeerCampUniversalViewer &&
            typeof window.DeerCampUniversalViewer.show === "function"
          ) {
            window.DeerCampUniversalViewer.show({
              kicker: "CAMPFEED",
              title: "Memory / Story",
              items: [entry],
              startIndex: 0
            });
          }
        };

        card.addEventListener("click", openMemoryStory);
        card.addEventListener("keydown", function (event) {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openMemoryStory();
          }
        });
      }
      const content =
        document.createElement("div");

      content.className =
        "campfeed-live-content";

      const identity =
        document.createElement("div");

      identity.className =
        "campfeed-live-identity";

      const avatar =
        document.createElement("span");

      avatar.className =
        "campfeed-live-avatar";

      const author =
        document.createElement("strong");

      author.className =
        "campfeed-live-author";

      author.textContent =
        entry.author || "DeerCamp Member";

      const room =
        document.createElement("span");

      room.className =
        "campfeed-live-room";

      room.textContent =
        entry.room || "CampFeed";

      const when =
        document.createElement("small");

      when.className =
        "campfeed-live-when";

      when.textContent =
        entry.when || "";

      identity.append(
        avatar,
        author,
        room,
        when
      );

      const title =
        document.createElement("h3");

      title.textContent =
        entry.title || "Camp activity";

      const copy =
        document.createElement("p");

      copy.textContent =
        entry.copy || "";

      const actions =
        document.createElement("div");

      actions.className =
        "campfeed-live-actions";

      actions.innerHTML =
        '<span>Comment</span><span>Like</span><span>Save</span><span aria-hidden="true">&bull;&bull;&bull;</span>';

      content.append(
        identity,
        title,
        copy,
        actions
      );

      card.appendChild(content);
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

            const currentUser =
              window.firebase &&
              typeof firebase.auth === "function"
                ? firebase.auth().currentUser
                : null;

            const permissionDenied =
              error &&
              (
                error.code === "permission-denied" ||
                String(error.message || "")
                  .toLowerCase()
                  .includes("insufficient permissions")
              );

            if (!currentUser && permissionDenied) {
              showAuthDialog(
                "Sign in to view this private CampFeed."
              );
            }

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

  async function completePendingEmailSignIn() {
    if (
      !window.DeerCampAuth ||
      typeof window.DeerCampAuth.isEmailSignInLink !== "function" ||
      !window.DeerCampAuth.isEmailSignInLink(window.location.href)
    ) {
      return null;
    }

    try {
      const user = await window.DeerCampAuth.completeEmailSignIn({
        url: window.location.href
      });

      if (user) {
        const cleanUrl = new URL(window.location.href);

        ["apiKey", "oobCode", "mode", "lang"].forEach(function (key) {
          cleanUrl.searchParams.delete(key);
        });

        window.history.replaceState(
          {},
          document.title,
          cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
        );
      }

      return user || null;
    } catch (error) {
      console.error("DeerCamp email sign-in could not be completed.", error);

      showAuthDialog(
        error.message ||
        "The DeerCamp sign-in link could not be completed."
      );

      return null;
    }
  }
  async function start() {
    if (
      !window.DeerCampPremiumEngine ||
      typeof window.DeerCampPremiumEngine.initialize !== "function"
    ) {
      throw new Error(
        "DeerCamp Premium Engine is not available."
      );
    }

    document.addEventListener("deercamp:premium-ready", function (event) {
      const identity = event.detail?.identity;
      if (!identity?.name) return;

      const badge = document.querySelector("[data-camp-identity]");
      const name = document.querySelector("[data-camp-identity-name]");

      if (badge) {
        badge.setAttribute("aria-label", identity.name);
      }

      if (name) {
        name.textContent = identity.name;
      }
    });
    await completePendingEmailSignIn();

    await window.DeerCampPremiumEngine.initialize();
    if (
      window.DeerCampUniversalViewer &&
      typeof window.DeerCampUniversalViewer.initialize === "function"
    ) {
      window.DeerCampUniversalViewer.initialize();
    }

    if (window.DeerCampCloud && typeof window.DeerCampCloud.ensureReady === "function") {
      window.DeerCampCloud.ensureReady();
    }

    const campId =
      window.DeerCampPremiumEngine.getCampId();

    if (!campId) {
      return;
    }

    await loadFeed(campId);
    subscribeToFeed(campId);
  }

  const CAMPFEED_VIEWERS = {
    latest: {
      title: "Latest Conversations",
      mode: "latest"
    },
    voice: {
      title: "Voice Stories",
      mode: "voice"
    },
    photos: {
      title: "Photo Shares",
      mode: "photos"
    }
  };

  async function openCampFeedViewer(actionId) {
    const viewer =
      CAMPFEED_VIEWERS[actionId];

    if (!viewer) {
      return;
    }

    const campId =
      window.DeerCampPremiumEngine &&
      typeof window.DeerCampPremiumEngine.getCampId === "function"
        ? window.DeerCampPremiumEngine.getCampId()
        : "";

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.DeerCampMemoryProvider ||
      typeof window.DeerCampMemoryProvider.load !== "function"
    ) {
      throw new Error(
        "CampFeed memory provider is unavailable."
      );
    }

    if (
      !window.DeerCampUniversalViewer ||
      typeof window.DeerCampUniversalViewer.show !== "function"
    ) {
      throw new Error(
        "CampFeed viewer is unavailable."
      );
    }

    const result =
      await window.DeerCampMemoryProvider.load({
        campId,
        mode: viewer.mode,
        limit: 50
      });

    window.DeerCampUniversalViewer.show({
      kicker: "CAMPFEED",
      title: viewer.title,
      items: result.items,
      selectedIndex: 0,
      context: {
        campId,
        source: result.source,
        collection: result.collection,
        mode: viewer.mode,
        room: "campfeed"
      }
    });
  }

  document.addEventListener(
    "deercamp:premium-action",
    async function (event) {
      const detail =
        event.detail || {};


      if (
        detail.type === "view" &&
        CAMPFEED_VIEWERS[detail.action]
      ) {
        try {
          await openCampFeedViewer(
            detail.action
          );
        } catch (error) {
          console.error(
            "CampFeed viewer could not open.",
            error
          );

          alert(
            error.message ||
            "CampFeed viewer could not open."
          );
        }

        return;
      }

      if (
        detail.type === "create" &&
        detail.action === "comment"
      ) {
        openCampFeedShareDialog(
          "conversation"
        );
        return;
      }

      if (
        detail.type === "create" &&
        detail.action === "photo-caption"
      ) {
        openCampFeedShareDialog(
          "photo"
        );
        return;
      }

      if (
        detail.type === "create" &&
        detail.action === "voice-story"
      ) {
        openCampFeedShareDialog(
          "voice"
        );
        return;
      }
      if (
        detail.type === "create" &&
        detail.action === "memory-story"
      ) {
        openCampFeedShareDialog(
          "memory"
        );
        return;
      }
      if (detail.type === "create") {
        alert(
          `Share action: ${detail.action}`
        );
      }
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

  function showAuthDialog(message) {
    const dialog = document.getElementById("premiumActionDialog");
    const dialogTitle = document.getElementById("premiumDialogTitle");
    const dialogMessage = document.getElementById("premiumDialogMessage");
    const authForm = document.getElementById("premiumAuthForm");
    const textForm = document.getElementById("campfeedTextForm");
    const photoForm = document.getElementById("campfeedPhotoForm");
    const voiceForm = document.getElementById("campfeedVoiceForm");
    const memoryForm = document.getElementById("campfeedMemoryForm");

    if (textForm) textForm.hidden = true;
    if (photoForm) photoForm.hidden = true;
    if (voiceForm) voiceForm.hidden = true;
    if (memoryForm) memoryForm.hidden = true;
    if (authForm) authForm.hidden = false;

    if (dialogTitle) dialogTitle.textContent = "Sign in to DeerCamp";
    if (dialogMessage) {
      dialogMessage.textContent =
        message || "Sign in to view this private CampFeed.";
    }

    if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  const authDialog = document.getElementById("premiumActionDialog");
  const authClose = document.getElementById("premiumDialogClose");
  const authEmail = document.getElementById("premiumAuthEmail");
  const authSendLink = document.getElementById("premiumAuthSendLink");
  const authFeedback = document.getElementById("premiumAuthFeedback");

  if (authClose && authDialog) {
    authClose.addEventListener("click", function () {
      authDialog.close();
    });
  }

  if (authSendLink) {
    authSendLink.addEventListener("click", async function () {
      const email = String(authEmail ? authEmail.value : "")
        .trim()
        .toLowerCase();

      if (!email) {
        if (authFeedback) authFeedback.textContent = "Enter your DeerCamp email.";
        if (authEmail) authEmail.focus();
        return;
      }

      authSendLink.disabled = true;
      if (authFeedback) authFeedback.textContent = "Sending sign-in link...";

      try {
        if (
          !window.DeerCampAuth ||
          typeof window.DeerCampAuth.sendEmailSignInLink !== "function"
        ) {
          throw new Error("DeerCamp sign-in is unavailable.");
        }

        await window.DeerCampAuth.sendEmailSignInLink(email, {
          returnUrl: window.location.href
        });

        if (authFeedback) {
          authFeedback.textContent =
            "Sign-in link sent. Open the email link on this device.";
        }
      } catch (error) {
        console.error("DeerCamp sign-in link could not be sent.", error);

        if (authFeedback) {
          authFeedback.textContent =
            error.message || "Sign-in link could not be sent.";
        }
      } finally {
        authSendLink.disabled = false;
      }
    });
  }
  const premiumAuthForm = document.getElementById("premiumAuthForm");
  const campfeedTextForm = document.getElementById("campfeedTextForm");
  const campfeedPhotoForm = document.getElementById("campfeedPhotoForm");
  const campfeedVoiceForm = document.getElementById("campfeedVoiceForm");
  const campfeedMemoryForm = document.getElementById("campfeedMemoryForm");
  const campfeedPublishNotice = document.getElementById("campfeedPublishNotice");
  const campfeedPublishNoticeText = document.getElementById("campfeedPublishNoticeText");
  const campfeedPublishNoticeDismiss = document.getElementById("campfeedPublishNoticeDismiss");

  function showCampFeedPublishNotice(message) {
    if (!campfeedPublishNotice || !campfeedPublishNoticeText) return;
    campfeedPublishNoticeText.textContent = message;
    campfeedPublishNotice.hidden = false;
    campfeedPublishNotice.style.setProperty("display", "flex", "important");
  }

  if (campfeedPublishNoticeDismiss) {
    campfeedPublishNoticeDismiss.addEventListener("click", function () {
      campfeedPublishNotice.hidden = true;
      campfeedPublishNotice.style.display = "none";
    });
  }
  const campfeedShareFeedback = document.getElementById("campfeedShareFeedback");
  const campfeedTextPublish = document.getElementById("campfeedTextPublish");

  function hideCampFeedDialogForms() {
    stopCampFeedMemoryDictation();
    if (premiumAuthForm) premiumAuthForm.hidden = true;
    if (campfeedTextForm) campfeedTextForm.hidden = true;
    if (campfeedPhotoForm) campfeedPhotoForm.hidden = true;
    if (campfeedVoiceForm) campfeedVoiceForm.hidden = true;
    if (campfeedMemoryForm) campfeedMemoryForm.hidden = true;
    if (campfeedShareFeedback) campfeedShareFeedback.textContent = "";
  }

  function openCampFeedShareDialog(mode) {
    if (campfeedPublishNotice) {
      campfeedPublishNotice.hidden = true;
      campfeedPublishNotice.style.display = "none";
    }
    const dialog = document.getElementById("premiumActionDialog");
    const title = document.getElementById("premiumDialogTitle");
    const message = document.getElementById("premiumDialogMessage");

    hideCampFeedDialogForms();

    if (mode === "conversation") {
      if (title) title.textContent = "Start a Conversation";
      if (message) {
        message.textContent =
          "Share a story, question, update, or thought with camp.";
      }
      if (campfeedTextForm) campfeedTextForm.hidden = false;
    }

    if (mode === "photo") {
      if (title) title.textContent = "Share a Photo";
      if (message) {
        message.textContent =
          "Share a photo and optional caption with camp.";
      }
      if (campfeedPhotoForm) campfeedPhotoForm.hidden = false;
    }
    if (mode === "voice") {
      if (title) title.textContent = "Record a Voice Story";
      if (message) {
        message.textContent =
          "Record a voice story, play it back, then share it with camp.";
      }
      if (campfeedVoiceForm) campfeedVoiceForm.hidden = false;
    }

    if (mode === "memory") {
      if (title) title.textContent = "Share a Memory / Story";
      if (message) {
        message.textContent =
          "Preserve a memory or story from your camp history for the people who share it.";
      }
      if (campfeedMemoryForm) campfeedMemoryForm.hidden = false;
    }

    if (
      dialog &&
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  if (campfeedTextPublish) {
    campfeedTextPublish.addEventListener("click", async function () {
      const titleInput = document.getElementById("campfeedTitle");
      const bodyInput = document.getElementById("campfeedBody");
      const title = String(titleInput ? titleInput.value : "").trim();
      const body = String(bodyInput ? bodyInput.value : "").trim();

      if (!title && !body) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Add a title or conversation before sharing.";
        }
        return;
      }

      const user =
        window.firebase &&
        window.firebase.auth &&
        window.firebase.auth().currentUser;

      if (!user) {
        showAuthDialog(
          "Sign in to share with this private CampFeed."
        );
        return;
      }

      const campId =
        window.DeerCampPremiumEngine &&
        typeof window.DeerCampPremiumEngine.getCampId === "function"
          ? window.DeerCampPremiumEngine.getCampId()
          : "";

      if (!campId) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "No active DeerCamp camp was found.";
        }
        return;
      }

      campfeedTextPublish.disabled = true;

      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Sharing conversation...";
      }

      try {
        const createdAtMs = Date.now();
        const authorName =
          user.displayName ||
          formatAuthorName(user.email) ||
          "DeerCamp Member";

        await window.firebase
          .firestore()
          .collection("feedItems")
          .add({
            campId,
            room: "campfeed",
            authorId: user.uid,
            authorName,
            author: authorName,
            title: title || "CampFeed Conversation",
            caption: body,
            body,
            story: body,
            transcript: "",
            transcriptPreview: "",
            mediaType: "text",
            type: "conversation",
            category: "campfeed",
            tags: [
              "CampFeed",
              "Conversation",
              "Web"
            ],
            published: true,
            source: "app",
            createdAt:
              window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAtMs,
            clientCreatedAt: createdAtMs
          });

        if (titleInput) titleInput.value = "";
        if (bodyInput) bodyInput.value = "";

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Conversation shared.";
        showCampFeedPublishNotice("Conversation shared.");
        }

        if (authDialog && authDialog.open) {
          authDialog.close();
        }
      } catch (error) {
        console.error(
          "CampFeed conversation could not be shared.",
          error
        );

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            error.message ||
            "Conversation could not be shared.";
        }
      } finally {
        campfeedTextPublish.disabled = false;
      }
    });
  }
  const campfeedVoiceRecord =
    document.getElementById("campfeedVoiceRecord");
  const campfeedVoicePublish =
    document.getElementById("campfeedVoicePublish");
  const campfeedVoicePreview =
    document.getElementById("campfeedVoicePreview");

  let campfeedVoiceRecorder = null;
  let campfeedVoiceStream = null;
  let campfeedVoiceChunks = [];
  let campfeedVoiceBlob = null;
  let campfeedVoiceUrl = "";

  function resetCampFeedVoiceCapture() {
    if (
      campfeedVoiceRecorder &&
      campfeedVoiceRecorder.state === "recording"
    ) {
      campfeedVoiceRecorder.stop();
    }

    if (campfeedVoiceStream) {
      campfeedVoiceStream.getTracks().forEach(function (track) {
        track.stop();
      });
    }

    if (campfeedVoiceUrl) {
      URL.revokeObjectURL(campfeedVoiceUrl);
    }

    campfeedVoiceRecorder = null;
    campfeedVoiceStream = null;
    campfeedVoiceChunks = [];
    campfeedVoiceBlob = null;
    campfeedVoiceUrl = "";

    if (campfeedVoiceRecord) {
      campfeedVoiceRecord.textContent = "Start Recording";
    }

    if (campfeedVoicePublish) {
      campfeedVoicePublish.disabled = true;
    }

    if (campfeedVoicePreview) {
      campfeedVoicePreview.pause();
      campfeedVoicePreview.removeAttribute("src");
      campfeedVoicePreview.hidden = true;
    }
  }

  async function toggleCampFeedVoiceRecording() {
    if (
      campfeedVoiceRecorder &&
      campfeedVoiceRecorder.state === "recording"
    ) {
      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Finishing recording...";
      }

      campfeedVoiceRecorder.stop();
      return;
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof window.MediaRecorder !== "function"
    ) {
      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Voice recording is not available in this browser.";
      }
      return;
    }

    resetCampFeedVoiceCapture();

    try {
      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Requesting microphone access...";
      }

      campfeedVoiceStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true
        });

      campfeedVoiceRecorder =
        new MediaRecorder(campfeedVoiceStream);

      campfeedVoiceChunks = [];

      campfeedVoiceRecorder.addEventListener(
        "dataavailable",
        function (event) {
          if (event.data && event.data.size) {
            campfeedVoiceChunks.push(event.data);
          }
        }
      );

      campfeedVoiceRecorder.addEventListener(
        "stop",
        function () {
          const mimeType =
            campfeedVoiceRecorder.mimeType ||
            "audio/webm";

          campfeedVoiceBlob =
            new Blob(
              campfeedVoiceChunks,
              { type: mimeType }
            );

          if (campfeedVoiceStream) {
            campfeedVoiceStream
              .getTracks()
              .forEach(function (track) {
                track.stop();
              });
          }

          campfeedVoiceStream = null;

          if (!campfeedVoiceBlob.size) {
            if (campfeedShareFeedback) {
              campfeedShareFeedback.textContent =
                "No voice recording was captured. Try again.";
            }
            resetCampFeedVoiceCapture();
            return;
          }

          campfeedVoiceUrl =
            URL.createObjectURL(campfeedVoiceBlob);

          if (campfeedVoicePreview) {
            campfeedVoicePreview.src =
              campfeedVoiceUrl;
            campfeedVoicePreview.hidden = false;
            campfeedVoicePreview.load();
          }

          if (campfeedVoiceRecord) {
            campfeedVoiceRecord.textContent =
              "Record Again";
          }

          if (campfeedVoicePublish) {
            campfeedVoicePublish.disabled = false;
          }

          if (campfeedShareFeedback) {
            campfeedShareFeedback.textContent =
              "Recording ready. Play it back before sharing.";
          }
        }
      );

      campfeedVoiceRecorder.start();

      if (campfeedVoiceRecord) {
        campfeedVoiceRecord.textContent =
          "Stop Recording";
      }

      if (campfeedVoicePublish) {
        campfeedVoicePublish.disabled = true;
      }

      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Recording... tap Stop Recording when finished.";
      }
    } catch (error) {
      console.error(
        "CampFeed voice recording could not start.",
        error
      );

      resetCampFeedVoiceCapture();

      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          error.message ||
          "Microphone access could not be started.";
      }
    }
  }

  if (campfeedVoiceRecord) {
    campfeedVoiceRecord.addEventListener(
      "click",
      toggleCampFeedVoiceRecording
    );
  }
  const campfeedPhotoFile =
    document.getElementById("campfeedPhotoFile");
  const campfeedPhotoCaption =
    document.getElementById("campfeedPhotoCaption");
  const campfeedPhotoPublish =
    document.getElementById("campfeedPhotoPublish");

  if (campfeedPhotoPublish) {
    campfeedPhotoPublish.addEventListener("click", async function () {
      const file =
        campfeedPhotoFile &&
        campfeedPhotoFile.files &&
        campfeedPhotoFile.files[0];

      const caption =
        String(
          campfeedPhotoCaption
            ? campfeedPhotoCaption.value
            : ""
        ).trim();

      if (!file) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Choose a photo before sharing.";
        }
        return;
      }

      const user =
        window.firebase &&
        window.firebase.auth &&
        window.firebase.auth().currentUser;

      if (!user) {
        showAuthDialog(
          "Sign in to share with this private CampFeed."
        );
        return;
      }

      const campId =
        window.DeerCampPremiumEngine &&
        typeof window.DeerCampPremiumEngine.getCampId === "function"
          ? window.DeerCampPremiumEngine.getCampId()
          : "";

      if (!campId) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "No active DeerCamp camp was found.";
        }
        return;
      }

      if (
        !window.DeerCampStorage ||
        typeof window.DeerCampStorage.uploadCampImageFilePair !== "function"
      ) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "DeerCamp photo storage is unavailable.";
        }
        return;
      }

      campfeedPhotoPublish.disabled = true;

      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Uploading photo...";
      }

      try {
        const createdAtMs = Date.now();
        const entityId =
          "web-" +
          createdAtMs +
          "-" +
          user.uid.slice(0, 8);

        const uploaded =
          await window.DeerCampStorage.uploadCampImageFilePair({
            campId,
            folder: "campfeed",
            entityId,
            file
          });

        const imageUrl =
          uploaded.displayUrl ||
          uploaded.thumbUrl ||
          "";

        if (!imageUrl) {
          throw new Error(
            "Photo upload did not return an image URL."
          );
        }

        const authorName =
          user.displayName ||
          formatAuthorName(user.email) ||
          "DeerCamp Member";

        await window.firebase
          .firestore()
          .collection("feedItems")
          .add({
            campId,
            room: "campfeed",
            authorId: user.uid,
            authorName,
            author: authorName,
            title: "CampFeed Photo",
            caption,
            body: caption,
            story: caption,
            transcript: "",
            transcriptPreview: "",
            imageUrl,
            displayUrl: uploaded.displayUrl || imageUrl,
            thumbUrl: uploaded.thumbUrl || imageUrl,
            thumbnailUrl: uploaded.thumbUrl || imageUrl,
            mediaType: "photo",
            type: "photo",
            category: "campfeed",
            tags: [
              "CampFeed",
              "Picture",
              "Web"
            ],
            published: true,
            source: "app",
            localMemoryId: entityId,
            imagePath:
              uploaded.displayPath ||
              uploaded.thumbPath ||
              "",
            createdAt:
              window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAtMs,
            clientCreatedAt: createdAtMs
          });

        if (campfeedPhotoFile) {
          campfeedPhotoFile.value = "";
        }

        if (campfeedPhotoCaption) {
          campfeedPhotoCaption.value = "";
        }

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Photo shared.";
        showCampFeedPublishNotice("Photo shared.");
        }

        if (authDialog && authDialog.open) {
          authDialog.close();
        }
      } catch (error) {
        console.error(
          "CampFeed photo could not be shared.",
          error
        );

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            error.message ||
            "Photo could not be shared.";
        }
      } finally {
        campfeedPhotoPublish.disabled = false;
      }
    });
  }
  if (campfeedVoicePublish) {
    campfeedVoicePublish.addEventListener("click", async function () {
      const titleInput =
        document.getElementById("campfeedVoiceTitle");
      const bodyInput =
        document.getElementById("campfeedVoiceBody");

      const title =
        String(titleInput ? titleInput.value : "").trim() ||
        "Voice Story";

      const body =
        String(bodyInput ? bodyInput.value : "").trim();

      if (!campfeedVoiceBlob || !campfeedVoiceBlob.size) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Record a voice story before sharing.";
        }
        return;
      }

      const user =
        window.firebase &&
        window.firebase.auth &&
        window.firebase.auth().currentUser;

      if (!user) {
        showAuthDialog(
          "Sign in to share with this private CampFeed."
        );
        return;
      }

      const campId =
        window.DeerCampPremiumEngine &&
        typeof window.DeerCampPremiumEngine.getCampId === "function"
          ? window.DeerCampPremiumEngine.getCampId()
          : "";

      if (!campId) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "No active DeerCamp camp was found.";
        }
        return;
      }

      if (
        !window.DeerCampStorage ||
        typeof window.DeerCampStorage.uploadBlob !== "function"
      ) {
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "DeerCamp voice storage is unavailable.";
        }
        return;
      }

      campfeedVoicePublish.disabled = true;

      if (campfeedShareFeedback) {
        campfeedShareFeedback.textContent =
          "Uploading voice story...";
      }

      try {
        const createdAtMs = Date.now();

        const entityId =
          "voice-" +
          createdAtMs +
          "-" +
          user.uid.slice(0, 8);

        const contentType =
          campfeedVoiceBlob.type ||
          "audio/webm";

        let extension = "webm";

        if (contentType.includes("ogg")) {
          extension = "ogg";
        } else if (contentType.includes("mp4")) {
          extension = "m4a";
        } else if (contentType.includes("mpeg")) {
          extension = "mp3";
        }

        const audioPath =
          "camps/" +
          campId +
          "/campfeed/" +
          entityId +
          "/voice." +
          extension;

        const uploaded =
          await window.DeerCampStorage.uploadBlob(
            audioPath,
            campfeedVoiceBlob,
            {
              contentType,
              customMetadata: {
                campId,
                room: "campfeed",
                entityId,
                authorId: user.uid
              }
            }
          );

        const audioUrl =
          uploaded && uploaded.url
            ? uploaded.url
            : "";

        if (!audioUrl) {
          throw new Error(
            "Voice upload did not return an audio URL."
          );
        }

        const authorName =
          user.displayName ||
          formatAuthorName(user.email) ||
          "DeerCamp Member";

        await window.firebase
          .firestore()
          .collection("feedItems")
          .add({
            campId,
            room: "campfeed",
            authorId: user.uid,
            authorName,
            author: authorName,
            title,
            caption:
              body || "Voice story shared from CampFeed.",
            body,
            story: body,
            transcript: "",
            transcriptPreview: "",
            transcriptionStatus: "not_requested",
            transcriptionError: "",
            audioUrl,
            audioPath:
              uploaded.path || audioPath,
            audioContentType:
              uploaded.contentType || contentType,
            audioBytes:
              uploaded.bytes || campfeedVoiceBlob.size,
            mediaType: "audio",
            type: "voice",
            category: "campfeed",
            tags: [
              "CampFeed",
              "Voice",
              "Web"
            ],
            published: true,
            source: "app",
            localMemoryId: entityId,
            createdAt:
              window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAtMs,
            clientCreatedAt: createdAtMs
          });

        if (titleInput) titleInput.value = "";
        if (bodyInput) bodyInput.value = "";

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            "Voice story shared.";
        showCampFeedPublishNotice("Voice story shared.");
        }

        resetCampFeedVoiceCapture();

        if (authDialog && authDialog.open) {
          authDialog.close();
        }
      } catch (error) {
        console.error(
          "CampFeed voice story could not be shared.",
          error
        );

        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            error.message ||
            "Voice story could not be shared.";
        }
      } finally {
        campfeedVoicePublish.disabled =
          !campfeedVoiceBlob;
      }
    });
  }
  const campfeedMemoryTitle =
    document.getElementById("campfeedMemoryTitle");
  const campfeedMemoryBody =
    document.getElementById("campfeedMemoryBody");
  const campfeedMemoryFile =
    document.getElementById("campfeedMemoryFile");
  const campfeedMemoryPublish =
    document.getElementById("campfeedMemoryPublish");

  const memoryDictateStart = document.getElementById("campfeedMemoryDictateStart");
  const memoryDictateStop = document.getElementById("campfeedMemoryDictateStop");
  const memoryDictateStatus = document.getElementById("campfeedMemoryDictateStatus");

  let memoryRecognition = null;
  let memoryRecognitionStarting = false;

  function setMemoryDictateStatus(message) {
    if (memoryDictateStatus) memoryDictateStatus.textContent = message;
  }

  function stopCampFeedMemoryDictation() {
    if (!memoryRecognition) return;
    const recognition = memoryRecognition;
    memoryRecognition = null;
    memoryRecognitionStarting = false;

    try { recognition.abort(); } catch (error) {}

    if (memoryDictateStart) memoryDictateStart.hidden = false;
    if (memoryDictateStop) {
      memoryDictateStop.hidden = true;
      memoryDictateStop.disabled = false;
    }
    setMemoryDictateStatus("Voice-to-text stopped. Review and edit your story before sharing.");
  }

  if (memoryDictateStart && memoryDictateStop && campfeedMemoryBody) {
    memoryDictateStart.addEventListener("click", function () {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!Recognition) {
        setMemoryDictateStatus("Voice-to-text is not supported in this browser. You can still type your story.");
        return;
      }

      if (memoryRecognition || memoryRecognitionStarting) return;

      try {
        memoryRecognitionStarting = true;
        const recognition = new Recognition();
        memoryRecognition = recognition;
        recognition.lang = navigator.language || "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;

        const originalText = String(campfeedMemoryBody.value || "");
        const prefix = originalText ? originalText.trimEnd() + " " : "";

        recognition.onstart = function () {
          if (memoryRecognition !== recognition) return;
          memoryRecognitionStarting = false;
          memoryDictateStart.hidden = true;
          memoryDictateStop.hidden = false;
          setMemoryDictateStatus("Listening... speak naturally, then stop and review your story.");
        };

        recognition.onresult = function (event) {
          if (memoryRecognition !== recognition) return;

          let transcript = "";
          for (let i = 0; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result[0]) transcript += result[0].transcript.trim() + " ";
          }

          campfeedMemoryBody.value = (prefix + transcript).trimEnd().slice(0, 4000);
        };

        recognition.onerror = function (event) {
          if (memoryRecognition !== recognition) return;
          setMemoryDictateStatus(
            "Voice-to-text error: " + (event.error || "browser error") +
            ". You can continue editing your story."
          );
        };

        recognition.onend = function () {
          if (memoryRecognition !== recognition) return;
          memoryRecognition = null;
          memoryRecognitionStarting = false;
          memoryDictateStart.hidden = false;
          memoryDictateStop.hidden = true;
          memoryDictateStop.disabled = false;
          setMemoryDictateStatus("Voice-to-text stopped. Review and edit your story before sharing.");
        };

        recognition.start();
      } catch (error) {
        stopCampFeedMemoryDictation();
        setMemoryDictateStatus("Voice-to-text could not start. You can still type your story.");
      }
    });

    memoryDictateStop.addEventListener("click", function () {
      if (!memoryRecognition) return;
      memoryDictateStop.disabled = true;
      setMemoryDictateStatus("Finishing transcription...");

      try {
        memoryRecognition.stop();
      } catch (error) {
        stopCampFeedMemoryDictation();
      }
    });
  }

  if (authDialog) {
    authDialog.addEventListener("close", stopCampFeedMemoryDictation);
    authDialog.addEventListener("cancel", stopCampFeedMemoryDictation);
  }
  if (campfeedMemoryPublish) {
    campfeedMemoryPublish.addEventListener("click", async function () {
      const title = String(campfeedMemoryTitle ? campfeedMemoryTitle.value : "").trim();
      const body = String(campfeedMemoryBody ? campfeedMemoryBody.value : "").trim();
      const file =
        campfeedMemoryFile && campfeedMemoryFile.files && campfeedMemoryFile.files[0]
          ? campfeedMemoryFile.files[0]
          : null;

      if (!title) {
        if (campfeedShareFeedback) campfeedShareFeedback.textContent = "Add a title before sharing.";
        return;
      }

      if (!body) {
        if (campfeedShareFeedback) campfeedShareFeedback.textContent = "Write the camp story before sharing.";
        return;
      }

      const user =
        window.firebase && window.firebase.auth && window.firebase.auth().currentUser;

      if (!user) {
        showAuthDialog("Sign in to DeerCamp before sharing a memory.");
        return;
      }

      const campId =
        window.DeerCampPremiumEngine &&
        typeof window.DeerCampPremiumEngine.getCampId === "function"
          ? window.DeerCampPremiumEngine.getCampId()
          : "";

      if (!campId) {
        if (campfeedShareFeedback) campfeedShareFeedback.textContent = "The camp could not be identified.";
        return;
      }

      if (file && (!window.DeerCampStorage || typeof window.DeerCampStorage.uploadCampImageFilePair !== "function")) {
        if (campfeedShareFeedback) campfeedShareFeedback.textContent = "DeerCamp image storage is not available.";
        return;
      }

      campfeedMemoryPublish.disabled = true;
      if (campfeedShareFeedback) campfeedShareFeedback.textContent = file ? "Uploading and sharing camp story..." : "Sharing camp story...";

      try {
        const createdAtMs = Date.now();
        const entityId = "memory-" + createdAtMs;
        let uploaded = null;

        if (file) {
          uploaded = await window.DeerCampStorage.uploadCampImageFilePair({
            campId: campId,
            folder: "campfeed",
            entityId: entityId,
            file: file,
            targets: {
              display: { maxSize: 1400, quality: 0.78, maxBytes: 320000 },
              thumb: { maxSize: 480, quality: 0.68, maxBytes: 80000 }
            }
          });

          if (!uploaded || !(uploaded.displayUrl || uploaded.thumbUrl)) {
            throw new Error("The picture upload did not return a usable image.");
          }
        }

        const authorName =
          user.displayName || user.email || "DeerCamp Member";

        const item = {
          campId: campId,
          authorId: user.uid,
          author: authorName,
          authorName: authorName,
          authorEmail: user.email || "",
          source: "app",
          sourceRoom: "Memories Room",
          room: "Memories Room",
          published: true,
          title: title,
          mediaType: "memory",
          type: "memory",
          body: body,
          story: body,
          caption: "",
          tags: uploaded
            ? ["Memory / Story", "Picture", "CampUpdate"]
            : ["Memory / Story", "CampUpdate"],
          comments: [],
          createdAt: new Date(createdAtMs).toISOString(),
          createdAtMs: createdAtMs,
          clientCreatedAt: new Date(createdAtMs).toISOString(),
          platform: "web"
        };

        if (uploaded) {
          item.imageUrl = uploaded.displayUrl || uploaded.thumbUrl || "";
          item.displayUrl = uploaded.displayUrl || uploaded.thumbUrl || "";
          item.thumbUrl = uploaded.thumbUrl || uploaded.displayUrl || "";
          item.storagePath = uploaded.displayPath || "";
          item.thumbPath = uploaded.thumbPath || "";
          item.storageProvider = uploaded.storageProvider || "firebase";
        }

        await window.firebase.firestore().collection("feedItems").doc(entityId).set(item);

        if (campfeedMemoryTitle) campfeedMemoryTitle.value = "";
        if (campfeedMemoryBody) campfeedMemoryBody.value = "";
        if (campfeedMemoryFile) campfeedMemoryFile.value = "";

        if (campfeedShareFeedback) campfeedShareFeedback.textContent = "Memory / story shared to DeerCamp.";
        showCampFeedPublishNotice("Memory / story shared to DeerCamp.");

        if (authDialog && authDialog.open) authDialog.close();
      } catch (error) {
        console.error("CampFeed memory / story could not be shared.", error);
        if (campfeedShareFeedback) {
          campfeedShareFeedback.textContent =
            error.message || "Memory / story could not be shared.";
        }
      } finally {
        campfeedMemoryPublish.disabled = false;
      }
    });
  }

  start().catch(function (error) {
    console.error(
      "CampFeed room initialization failed.",
      error
    );
  });
})();
