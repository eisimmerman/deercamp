/* =========================================================
   DeerCamp — script.js
   - Mobile nav drawer
   - CampCards lightbox (expand on click)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------------------------
     Mobile Nav Drawer
     --------------------------- */
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.getElementById("navDrawer");

  function setDrawer(open) {
    if (!toggle || !drawer) return;
    drawer.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    drawer.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (toggle && drawer) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setDrawer(!isOpen);
    });

    // Close drawer when clicking outside
    document.addEventListener("click", (e) => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (!isOpen) return;
      if (drawer.contains(e.target) || toggle.contains(e.target)) return;
      setDrawer(false);
    });

    // Close drawer when tapping a link
    drawer.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setDrawer(false));
    });

    // Esc closes
    document.addEventListener("keydown", (e) => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (isOpen && e.key === "Escape") setDrawer(false);
    });

    // start closed
    setDrawer(false);
  }

  /* ---------------------------
     CampCards Lightbox
     Expected markup:
       button.shot-open[data-img][data-title]
     Optional:
       figure.shot[data-audio="..."]
     --------------------------- */
  let lightbox = document.querySelector(".lightbox");
  if (!lightbox) {
    // create it if missing
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.innerHTML = `
      <div class="lightbox-panel" role="dialog" aria-modal="true" aria-label="Image preview">
        <div class="lightbox-top">
          <div class="lightbox-title" id="lbTitle"></div>
          <button class="lightbox-x" type="button" aria-label="Close">×</button>
        </div>
        <img class="lightbox-img" id="lbImg" alt="">
        <div class="lightbox-controls">
          <button class="lb-audio" id="lbAudio" type="button" style="display:none;">Play audio</button>
          <button class="lb-close" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(lightbox);
  }

  const lbImg = lightbox.querySelector("#lbImg");
  const lbTitle = lightbox.querySelector("#lbTitle");
  const lbClose = lightbox.querySelector(".lb-close");
  const lbX = lightbox.querySelector(".lightbox-x");
  const lbAudioBtn = lightbox.querySelector("#lbAudio");

  let audioEl = null;

  function closeLightbox() {
    lightbox.classList.remove("open");
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
    document.body.style.overflow = "";
  }

  function openLightbox({ src, title, audioSrc }) {
    lbImg.src = src;
    lbImg.alt = title || "Preview";
    lbTitle.textContent = title || "";

    // audio
    if (audioSrc) {
      if (!audioEl) audioEl = new Audio();
      audioEl.src = audioSrc;
      lbAudioBtn.style.display = "inline-flex";
      lbAudioBtn.textContent = "Play audio";
    } else {
      lbAudioBtn.style.display = "none";
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
    }

    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  // Close handlers
  lbClose?.addEventListener("click", closeLightbox);
  lbX?.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    // click backdrop closes
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("open") && e.key === "Escape") closeLightbox();
  });

  // Audio button
  lbAudioBtn?.addEventListener("click", () => {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => {});
      lbAudioBtn.textContent = "Pause audio";
    } else {
      audioEl.pause();
      lbAudioBtn.textContent = "Play audio";
    }
  });

  // Wire up all cards
  document.querySelectorAll(".shot-open").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const src = btn.getAttribute("data-img");
      const title = btn.getAttribute("data-title") || "";
      const figure = btn.closest(".shot");
      const audioSrc = figure?.getAttribute("data-audio") || "";

      if (!src) return;
      openLightbox({ src, title, audioSrc: audioSrc || null });
    });
  });
});
