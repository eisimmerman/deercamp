/* =========================================================
   DeerCamp — script.js
   Lightbox + single-audio controller + expanded view Play/Pause
   ========================================================= */

(() => {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox?.querySelector(".lightbox-img");
  const btnClose = lightbox?.querySelector(".lightbox-close");

  const meta = document.getElementById("lightboxMeta");
  const metaTitle = document.getElementById("lightboxTitle");
  const metaBtn = document.getElementById("lightboxAudioBtn");

  // One audio element for the whole page (prevents overlaps)
  const audio = new Audio();
  audio.preload = "none";

  // Track current “active” figure
  let activeFigure = null;

  const setButtonText = (btn, isPlaying) => {
    if (!btn) return;
    btn.textContent = isPlaying ? "Pause" : "Play";
  };

  const stopAudio = () => {
    audio.pause();
    audio.currentTime = 0;
    // reset all buttons back to Play
    document.querySelectorAll(".audio-btn").forEach(b => setButtonText(b, false));
    setButtonText(metaBtn, false);
  };

  const playAudioForFigure = (figure) => {
    if (!figure) return;

    const src = figure.getAttribute("data-audio");
    if (!src) return;

    const isSame = (audio.src && audio.src.includes(src));
    const isPlaying = !audio.paused;

    // If same track and playing -> pause
    if (isSame && isPlaying) {
      audio.pause();
      setButtonText(metaBtn, false);
      const inlineBtn = figure.querySelector(".audio-btn");
      setButtonText(inlineBtn, false);
      return;
    }

    // Switch to new track (or resume)
    if (!isSame) {
      audio.src = src;
    }

    // Set all UI to Play first, then update current
    document.querySelectorAll(".audio-btn").forEach(b => setButtonText(b, false));
    setButtonText(metaBtn, true);

    const inlineBtn = figure.querySelector(".audio-btn");
    setButtonText(inlineBtn, true);

    audio.play().catch(() => {
      // Autoplay blocked or user gesture needed; leave buttons as Play
      setButtonText(metaBtn, false);
      setButtonText(inlineBtn, false);
    });
  };

  // When audio ends, reset buttons
  audio.addEventListener("ended", () => {
    document.querySelectorAll(".audio-btn").forEach(b => setButtonText(b, false));
    setButtonText(metaBtn, false);
  });

  // ---------------------------
  // Lightbox open/close
  // ---------------------------
  const openLightbox = (imgSrc, figure) => {
    if (!lightbox || !lightboxImg) return;

    activeFigure = figure || null;

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    lightboxImg.src = imgSrc || "";
    lightboxImg.alt = figure?.getAttribute("data-title") || "Expanded image";

    // If this figure has audio, show meta bar
    const title = figure?.getAttribute("data-title") || "";
    const audioSrc = figure?.getAttribute("data-audio") || "";

    if (meta && metaTitle && metaBtn && audioSrc) {
      meta.hidden = false;
      metaTitle.textContent = title;

      // Show correct state
      const isSame = (audio.src && audio.src.includes(audioSrc));
      setButtonText(metaBtn, isSame && !audio.paused);
    } else if (meta) {
      meta.hidden = true;
    }
  };

  const closeLightbox = () => {
    if (!lightbox || !lightboxImg) return;

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    // Do NOT force-stop audio on close (feels premium),
    // but keep UI consistent if reopened.
    activeFigure = null;
    lightboxImg.src = "";
  };

  btnClose?.addEventListener("click", closeLightbox);

  // Close on backdrop click
  lightbox?.addEventListener("click", (e) => {
    const card = lightbox.querySelector(".lightbox-card");
    if (card && !card.contains(e.target)) closeLightbox();
  });

  // Close on Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox?.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  // ---------------------------
  // Open image from any .shot-open
  // ---------------------------
  document.querySelectorAll(".shot-open").forEach(btn => {
    btn.addEventListener("click", () => {
      const img = btn.getAttribute("data-img");
      const fig = btn.closest("figure");
      openLightbox(img, fig);
    });
  });

  // ---------------------------
  // Inline audio Play buttons on cards
  // ---------------------------
  document.querySelectorAll(".shot.has-audio .audio-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const fig = btn.closest("figure");
      playAudioForFigure(fig);
    });
  });

  // ---------------------------
  // Expanded view Play button
  // ---------------------------
  metaBtn?.addEventListener("click", () => {
    if (!activeFigure) return;
    playAudioForFigure(activeFigure);
  });

  // If user clicks a new card while audio playing, keep audio but UI updates on next action.
})();
