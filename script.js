/* =========================================================
   DeerCamp — script.js (v5)
   Fixes:
   - Campfires (and any card) always opens: click button OR image OR tile
   - Prevent “freeze”: single init guard + decode + preload neighbors
   - Lightbox Prev/Next navigation for CampCards
   ========================================================= */

(function () {
  // Guard against double-loading (can cause “freezing” behavior)
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

  // Single audio instance (avoids stacking & jank)
  const player = new Audio();
  player.preload = "none";

  // Build Prev/Next UI without changing HTML
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

  // Re-home existing buttons
  rightGroup.appendChild(closeBtn);
  rightGroup.appendChild(audioBtn);

  controls.innerHTML = "";
  controls.appendChild(leftGroup);
  controls.appendChild(rightGroup);

  let currentList = [];
  let currentIndex = -1;
  let currentMode = "generic"; // "campcards" | "generic"

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

  // Preload adjacent images to reduce perceived “freeze”
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
    // Decode before showing (reduces flicker/jank on some devices)
    imgEl.decoding = "async";
    imgEl.src = src;
    try {
      if (imgEl.decode) await imgEl.decode();
    } catch (e) {
      // decode can fail on cross-origin or some browsers—ignore
    }
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
    openLightbox({ src, title, audioSrc, mode: "campcards", list: currentList, index: safe });
  }

  // CLICK: open when user clicks the overlay button OR the tile/image itself
  document.addEventListener("click", (e) => {
    // If audio button clicked, do not trigger open
    if (e.target.closest(".audio-btn")) return;

    // Lightbox close on background click
    if (lightbox.style.display === "flex" && e.target === lightbox) {
      e.preventDefault();
      closeLightbox();
      return;
    }

    // Lightbox X
    if (e.target.closest(".lightbox-x")) {
      e.preventDefault();
      closeLightbox();
      return;
    }

    // Lightbox prev/next
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

    // Lightbox close button
    if (e.target === closeBtn) {
      e.preventDefault();
      closeLightbox();
      return;
    }

    // Open logic: overlay OR the tile itself
    const openBtn = e.target.closest(".shot-open");
    const fig = openBtn ? openBtn.closest("figure.shot") : e.target.closest("figure.shot");

    if (!fig) return;

    // CampCards mode only in #campcards
    const isCampcards = !!fig.closest("#campcards");

    if (isCampcards) {
      const campSection = fig.closest("#campcards");
      const campButtons = $$(".shot-open", campSection);
      const btnForThisFig = $(".shot-open", fig);

      // If for some reason a card has no .shot-open, fallback to index by figure position
      let idx = btnForThisFig ? campButtons.indexOf(btnForThisFig) : -1;
      if (idx < 0) {
        const figs = $$("figure.shot", campSection);
        idx = figs.indexOf(fig);
      }

      currentList = campButtons;
      openCampcardsByIndex(idx);
    } else {
      // Generic (App Screens etc.)
      const { src, title, audioSrc } = getDataFromFigure(fig);
      openLightbox({ src, title, audioSrc, mode: "generic", list: [], index: -1 });
    }
  });

  // Keyboard
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

  // Start closed
  closeLightbox();
})();
