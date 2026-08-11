(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function queryExperience() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("experience") ||
      "craig-boddington"
    );
  }

  async function loadExperience() {
    const slug =
      queryExperience();

    const templateUrl =
      "../../templates/showcase-v1/template.json";

    const experienceUrl =
      `../../experiences/${slug}/experience.json`;

    const registryUrl =
      "../../registry/room-registry.json";

    const [
      result,
      roomRegistry
    ] =
      await Promise.all([
        window.DeerCampDXBLoader.load({
          templateUrl,
          experienceUrl
        }),

        window.DeerCampDXBLoader
          .fetchJson(
            registryUrl
          )
      ]);

    const validation =
      window.DeerCampDXBValidator.validate(
        result.experience
      );

    if (!validation.valid) {
      throw new Error(
        "DXB experience validation failed: " +
        JSON.stringify(
          validation.errors
        )
      );
    }

    window.DeerCampDXBExperience =
      result.experience;

    window.DeerCampDXBValidation =
      validation;

    window.DeerCampDXBRoomRegistry =
      roomRegistry;

    return result.experience;
  }

  function setText(selector, value) {
    const element =
      document.querySelector(selector);

    if (
      !element ||
      !clean(value)
    ) {
      return;
    }

    element.textContent =
      clean(value);
  }

  function applyDocumentTitle(
    experience
  ) {
    document.title =
      `${
        clean(
          experience.identity?.campName
        ) ||
        "DeerCamp"
      } | DeerCamp`;
  }

  function applyOpening(
    experience
  ) {
    const opening =
      experience.showcase?.opening ||
      {};

    setText(
      "[data-dxb-opening-eyebrow]",
      opening.eyebrow
    );

    setText(
      "[data-dxb-opening-title]",
      opening.title
    );

    setText(
      "[data-dxb-opening-body]",
      opening.body
    );

    setText(
      "[data-dxb-opening-continue]",
      opening.continueLabel
    );

    setText(
      "[data-dxb-guest-name]",
      opening.guestName
    );
  }

  function applyTabletop(
    experience
  ) {
    const tabletop =
      experience.showcase?.tabletop ||
      {};

    const campName =
      clean(tabletop.campName) ||
      clean(
        experience.identity?.campName
      );

    setText(
      "[data-dxb-tabletop-camp-name]",
      campName
    );

    setText(
      "[data-dxb-tabletop-subtitle]",
      tabletop.subtitle
    );

    setText(
      "[data-dxb-tabletop-guidance]",
      tabletop.guidance
    );

    setText(
      "[data-dxb-tabletop-start-guidance]",
      tabletop.startGuidance
    );

    document.documentElement
      .setAttribute(
        "data-dxb-start-room",
        clean(
          tabletop.startRoom ||
          "archives"
        )
      );
  }

  function applyExperience(
    experience
  ) {
    applyDocumentTitle(
      experience
    );

    applyOpening(
      experience
    );

    applyTabletop(
      experience
    );

    document.documentElement
      .setAttribute(
        "data-dxb-experience",
        clean(
          experience.slug
        )
      );

    if (
      window.DeerCampDXBDOMBinder &&
      typeof window.DeerCampDXBDOMBinder.bind ===
        "function"
    ) {
      window.DeerCampDXBDOMBinding =
        window.DeerCampDXBDOMBinder.bind(
          experience,
          window.DeerCampDXBRoomRegistry
        );
    }

    window.dispatchEvent(
      new CustomEvent(
        "deercamp:dxb-ready",
        {
          detail: {
            experience
          }
        }
      )
    );
  }

  async function boot() {
    try {
      const experience =
        await loadExperience();

      applyExperience(
        experience
      );

      console.info(
        "DXB Showcase Runtime ready:",
        experience.slug
      );
    }
    catch (error) {
      console.error(
        "DXB Showcase Runtime failed:",
        error
      );
    }
  }

  window.DeerCampDXBShowcaseRuntime = {
    version:
      "1.0.0",

    boot,
    loadExperience,
    applyExperience
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }
  else {
    boot();
  }
})();

