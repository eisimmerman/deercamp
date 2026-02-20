(() => {
  // ---------- Lightbox ----------
  const lb = document.getElementById("lightbox");
  const lbImg = lb?.querySelector(".lightbox-img");
  const lbClose = lb?.querySelector(".lightbox-close");

  function openLightbox(src, alt = "") {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt || "";
    lb.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lb || !lbImg) return;
    lb.setAttribute("aria-hidden", "true");
    lbImg.src = "";
    lbImg.alt = "";
  }

  document.querySelectorAll(".shot-open").forEach(btn => {
    btn.addEventListener("click", () => {
      const imgSrc = btn.getAttribute("data-img");
      const figure = btn.closest(".shot");
      const img = figure?.querySelector("img");
      if (imgSrc) openLightbox(imgSrc, img?.alt || "");
    });
  });

  lbClose?.addEventListener("click", closeLightbox);
  lb?.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  // ---------- Audio per card (stop others automatically) ----------
  let currentAudio = null;
  let currentBtn = null;

  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentBtn) currentBtn.textContent = "Play";
    currentAudio = null;
    currentBtn = null;
  }

  document.querySelectorAll(".shot.has-audio").forEach(card => {
    const audioSrc = card.getAttribute("data-audio");
    const btn = card.querySelector(".audio-btn");
    if (!audioSrc || !btn) return;

    const audio = new Audio(audioSrc);
    audio.preload = "none";

    btn.addEventListener("click", (e) => {
      // Prevent opening the lightbox when clicking play/pause
      e.stopPropagation();

      if (currentAudio && currentAudio !== audio) stopCurrent();

      if (audio.paused) {
        currentAudio = audio;
        currentBtn = btn;
        btn.textContent = "Pause";
        audio.play().catch(() => {
          btn.textContent = "Play";
          currentAudio = null;
          currentBtn = null;
        });
      } else {
        audio.pause();
        btn.textContent = "Play";
        currentAudio = null;
        currentBtn = null;
      }
    });

    audio.addEventListener("ended", () => {
      if (currentBtn === btn) btn.textContent = "Play";
      if (currentAudio === audio) {
        currentAudio = null;
        currentBtn = null;
      }
    });
  });
})();
