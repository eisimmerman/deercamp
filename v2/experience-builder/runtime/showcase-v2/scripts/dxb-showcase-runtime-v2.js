(function () {
  "use strict";

  const VERSION =
    "2.0.0";

  const screens = {};

  function screen(name) {
    return screens[name] || null;
  }

  function discoverScreens() {
    document
      .querySelectorAll(
        "[data-dxb-screen]"
      )
      .forEach(element => {
        screens[
          element.dataset.dxbScreen
        ] = element;
      });
  }

  function show(name) {
    Object.values(
      screens
    ).forEach(element => {
      element.classList.remove(
        "active"
      );
    });

    const selected =
      screen(name);

    if (!selected) {
      console.warn(
        "DXB screen not found:",
        name
      );

      return;
    }

    selected.classList.add(
      "active"
    );

    window.scrollTo(
      0,
      0
    );
  }

  function queryExperienceSlug() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get(
        "experience"
      ) || ""
    ).trim();
  }

  async function loadExperience() {
    const slug =
      queryExperienceSlug();

    if (!slug) {
      throw new Error(
        "DXB experience parameter is required."
      );
    }

    const url =
      `/v2/experience-builder/experiences/${encodeURIComponent(
        slug
      )}/experience.json`;

    const response =
      await fetch(
        url,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `DXB experience load failed: ${url} (${response.status})`
      );
    }

    return await response.json();
  }

  function applyCompletionFromQuery(
    experience
  ) {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const completed =
      (
        params.get(
          "completed"
        ) || ""
      ).trim();

    if (
      completed &&
      window.DeerCampDXBProgress
        ?.markComplete
    ) {
      window.DeerCampDXBProgress
        .markComplete(
          experience,
          completed
        );
    }
  }

  function bindControls(
    experience
  ) {
    const enterButton =
      document.getElementById(
        "enterButton"
      );

    const aboutButton =
      document.getElementById(
        "aboutButton"
      );

    const closeButton =
      document.getElementById(
        "closeButton"
      );

    const continueButton =
      document.getElementById(
        "continueButton"
      );

    const skipButton =
      document.getElementById(
        "skipButton"
      );

    const journeyBackButton =
      document.getElementById(
        "journeyBackButton"
      );

    if (enterButton) {
      enterButton.addEventListener(
        "click",
        () => {
          if (
            experience?.showcase
              ?.about
              ?.enabled
          ) {
            show("about");
          }
          else if (
            experience?.showcase
              ?.opening
              ?.introVideo
          ) {
            show("intro");
          }
          else {
            show("tabletop");
          }
        }
      );
    }

    if (aboutButton) {
      aboutButton.addEventListener(
        "click",
        () => show("about")
      );
    }

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        () => show("welcome")
      );
    }

    if (continueButton) {
      continueButton.addEventListener(
        "click",
        () => {
          if (
            experience?.showcase
              ?.opening
              ?.introVideo
          ) {
            show("intro");
          }
          else {
            show("tabletop");
          }
        }
      );
    }

    if (skipButton) {
      skipButton.addEventListener(
        "click",
        () => show("tabletop")
      );
    }

    if (journeyBackButton) {
      journeyBackButton.addEventListener(
        "click",
        () => show("tabletop")
      );
    }
  }

  function bindSteveArchivesTabletopReturn(
    experience
  ) {
    if (
      String(
        experience?.slug || ""
      ).trim() !== "steve-rinella"
    ) {
      return;
    }

    const launcher =
      document.querySelector(
        "[data-dxb-room-launcher]"
      );

    if (!launcher) {
      return;
    }

    const controls =
      Array.from(
        launcher.querySelectorAll(
          "button, a, [role='button'], div"
        )
      );

    const archives =
      controls.find(
        element =>
          String(
            element.textContent || ""
          )
            .trim()
            .toLowerCase()
            .includes("archives")
      );

    if (!archives) {
      console.warn(
        "DXB-016K.2 Archives tabletop control not found."
      );
      return;
    }

    archives.style.pointerEvents =
      "auto";

    archives.style.cursor =
      "pointer";

    archives.style.opacity =
      "1";

    archives.removeAttribute?.(
      "disabled"
    );

    archives.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        window.location.href =
          "/v2/experience-builder/runtime/showcase-v2/rooms/archives/index.html" +
          "?experience=steve-rinella" +
          "&v=20260811-dxb016k2";
      }
    );

    console.log(
      "DXB-016K.2 Archives tabletop return ready."
    );
  }


  async function start() {
    discoverScreens();

    const experience =
      await loadExperience();

    window.DeerCampDXBExperience =
      experience;

    if (
      window.DeerCampDXBProgress
        ?.start
    ) {
      window.DeerCampDXBProgress.start(
        experience
      );
    }

    applyCompletionFromQuery(
      experience
    );

    if (
      window.DeerCampDXBDOMBinderV2
        ?.bind
    ) {
      await window.DeerCampDXBDOMBinderV2.bind(
        experience,
        window.DeerCampDXBRoomRegistry
      );
    }
    else {
      throw new Error(
        "DXB DOM Binder v2 is unavailable."
      );
    }

    bindControls(
      experience
    );

    bindSteveArchivesTabletopReturn(
      experience
    );

    const startupParams =
      new URLSearchParams(
        window.location.search
      );

    const requestedScreen =
      (
        startupParams.get("screen") ||
        ""
      ).trim();

    if (
      requestedScreen === "tabletop"
    ) {
      show(
        "tabletop"
      );
    }
    else {
      show(
        "welcome"
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        "deercamp:dxb-runtime-ready",
        {
          detail: {
            version:
              VERSION,

            experience
          }
        }
      )
    );

    console.log(
      "DXB Showcase Runtime v2 ready:",
      experience.slug
    );
  }

  window.DeerCampDXBShowcaseRuntimeV2 = {
    version:
      VERSION,

    start,

    show
  };

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      start().catch(error => {
        console.error(
          "DXB Runtime v2 failed:",
          error
        );
      });
    }
  );
})();


