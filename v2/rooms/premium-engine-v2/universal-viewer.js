(function () {
  "use strict";

  const state = {
    items: [],
    index: 0,
    options: {}
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = String(value || "");
  }

  function normalizeItem(item, index) {
    const metadata = item && typeof item.metadata === "object" ? item.metadata : {};
    return {
      id: String(item?.id || `memory-${index + 1}`),
      contentType: String(item?.contentType || item?.type || "memory"),
      title: String(item?.title || "Untitled DeerCamp Memory"),
      subtitle: String(item?.subtitle || item?.copy || ""),
      author: String(item?.author || "DeerCamp Member"),
      room: String(item?.room || "DeerCamp"),
      timestamp: String(item?.timestamp || metadata.date || ""),
      heroImage: String(
        item?.heroImage?.url ||
        item?.heroImage?.src ||
        item?.heroImage ||
        item?.imageUrl ||
        ""
      ),

      imageAlt: String(
        item?.heroImage?.alt ||
        item?.imageAlt ||
        item?.title ||
        "DeerCamp memory"
      ),

      audioUrl: String(
        item?.audio?.url ||
        item?.audioUrl ||
        item?.voiceUrl ||
        ""
      ),
      transcript: String(item?.transcript || item?.copy || ""),
      campId: String(item?.campId || ""),
      source:
        item?.source && typeof item.source === "object"
          ? { ...item.source }
          : {},
      comments: Array.isArray(item?.comments) ? item.comments : [],
      tags: Array.isArray(item?.tags) ? item.tags : [],
      metadata,
      related: Array.isArray(item?.related) ? item.related : []
    };
  }

  function clear(element) {
    if (element) element.innerHTML = "";
  }

  function appendTextRow(container, label, value) {
    if (!container || !value) return;
    const row = document.createElement("div");
    row.className = "memory-viewer-meta-row";
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement("strong");
    val.textContent = String(value);
    row.append(key, val);
    container.appendChild(row);
  }

  let heroRenderToken = 0;

  function setHeroPlaceholder(frame, image, placeholder, message, stateClass) {
    image.hidden = true;
    image.classList.remove("is-loaded");

    placeholder.hidden = false;
    placeholder.textContent = message;

    frame.classList.remove(
      "has-image",
      "is-loading",
      "has-image-error"
    );

    if (stateClass) {
      frame.classList.add(stateClass);
    }
  }

  function renderHero(item) {
    const frame = byId("memoryViewerHeroFrame");
    const image = byId("memoryViewerHero");
    const placeholder = byId("memoryViewerHeroPlaceholder");

    if (!frame || !image || !placeholder) {
      return;
    }

    heroRenderToken += 1;
    const currentToken = heroRenderToken;

    image.onload = null;
    image.onerror = null;
    image.classList.remove("is-loaded");

    if (!item.heroImage) {
      image.removeAttribute("src");

      setHeroPlaceholder(
        frame,
        image,
        placeholder,
        item.audioUrl
          ? "Voice memory â€” no photo was captured."
          : "No photo is available for this memory.",
        ""
      );

      return;
    }

    frame.classList.remove(
      "has-image",
      "has-image-error"
    );

    frame.classList.add("is-loading");

    image.hidden = false;
    placeholder.hidden = false;
    placeholder.textContent = "Loading memory photoâ€¦";

    image.alt =
      item.imageAlt ||
      item.title ||
      "DeerCamp memory";

    image.onload = function () {
      if (currentToken !== heroRenderToken) {
        return;
      }

      frame.classList.remove(
        "is-loading",
        "has-image-error"
      );

      frame.classList.add("has-image");

      placeholder.hidden = true;
      image.hidden = false;

      requestAnimationFrame(function () {
        image.classList.add("is-loaded");
      });
    };

    image.onerror = function () {
      if (currentToken !== heroRenderToken) {
        return;
      }

      image.removeAttribute("src");

      setHeroPlaceholder(
        frame,
        image,
        placeholder,
        "Photo unavailable for this memory.",
        "has-image-error"
      );
    };

    image.src = item.heroImage;
  }

  function renderAudio(item) {
    const section = byId("memoryViewerAudioSection");
    const audio = byId("memoryViewerAudio");
    if (!section || !audio) return;
    if (item.audioUrl) {
      audio.src = item.audioUrl;
      section.hidden = false;
    } else {
      audio.removeAttribute("src");
      audio.load();
      section.hidden = true;
    }
  }

  function renderTranscript(item) {
    const section = byId("memoryViewerTranscriptSection");
    const text = byId("memoryViewerTranscript");
    if (!section || !text) return;
    const transcript = item.transcript || item.subtitle;
    section.hidden = !transcript;
    text.textContent = transcript;
  }

  function renderComments(item) {
    const section = byId("memoryViewerCommentsSection");
    const list = byId("memoryViewerComments");
    if (!section || !list) return;
    clear(list);
    section.hidden = item.comments.length === 0;

    item.comments.forEach(function (comment) {
      const card = document.createElement("article");
      card.className = "memory-viewer-comment";
      const head = document.createElement("div");
      head.className = "memory-viewer-comment-head";
      const author = document.createElement("strong");
      author.textContent = comment.author || "Camp member";
      const time = document.createElement("span");
      time.textContent = comment.timestamp || "";
      const body = document.createElement("p");
      body.textContent = comment.text || comment.copy || "";
      head.append(author, time);
      card.append(head, body);
      list.appendChild(card);
    });
  }

  async function addComment(text) {
    const cleanText = String(text || "").trim();

    if (!cleanText) {
      throw new Error("Add a comment before posting.");
    }

    const item = state.items[state.index];

    if (!item) {
      throw new Error("No CampFeed post is currently selected.");
    }

    const collection = String(
      item.source?.collection || ""
    ).trim();

    const documentId = String(
      item.source?.documentId || item.id || ""
    ).trim();

    if (collection !== "feedItems" || !documentId) {
      throw new Error(
        "This CampFeed post does not have a valid Firestore document reference."
      );
    }

    if (
      !window.DeerCampCloud ||
      typeof window.DeerCampCloud.ensureReady !== "function"
    ) {
      throw new Error("DeerCamp cloud services are unavailable.");
    }

    const db = window.DeerCampCloud.ensureReady();

    if (!db) {
      throw new Error("DeerCamp cloud services could not initialize.");
    }

    const auth =
      window.firebase &&
      typeof firebase.auth === "function"
        ? firebase.auth()
        : null;

    const user = auth ? auth.currentUser : null;

    if (!user) {
      throw new Error("Sign in to add a CampFeed comment.");
    }

    const author = String(
      user.displayName ||
      user.email ||
      "Camp Member"
    ).trim();

    const now = Date.now();

    const comment = {
      id:
        "comment-" +
        now +
        "-" +
        Math.random().toString(36).slice(2, 8),
      author,
      authorName: author,
      uid: String(user.uid || ""),
      text: cleanText,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now
    };

    const ref = db
      .collection(collection)
      .doc(documentId);

    await db.runTransaction(async function (transaction) {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        throw new Error("The CampFeed post no longer exists.");
      }

      const data = snapshot.data() || {};
      let existing = data.comments;

      if (Array.isArray(existing)) {
        existing = existing.slice();
      } else if (
        existing &&
        typeof existing === "object"
      ) {
        existing = Object.values(existing);
      } else {
        existing = [];
      }

      transaction.update(ref, {
        comments: existing.concat(comment),
        commentsUpdatedAtClient:
          new Date(now).toISOString()
      });
    });

    item.comments = item.comments.concat({
      id: comment.id,
      author: comment.author,
      text: comment.text,
      timestamp: new Date(now).toLocaleString()
    });

    renderCurrent();

    return comment;
  }
  async function refreshStewardActions(item) {
    const section = byId("memoryViewerStewardActions");
    const button = byId("memoryViewerRemovePost");
    const feedback = byId("memoryViewerRemoveFeedback");

    if (!section || !button) return;

    section.hidden = true;
    button.disabled = false;
    if (feedback) feedback.textContent = "";

    const campId = String(item?.campId || "").trim();
    if (
      !campId ||
      !window.DeerCampCloud ||
      typeof window.DeerCampCloud.isCurrentUserSteward !== "function"
    ) return;

    const itemId = String(item?.id || "").trim();
    const isSteward =
      await window.DeerCampCloud.isCurrentUserSteward(campId);

    const current = state.items[state.index];
    if (!current || String(current.id || "").trim() !== itemId) return;

    section.hidden = !isSteward;
  }

  async function removeCurrentPost() {
    const item = state.items[state.index];
    if (!item) throw new Error("No CampFeed post is currently selected.");

    const campId = String(item.campId || "").trim();
    const collection = String(item.source?.collection || "").trim();
    const documentId = String(item.source?.documentId || "").trim();

    if (!campId || collection !== "feedItems" || !documentId) {
      throw new Error(
        "This CampFeed post does not have a valid Firestore document reference."
      );
    }

    if (
      !window.DeerCampCloud ||
      typeof window.DeerCampCloud.ensureReady !== "function" ||
      typeof window.DeerCampCloud.isCurrentUserSteward !== "function"
    ) {
      throw new Error("DeerCamp cloud services are unavailable.");
    }

    const isSteward =
      await window.DeerCampCloud.isCurrentUserSteward(campId);

    if (!isSteward) {
      throw new Error("Only the Camp Steward can remove CampFeed posts.");
    }

    const db = window.DeerCampCloud.ensureReady();
    if (!db) {
      throw new Error("DeerCamp cloud services could not initialize.");
    }

    const auth =
      window.firebase && typeof firebase.auth === "function"
        ? firebase.auth()
        : null;

    const user = auth ? auth.currentUser : null;
    if (!user) {
      throw new Error("Sign in as the Camp Steward to remove this post.");
    }

    const payload = {
      published: false,
      removedAtClient: new Date().toISOString(),
      removedBy: String(user.uid || ""),
      removedByLabel: "Camp Steward",
      removedReason: "steward_removed"
    };

    if (firebase.firestore.FieldValue?.serverTimestamp) {
      payload.removedAt =
        firebase.firestore.FieldValue.serverTimestamp();
    }

    await db
      .collection("feedItems")
      .doc(documentId)
      .set(payload, { merge: true });

    state.items.splice(state.index, 1);

    if (!state.items.length) {
      close();
      return true;
    }

    if (state.index >= state.items.length) {
      state.index = state.items.length - 1;
    }

    renderCurrent();
    return true;
  }

  function renderTags(item) {
    const list = byId("memoryViewerTags");
    const section = byId("memoryViewerTagsSection");
    if (!list || !section) return;
    clear(list);
    section.hidden = item.tags.length === 0;
    item.tags.forEach(function (tag) {
      const chip = document.createElement("span");
      chip.className = "memory-viewer-tag";
      chip.textContent = String(tag);
      list.appendChild(chip);
    });
  }

  function renderMetadata(item) {
    const section = byId("memoryViewerMetadataSection");
    const list = byId("memoryViewerMetadata");
    if (!section || !list) return;
    clear(list);
    const entries = [
      ["Date", item.metadata.date],
      ["Location", item.metadata.location],
      ["Members", Array.isArray(item.metadata.members) ? item.metadata.members.join(", ") : item.metadata.members],
      ["Weather", item.metadata.weather],
      ["Source", item.metadata.source]
    ].filter(function (entry) { return entry[1]; });
    section.hidden = entries.length === 0;
    entries.forEach(function (entry) { appendTextRow(list, entry[0], entry[1]); });
  }

  function preloadImage(url) {
    const cleanUrl = String(url || "").trim();

    if (!cleanUrl) {
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = cleanUrl;
  }

  function preloadAdjacentImages() {
    if (state.items.length < 2) {
      return;
    }

    const previousIndex =
      (state.index - 1 + state.items.length) %
      state.items.length;

    const nextIndex =
      (state.index + 1) %
      state.items.length;

    preloadImage(
      state.items[previousIndex]?.heroImage
    );

    if (nextIndex !== previousIndex) {
      preloadImage(
        state.items[nextIndex]?.heroImage
      );
    }
  }

  function renderCurrent() {
    if (!state.items.length) {
      showError("No matching DeerCamp memories were found.");
      return;
    }

    const item = state.items[state.index];
    setText("memoryViewerKicker", state.options.kicker || item.room || "MEMORY VIEWER");
    setText("memoryViewerCollectionTitle", state.options.title || "DeerCamp Memories");
    setText("memoryViewerItemTitle", item.title);
    setText("memoryViewerSubtitle", item.subtitle);
    setText("memoryViewerAuthor", item.author);
    setText("memoryViewerRoom", item.room);
    setText("memoryViewerTimestamp", item.timestamp);
    setText("memoryViewerPosition", `${state.index + 1} of ${state.items.length}`);

    renderHero(item);
    renderAudio(item);
    renderTranscript(item);
    renderComments(item);
    renderTags(item);
    renderMetadata(item);
    refreshStewardActions(item).catch(function (error) {
      console.warn("Could not refresh Camp Steward actions.", error);
    });

    const previous = byId("memoryViewerPrevious");
    const next = byId("memoryViewerNext");
    const removePost = byId("memoryViewerRemovePost");
    const removeFeedback = byId("memoryViewerRemoveFeedback");
    if (previous) {
      previous.disabled = state.items.length < 2;
      previous.textContent = "Previous";
    }

    if (next) {
      next.disabled = state.items.length < 2;
      next.textContent = "Next";
    }

    preloadAdjacentImages();
  }

  function show(options = {}) {
    const dialog = byId("universalViewer");
    if (!dialog) {
      console.warn("Memory Viewer dialog was not found.");
      return;
    }

    const rawItems = Array.isArray(options.items) ? options.items : [];
    state.items = rawItems.map(normalizeItem);
    state.index = Math.max(0, Math.min(Number(options.startIndex) || 0, Math.max(0, state.items.length - 1)));
    state.options = options;

    if (!state.items.length) {
      showError("No matching DeerCamp memories were found.");
      return;
    }

    renderCurrent();
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  function showError(message) {
    const dialog = byId("universalViewer");
    const empty = byId("memoryViewerEmpty");
    const content = byId("memoryViewerContent");
    if (!dialog || !empty || !content) return;
    setText("memoryViewerKicker", "MEMORY VIEWER");
    setText("memoryViewerCollectionTitle", "Unable to Load Memory");
    empty.textContent = message || "The requested memory could not be loaded.";
    empty.hidden = false;
    content.hidden = true;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  function close() {
    const dialog = byId("universalViewer");
    if (dialog && dialog.open) dialog.close();
  }

  function move(delta) {
    if (state.items.length < 2) return;
    state.index = (state.index + delta + state.items.length) % state.items.length;
    renderCurrent();
    const body = byId("memoryViewerBody");
    if (body) body.scrollTop = 0;
  }

  function initialize() {
    const dialog = byId("universalViewer");
    const closeButton = byId("universalViewerClose");
    const previous = byId("memoryViewerPrevious");
    const next = byId("memoryViewerNext");
    const removePost = byId("memoryViewerRemovePost");
    const removeFeedback = byId("memoryViewerRemoveFeedback");

    if (closeButton) closeButton.addEventListener("click", close);
    if (previous) previous.addEventListener("click", function () { move(-1); });
    if (next) next.addEventListener("click", function () { move(1); });

    if (removePost) {
      removePost.addEventListener("click", async function () {
        if (!window.confirm("Remove this post from CampFeed?")) {
          return;
        }

        removePost.disabled = true;

        if (removeFeedback) {
          removeFeedback.textContent = "Removing post...";
        }

        try {
          await removeCurrentPost();

          if (removeFeedback) {
            removeFeedback.textContent = "";
          }
        } catch (error) {
          console.error("CampFeed post could not be removed.", error);

          if (removeFeedback) {
            removeFeedback.textContent =
              error.message ||
              "CampFeed post could not be removed.";
          }

          removePost.disabled = false;
        }
      });
    }

    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) close();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (!dialog || !dialog.open) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    });
  }

  const api = {
    initialize,
    show,
    showError,
    close,
    addComment,
    removeCurrentPost,
    next: function () { move(1); },
    previous: function () { move(-1); }
  };
  window.DeerCampMemoryViewer = api;
  window.DeerCampUniversalViewer = api;
})();
