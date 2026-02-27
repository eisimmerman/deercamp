/* =========================================================
   DeerCamp — script.js (v7)
   Behavior:
   - CampCards (#campcards):
       * Mobile (<=760px): lightbox open + prev/next + audio
       * Desktop: NO lightbox (cards are readable in-grid)
   - App Screens (#screens / #app-screens / #appscreens):
       * NO lightbox on desktop (and we also disable on mobile to keep it simple)
   ========================================================= */

(function () {
  if (window.__DEERCAMP_LIGHTBOX_INIT__) return;
  window.__DEERCAMP_LIGHTBOX_INIT__ = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const lightbox = $("#lightbox");
  const imgEl = $(".lightbox-img", lightbox);
  const titleEl = $("#lightboxTitle");
  const closeX = $(".lightbox-x", lightbox);
  const closeBtn = $(".lb-close", lightbox);
  const audioBtn = $(".lb-audio", lightbox);
  const controls = $(".lightbox-controls", lightbox);

  if (!lightbox || !imgEl || !titleEl || !closeX || !closeBtn || !audioBtn || !controls) return;

  const player = new Audio();
  player.preload = "none";

  // Inject Prev/Next UI
  const leftGroup = document.createElement("div");
  leftGroup.className = "lb-left";

  const rightGroup = document.createElement("div");
  rightGroup.className = "lb-right";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "lb-btn lb-nav";
  prevBtn.textContent = "← Prev";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "lb-btn lb-nav";
  nextBtn.textContent = "Next →";

  leftGroup.appendChild(prevBtn);
  leftGroup.appendChild(nextBtn);

  rightGroup.appendChild(closeBtn);
  rightGroup.appendChild(audioBtn);

  controls.innerHTML = "";
  controls.appendChild(leftGroup);
  controls.appendChild(rightGroup);

  let currentList = [];
  let currentIndex = -1;
  let currentMode = "generic"; // "campcards" | "generic"

  function isMobile() {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  // Detect App Screens section (covers common IDs)
  function isInAppScreens(fig) {
    return !!(
      fig.closest("#screens") ||
      fig.closest("#app-screens") ||
      fig.closest("#appscreens") ||
      fig.closest("[data-section='screens']")
    );
  }

  function stopAudio() {
    try { player.pause(); player.currentTime = 0; } catch (e) {}
    audioBtn.style.display = "none";
    audioBtn.dataset.src = "";
    audioBtn.textContent = "Play";
  }

  function setAudio(src) {
    stopAudio();
    if (!src) return;
    audioBtn.style.display = "";
    audioBtn.dataset.src = src;
  }

  function setNavVisibility() {
    const navEnabled = currentMode === "campcards" && currentList.length > 1 && currentIndex >= 0;
    prevBtn.style.display = navEnabled ? "" : "none";
    nextBtn.style.display = navEnabled ? "" : "none";
  }

  function preloadNeighbors(idx) {
    if (!currentList.length) return;
    const n = currentList.length;
    const prev = (idx - 1 + n) % n;
    const next = (idx + 1) % n;

    [prev, next].forEach((i) => {
      const btn = currentList[i];
      const src = btn?.dataset?.img;
      if (!src) return;
      const im = new Image();
      im.decoding = "async";
      im.src = src;
    });
  }

  async function swapImage(src) {
    imgEl.decoding = "async";
    imgEl.src = src;
    try {
      if (imgEl.decode) await imgEl.decode();
    } catch (e) {}
  }

  async function openLightbox({ src, title, audioSrc, mode, list, index }) {
    currentMode = mode || "generic";
    currentList = Array.isArray(list) ? list : [];
    currentIndex = Number.isFinite(index) ? index : -1;

    titleEl.textContent = title || "Preview";
    setAudio(audioSrc);
    setNavVisibility();

    lightbox.style.display = "flex";
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    await swapImage(src);

    if (currentMode === "campcards") preloadNeighbors(currentIndex);
  }

  function closeLightbox() {
    stopAudio();
    imgEl.src = "";
    lightbox.style.display = "none";
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentList = [];
    currentIndex = -1;
    currentMode = "generic";
  }

  function getDataFromFigure(fig) {
    const btn = $(".shot-open", fig);
    const img = $("img", fig);
    const src = (btn && btn.dataset.img) || (img && img.getAttribute("src")) || "";
    const title = (btn && btn.dataset.title) || (img && img.getAttribute("alt")) || "Preview";
    const audioSrc = fig.classList.contains("has-audio") ? (fig.dataset.audio || "") : "";
    return { src, title, audioSrc };
  }

  function openCampcardsByIndex(idx) {
    if (!currentList.length) return;
    const n = currentList.length;
    const safe = (idx + n) % n;
    const btn = currentList[safe];
    const fig = btn.closest("figure");
    const { src, title, audioSrc } = getDataFromFigure(fig);

    openLightbox({
      src,
      title,
      audioSrc,
      mode: "campcards",
      list: currentList,
      index: safe
    });
  }

  document.addEventListener("click", (e) => {
    // Don’t hijack audio button
    if (e.target.closest(".audio-btn")) return;

    // Close lightbox
    if (lightbox.style.display === "flex" && e.target === lightbox) {
      e.preventDefault();
      closeLightbox();
      return;
    }
    if (e.target.closest(".lightbox-x") || e.target === closeBtn) {
      e.preventDefault();
      closeLightbox();
      return;
    }

    // Prev/Next
    if (e.target === prevBtn) {
      e.preventDefault();
      if (currentMode === "campcards") openCampcardsByIndex(currentIndex - 1);
      return;
    }
    if (e.target === nextBtn) {
      e.preventDefault();
      if (currentMode === "campcards") openCampcardsByIndex(currentIndex + 1);
      return;
    }

    // Lightbox audio
    if (e.target === audioBtn) {
      e.preventDefault();
      const src = audioBtn.dataset.src;
      if (!src) return;

      if (!player.paused && player.src && player.src.includes(src)) {
        player.pause();
        audioBtn.textContent = "Play";
      } else {
        try {
          player.pause();
          player.currentTime = 0;
          player.src = src;
          player.play();
          audioBtn.textContent = "Pause";
        } catch (err) {
          audioBtn.textContent = "Play";
        }
      }
      return;
    }

    // Identify clicked shot
    const openBtn = e.target.closest(".shot-open");
    const fig = openBtn ? openBtn.closest("figure.shot") : e.target.closest("figure.shot");
    if (!fig) return;

    const inCampcards = !!fig.closest("#campcards");
    const inScreens = isInAppScreens(fig);

    // ✅ App Screens: no lightbox (desktop + mobile)
    if (inScreens) return;

    // ✅ CampCards:
    // - Mobile: open lightbox
    // - Desktop: no lightbox
    if (inCampcards) {
      if (!isMobile()) return;

      const campSection = fig.closest("#campcards");
      const campButtons = $$(".shot-open", campSection);
      const btnForThisFig = $(".shot-open", fig);
      const idx = btnForThisFig ? campButtons.indexOf(btnForThisFig) : 0;

      currentList = campButtons;
      openCampcardsByIndex(idx >= 0 ? idx : 0);
      return;
    }

    // ✅ Everything else (if any): can still open
    const { src, title, audioSrc } = getDataFromFigure(fig);
    openLightbox({ src, title, audioSrc, mode: "generic", list: [], index: -1 });
  });

  document.addEventListener("keydown", (e) => {
    const isOpen = lightbox.style.display === "flex";
    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeLightbox();
      return;
    }

    if (currentMode === "campcards") {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        openCampcardsByIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        openCampcardsByIndex(currentIndex + 1);
      }
    }
  });

  player.addEventListener("ended", () => {
    audioBtn.textContent = "Play";
  });

  closeLightbox();
})();
