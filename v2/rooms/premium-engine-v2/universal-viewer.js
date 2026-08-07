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
          ? "Voice memory — no photo was captured."
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
    placeholder.textContent = "Loading memory photo…";

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

    const previous = byId("memoryViewerPrevious");
    const next = byId("memoryViewerNext");
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

    if (closeButton) closeButton.addEventListener("click", close);
    if (previous) previous.addEventListener("click", function () { move(-1); });
    if (next) next.addEventListener("click", function () { move(1); });

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

  const api = { initialize, show, showError, close, next: function () { move(1); }, previous: function () { move(-1); } };
  window.DeerCampMemoryViewer = api;
  window.DeerCampUniversalViewer = api;
})();




