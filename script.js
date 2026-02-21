(() => {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox?.querySelector(".lightbox-img");
  const closeBtn = lightbox?.querySelector(".lightbox-close");

  // --- Lightbox helpers ---
  function openLightbox(src, alt = "") {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    // clear after fade-ish
    setTimeout(() => {
      lightboxImg.src = "";
      lightboxImg.alt = "";
    }, 50);
  }

  closeBtn?.addEventListener("click", closeLightbox);

  lightbox?.addEventListener("click", (e) => {
    // close when clicking backdrop (not image)
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  // --- Audio player (single shared instance) ---
  let currentAudio = null;
  let currentBtn = null;

  function setBtnState(btn, isPlaying) {
    if (!btn) return;
    btn.textContent = isPlaying ? "Pause" : "Play";
    btn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
  }

  function stopCurrentAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentBtn) {
      setBtnState(currentBtn, false);
      currentBtn = null;
    }
  }

  // --- Delegated clicks ---
  document.addEventListener("click", async (e) => {
    const openBtn = e.target.closest(".shot-open");
    const audioBtn = e.target.closest(".audio-btn");

    // Play/Pause audio
    if (audioBtn) {
      const figure = audioBtn.closest(".shot.has-audio");
      const src = figure?.getAttribute("data-audio");
      if (!src) return;

      // If clicking same button currently playing => toggle
      const isSame = currentBtn === audioBtn;

      if (!isSame) {
        // stop any other audio first
        stopCurrentAudio();
        currentAudio = new Audio(src);
        currentBtn = audioBtn;

        currentAudio.addEventListener("ended", () => {
          setBtnState(audioBtn, false);
          currentAudio = null;
          currentBtn = null;
        });
      }

      if (currentAudio.paused) {
        try {
          await currentAudio.play();
          setBtnState(audioBtn, true);
        } catch (err) {
          // If autoplay policies block, user must click again; still safe.
          setBtnState(audioBtn, false);
          console.warn("Audio play blocked:", err);
        }
      } else {
        currentAudio.pause();
        setBtnState(audioBtn, false);
      }
      return;
    }

    // Open lightbox
    if (openBtn) {
      const src = openBtn.getAttribute("data-img");
      if (!src) return;
      // best-effort alt: pull from sibling img
      const img = openBtn.parentElement?.querySelector("img");
      const alt = img?.getAttribute("alt") || "";
      openLightbox(src, alt);
      return;
    }
  });
})();
