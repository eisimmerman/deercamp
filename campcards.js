(() => {
  const cards = Array.from(document.querySelectorAll("[data-card]"));

  const fmtTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—:—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const stopCard = (card) => {
    const audio = card.querySelector("audio");
    const btn = card.querySelector("[data-play]");
    if (!audio || !btn) return;

    audio.pause();
    audio.currentTime = 0;
    btn.textContent = "▶ Play";
    btn.setAttribute("aria-pressed", "false");
    card.classList.remove("is-playing");
  };

  const pauseOthers = (currentCard) => {
    cards.forEach((c) => {
      if (c !== currentCard) stopCard(c);
    });
  };

  cards.forEach((card) => {
    const audio = card.querySelector("audio");
    const btn = card.querySelector("[data-play]");
    const time = card.querySelector("[data-time]");

    if (!audio || !btn || !time) return;

    audio.addEventListener("loadedmetadata", () => {
      time.textContent = fmtTime(audio.duration);
    });

    audio.addEventListener("ended", () => {
      btn.textContent = "▶ Play";
      btn.setAttribute("aria-pressed", "false");
      card.classList.remove("is-playing");
    });

    btn.addEventListener("click", () => {
      const isPressed = btn.getAttribute("aria-pressed") === "true";

      if (isPressed) {
        // Pause only (don’t reset)
        audio.pause();
        btn.textContent = "▶ Play";
        btn.setAttribute("aria-pressed", "false");
        card.classList.remove("is-playing");
        return;
      }

      pauseOthers(card);

      audio.play().catch(() => {
        // If autoplay/play blocked, no crash; user can tap again
      });

      btn.textContent = "⏸ Pause";
      btn.setAttribute("aria-pressed", "true");
      card.classList.add("is-playing");
    });
  });
})();
