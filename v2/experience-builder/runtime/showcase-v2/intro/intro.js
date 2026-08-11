(() => {
  const video = document.getElementById('campIntro');
  const start = document.getElementById('startIntro');
  const tabletopUrl = '../tabletop/';

  const enterTabletop = () => {
    document.body.classList.add('leaving');
    window.setTimeout(() => window.location.assign(tabletopUrl), 260);
  };

  async function playIntro() {
    try {
      video.currentTime = 0;
      video.muted = false;
      await video.play();
      start.hidden = true;
    } catch (error) {
      start.hidden = false;
      start.textContent = 'Play the Introduction';
      console.warn('Intro playback requires another user gesture.', error);
    }
  }

  start.addEventListener('click', playIntro);
  video.addEventListener('ended', enterTabletop);
  video.addEventListener('error', () => {
    start.hidden = false;
    start.textContent = 'Intro unavailable — Enter Camp';
    start.onclick = enterTabletop;
  }, { once: true });

  // The landing-page click is already a user gesture, but browsers may still
  // require a second click after navigation before audio can begin.
  playIntro();
})();
