document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     Mobile Nav Drawer
  ========================================================= */
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.getElementById("navDrawer");

  function setDrawer(open) {
    if (!toggle || !drawer) return;
    drawer.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  if (toggle && drawer) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setDrawer(!isOpen);
    });

    document.addEventListener("click", (e) => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (!isOpen) return;
      if (drawer.contains(e.target) || toggle.contains(e.target)) return;
      setDrawer(false);
    });
  }
// --- CampCards asset path stabilization ---
function normalizeCampcardPath(p) {
  if (!p) return p;
  // If already root-relative, keep it
  if (p.startsWith("/campcards/")) return p;

  // Strip any leading ./ or /
  p = p.replace(/^(\.\/)+/, "").replace(/^\/+/, "");

  // If it already contains campcards/, force root to /campcards/
  if (p.startsWith("campcards/")) return "/" + p;

  // If someone accidentally used deercamp/campcards/, fix it
  p = p.replace(/^deercamp\/campcards\//, "campcards/");

  // If it’s just images/... or audio/..., prefix it
  if (p.startsWith("images/") || p.startsWith("audio/")) return "/campcards/" + p;

  return "/campcards/" + p;
}

// normalize all campcard nodes
document.querySelectorAll(".shot[data-audio], .shot-open[data-img]").forEach(el => {
  if (el.dataset.audio) el.dataset.audio = normalizeCampcardPath(el.dataset.audio);
  if (el.dataset.img) el.dataset.img = normalizeCampcardPath(el.dataset.img);
});
  /* =========================================================
     CampCards Audio (ENABLED)
     - Only one audio plays at a time
     - Works on mobile & desktop
  ========================================================= */

  let currentAudio = null;
  let currentBtn = null;

  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentBtn) {
      currentBtn.classList.remove("is-playing");
      currentBtn.textContent = "Play";
    }
    currentAudio = null;
    currentBtn = null;
  }

  document.querySelectorAll(".shot[data-audio]").forEach((figure) => {
    const audioSrc = figure.getAttribute("data-audio");
    if (!audioSrc) return;

    const btn = figure.querySelector(".audio-btn");
    if (!btn) return;

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // If clicking the same button that's already playing → pause
      if (currentAudio && currentBtn === btn && !currentAudio.paused) {
        stopCurrent();
        return;
      }

      // Stop any existing audio first
      stopCurrent();

      const audio = new Audio(audioSrc);
      currentAudio = audio;
      currentBtn = btn;

      btn.classList.add("is-playing");
      btn.textContent = "Pause";

      audio.addEventListener("ended", () => {
        stopCurrent();
      });

      try {
        await audio.play();
      } catch (err) {
        stopCurrent();
        console.warn("Audio failed to play:", err);
      }
    });
  });

  /* =========================================================
     CampCards Mobile Show / Hide Toggle
  ========================================================= */

  const campcards = document.getElementById("campcards");
  const toggleBtn = document.querySelector(".campcards-toggle");

  if (campcards && toggleBtn) {
    function setExpanded(expanded){
      campcards.classList.toggle("is-expanded", expanded);
      toggleBtn.setAttribute("aria-expanded", String(expanded));
      toggleBtn.textContent = expanded ? "Show less" : "Show all 12";
    }

    setExpanded(false);

    toggleBtn.addEventListener("click", () => {
      const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      setExpanded(!expanded);

      if (expanded) {
        campcards.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

});
