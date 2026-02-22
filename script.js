(() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------------------------
  // Mobile nav drawer
  // ---------------------------
  const toggle = qs(".nav-toggle");
  const drawer = qs(".nav-drawer");

  const openDrawer = () => {
    drawer.style.display = "block";
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    drawer.style.display = "none";
    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  if (toggle && drawer) {
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      isOpen ? closeDrawer() : openDrawer();
    });

    drawer.addEventListener("click", (e) => {
      // click outside inner closes
      if (e.target === drawer) closeDrawer();
    });

    qsa(".nav-drawer a").forEach(a => {
      a.addEventListener("click", () => closeDrawer());
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
  }

  // ---------------------------
  // Shared audio controller
  // ---------------------------
  const audio = new Audio();
  audio.preload = "none";

  let activeAudioBtn = null;    // button in grid (if any)
  let activeFigure = null;      // figure tied to audio
  let lightboxAudioBtn = null;  // button in lightbox (if any)

  const setBtnState = (btn, playing) => {
    if (!btn) return;
    btn.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-label", playing ? "Pause audio" : "Play audio");
  };

  const stopAudio = () => {
    audio.pause();
    audio.currentTime = 0;
    setBtnState(activeAudioBtn, false);
    setBtnState(lightboxAudioBtn, false);
    activeAudioBtn = null;
    activeFigure = null;
  };

  const playAudioSrc = (src, btnToUpdate = null) => {
    if (!src) return;

    // If same src toggles pause/play
    const same = (audio.src && audio.src.endsWith(src)) || audio.src === src;

    if (same && !audio.paused) {
      audio.pause();
      setBtnState(btnToUpdate, false);
      setBtnState(lightboxAudioBtn, false);
      return;
    }

    // Switching tracks: stop previous
    if (!same) {
      setBtnState(activeAudioBtn, false);
      setBtnState(lightboxAudioBtn, false);
      audio.src = src;
    }

    audio.play().then(() => {
      setBtnState(btnToUpdate, true);
      setBtnState(lightboxAudioBtn, true);
    }).catch(() => {
      // Autoplay restrictions can block. User can tap again.
      setBtnState(btnToUpdate, false);
      setBtnState(lightboxAudioBtn, false);
    });
  };

  audio.addEventListener("ended", () => {
    setBtnState(activeAudioBtn, false);
    setBtnState(lightboxAudioBtn, false);
  });

  // ---------------------------
  // Lightbox with "Close" above Play
  // ---------------------------
  const lightbox = qs("#lightbox");
  const lbImg = qs(".lightbox-img");
  const lbX = qs(".lightbox-x");
  const lbClose = qs(".lb-close");
  const lbAudio = qs(".lb-audio");
  const lbTitle = qs("#lightboxTitle");

  let lightboxAudioSrc = null;

  const openLightbox = ({ imgSrc, title, audioSrc }) => {
    if (!lightbox || !lbImg) return;

    lbImg.src = imgSrc;
    lbImg.alt = title || "";
    if (lbTitle) lbTitle.textContent = title || "";

    lightboxAudioSrc = audioSrc || null;
    lightboxAudioBtn = lbAudio;

    // Show/hide play button depending on whether this is an audio card
    if (lbAudio) {
      lbAudio.style.display = lightboxAudioSrc ? "inline-flex" : "none";
      setBtnState(lbAudio, false);
    }

    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    // If audio was started from lightbox, stop it (clean + intuitive)
    stopAudio();

    // Clear image
    if (lbImg) lbImg.src = "";
    if (lbTitle) lbTitle.textContent = "";
    lightboxAudioSrc = null;
  };

  if (lbX) lbX.addEventListener("click", closeLightbox);
  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      // clicking outside the panel closes
      if (e.target === lightbox) closeLightbox();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  if (lbAudio) {
    lbAudio.addEventListener("click", () => {
      if (!lightboxAudioSrc) return;
      // Lightbox controls drive shared audio instance
      activeAudioBtn = null; // grid button not driving this right now
      playAudioSrc(lightboxAudioSrc, lbAudio);
    });
  }

  // ---------------------------
  // CampCards grid behavior
  // ---------------------------
  qsa(".shot").forEach(fig => {
    const openBtn = qs(".shot-open", fig);
    const audioBtn = qs(".audio-btn", fig);
    const img = qs("img", fig);
    const title = fig.getAttribute("data-title") || (img ? img.alt : "");
    const audioSrc = fig.getAttribute("data-audio");

    // Open expanded view
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const imgSrc = openBtn.getAttribute("data-img") || (img ? img.src : "");
        openLightbox({ imgSrc, title, audioSrc });
      });
    }

    // Play in-grid
    if (audioBtn && audioSrc) {
      audioBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeAudioBtn = audioBtn;
        activeFigure = fig;

        // ensure lightbox button (if open) reflects state
        if (lightbox && lightbox.classList.contains("open")) {
          // if currently open and same audio, keep in sync
          lightboxAudioBtn = lbAudio;
        } else {
          lightboxAudioBtn = null;
        }

        playAudioSrc(audioSrc, audioBtn);
      });
    }
  });

})();
