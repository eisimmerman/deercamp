/* =========================
   DeerCamp - script.js
   - Lightbox image viewer
   - CampCards audio play/pause (thumbnail + lightbox)
   ========================= */

(function () {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  // Ensure inner wrapper exists (so we can add controls cleanly)
  let inner = lightbox.querySelector(".lightbox-inner");
  const imgEl = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");

  if (!inner) {
    inner = document.createElement("div");
    inner.className = "lightbox-inner";

    // Move existing elements into inner
    const existingClose = closeBtn;
    const existingImg = imgEl;

    lightbox.innerHTML = "";
    inner.appendChild(existingClose);
    inner.appendChild(existingImg);
    lightbox.appendChild(inner);
  }

  // Create controls bar (title + audio button). Hidden unless audio exists.
  const controls = document.createElement("div");
  controls.className = "lightbox-controls";
  controls.style.display = "none";
  controls.innerHTML = `
    <div class="lightbox-title"></div>
    <button class="lightbox-audio-btn" type="button">Play</button>
  `;
  inner.appendChild(controls);

  const lbTitle = controls.querySelector(".lightbox-title");
  const lbAudioBtn = controls.querySelector(".lightbox-audio-btn");

  // Single global audio element
  const audio = new Audio();
  audio.preload = "none";

  let currentFigure = null; // currently opened figure in lightbox

  function setButtonState(btn, isPlaying) {
    if (!btn) return;
    btn.classList.toggle("is-playing", !!isPlaying);
    btn.textContent = isPlaying ? "Pause" : "Play";
  }

  function stopAudio() {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
    // reset all thumbnail buttons UI
    document.querySelectorAll(".audio-btn").forEach((b) => setButtonState(b, false));
    setButtonState(lbAudioBtn, false);
  }

  function playFigureAudio(fig) {
    if (!fig) return;

    const src = fig.getAttribute("data-audio");
    if (!src) return;

    // If switching tracks or starting fresh
    if (audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
    }

    audio.play().then(() => {
      // Update UI buttons
      document.querySelectorAll(".audio-btn").forEach((b) => setButtonState(b, false));
      const thumbBtn = fig.querySelector(".audio-btn");
      setButtonState(thumbBtn, true);
      setButtonState(lbAudioBtn, true);
    }).catch(() => {
      // autoplay policies sometimes block; user can click again
    });
  }

  function toggleFigureAudio(fig, sourceBtn) {
    const src = fig.getAttribute("data-audio");
    if (!src) return;

    const absolute = new URL(src, window.location.href).href;
    const isSame = audio.src === absolute;
    const isPlaying = !audio.paused && isSame;

    if (isPlaying) {
      audio.pause();
      setButtonState(sourceBtn, false);
      // also update other matching buttons
      setButtonState(fig.querySelector(".audio-btn"), false);
      setButtonState(lbAudioBtn, false);
    } else {
      // If different track: stop and switch
      if (!isSame) stopAudio();
      playFigureAudio(fig);
    }
  }

  function openLightbox(src, titleText, fig) {
    currentFigure = fig || null;

    imgEl.src = src;
    imgEl.alt = titleText || "";

    // Controls visibility based on audio
    const hasAudio = fig && fig.classList.contains("has-audio") && fig.getAttribute("data-audio");
    if (hasAudio) {
      controls.style.display = "flex";
      lbTitle.textContent = titleText || "CampCard";
      setButtonState(lbAudioBtn, false);
    } else {
      controls.style.display = "none";
      lbTitle.textContent = "";
      setButtonState(lbAudioBtn, false);
    }

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    imgEl.src = "";
    imgEl.alt = "";
    currentFigure = null;
    // Do NOT force-stop audio on close (feels nice to keep narration going)
    // If you want it to stop: uncomment next line.
    // stopAudio();
  }

  // ===== Thumbnail: open image (but not when clicking Play) =====
  document.addEventListener("click", (e) => {
    const audioBtn = e.target.closest(".audio-btn");
    if (audioBtn) {
      // Play button should NOT open lightbox
      e.preventDefault();
      e.stopPropagation();
      const fig = audioBtn.closest("figure.shot");
      if (!fig) return;
      toggleFigureAudio(fig, audioBtn);
      return;
    }

    const openBtn = e.target.closest(".shot-open");
    if (openBtn) {
      e.preventDefault();
      const fig = openBtn.closest("figure.shot");
      const src = openBtn.getAttribute("data-img");
      const titleText = fig?.querySelector("figcaption span")?.textContent
        || fig?.querySelector("figcaption")?.textContent
        || "Image";
      if (src) openLightbox(src, titleText.trim(), fig);
      return;
    }
  });

  // ===== Lightbox audio button =====
  lbAudioBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentFigure) return;
    toggleFigureAudio(currentFigure, lbAudioBtn);
  });

  // ===== Close actions =====
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeLightbox();
  });

  // Click backdrop closes (but not clicks inside inner)
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  // When audio ends, reset buttons
  audio.addEventListener("ended", () => {
    document.querySelectorAll(".audio-btn").forEach((b) => setButtonState(b, false));
    setButtonState(lbAudioBtn, false);
  });

})();
