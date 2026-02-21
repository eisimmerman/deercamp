(() => {
  const lightbox = document.getElementById("lightbox");
  const lbImg = lightbox?.querySelector(".lightbox-img");
  const lbCloseX = lightbox?.querySelector(".lightbox-close");
  const lbCloseBtn = lightbox?.querySelector(".lightbox-close-btn");
  const lbAudioBtn = lightbox?.querySelector(".lightbox-audio-btn");

  let audio = null;
  let activeAudioBtn = null;

  function stopAudio() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio = null;

    if (activeAudioBtn) {
      activeAudioBtn.textContent = "Play";
      activeAudioBtn = null;
    }
    if (lbAudioBtn) lbAudioBtn.textContent = "Play";
  }

  function closeLightbox() {
    if (!lightbox) return;
    stopAudio();
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    if (lbImg) lbImg.src = "";
    if (lbAudioBtn) {
      lbAudioBtn.style.display = "none";
      lbAudioBtn.removeAttribute("data-audio");
    }
  }

  function openLightbox({ imgSrc, audioSrc }) {
    if (!lightbox || !lbImg) return;

    lbImg.src = imgSrc;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");

    // Lightbox audio button visibility/behavior
    if (lbAudioBtn) {
      if (audioSrc) {
        lbAudioBtn.style.display = "inline-flex";
        lbAudioBtn.setAttribute("data-audio", audioSrc);
        lbAudioBtn.textContent = "Play";
      } else {
        lbAudioBtn.style.display = "none";
        lbAudioBtn.removeAttribute("data-audio");
      }
    }
  }

  // Bind thumbnail open (image -> lightbox)
  document.querySelectorAll(".shot .shot-open").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const fig = btn.closest(".shot");
      const imgSrc = btn.getAttribute("data-img");
      const audioSrc = fig?.getAttribute("data-audio") || "";

      openLightbox({ imgSrc, audioSrc });
    });
  });

  // Bind thumbnail audio buttons
  document.querySelectorAll(".shot.has-audio .audio-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      const fig = btn.closest(".shot.has-audio");
      const src = fig?.getAttribute("data-audio");
      if (!src) return;

      // If different button, stop old audio first
      if (activeAudioBtn && activeAudioBtn !== btn) stopAudio();

      // Toggle
      if (!audio) {
        audio = new Audio(src);
        audio.addEventListener("ended", () => {
          stopAudio();
        });
        audio.play().catch(() => {});
        btn.textContent = "Pause";
        activeAudioBtn = btn;
      } else {
        stopAudio();
      }
    });
  });

  // Lightbox audio button
  if (lbAudioBtn) {
    lbAudioBtn.addEventListener("click", () => {
      const src = lbAudioBtn.getAttribute("data-audio");
      if (!src) return;

      // If any thumbnail audio playing, stop it
      stopAudio();

      // Toggle lightbox audio using same global `audio`
      if (!audio) {
        audio = new Audio(src);
        audio.addEventListener("ended", () => stopAudio());
        audio.play().catch(() => {});
        lbAudioBtn.textContent = "Pause";
        activeAudioBtn = null; // lightbox owns UI now
      } else {
        stopAudio();
      }
    });
  }

  // Close handlers
  lbCloseX?.addEventListener("click", closeLightbox);
  lbCloseBtn?.addEventListener("click", closeLightbox);

  // Close when clicking outside image
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox?.classList.contains("open")) {
      closeLightbox();
    }
  });
})();
