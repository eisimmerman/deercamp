(function () {
  "use strict";

  const ACTIVE_CAMP_KEY = "deercamp.activeCampId";
  const CAMP_DATA_KEY = "campData";

  function safeParse(raw, fallback = {}) {
    try {
      const parsed = JSON.parse(raw || "");
      return parsed && typeof parsed === "object"
        ? parsed
        : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function campScopeKey(campId, suffix) {
    const cleanCampId = String(campId || "").trim();

    return cleanCampId
      ? `deercamp.camps.${cleanCampId}.${suffix}`
      : "";
  }

  function getCampId() {
    const params = new URLSearchParams(window.location.search);

    const localCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    return String(
      params.get("campId") ||
      localStorage.getItem(ACTIVE_CAMP_KEY) ||
      localCamp.campId ||
      ""
    ).trim();
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      const clean = String(value || "").trim();

      if (clean) {
        return clean;
      }
    }

    return "";
  }

  function readLocalCamp(campId) {
    const scopedKey = campScopeKey(campId, "campData");

    const scopedCamp = scopedKey
      ? safeParse(localStorage.getItem(scopedKey), {})
      : {};

    const genericCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    return Object.keys(scopedCamp).length
      ? scopedCamp
      : genericCamp;
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value || "");
    }
  }

  function buildUrl(path, campId) {
    const currentParams =
      new URLSearchParams(window.location.search);

    const url =
      new URL(path, window.location.href);

    if (campId) {
      url.searchParams.set("campId", campId);
    }

    if (
      currentParams.get("useStagingFirebase") === "true"
    ) {
      url.searchParams.set(
        "useStagingFirebase",
        "true"
      );
    }

    return url.toString();
  }

  function renderCamp(campId, camp) {
    const dashboard =
      camp.dashboardSlim &&
      typeof camp.dashboardSlim === "object"
        ? camp.dashboardSlim
        : {};

    const dashboardCamp =
      dashboard.camp &&
      typeof dashboard.camp === "object"
        ? dashboard.camp
        : {};

    const campName = firstNonEmpty(
      camp.name,
      camp.campName,
      dashboardCamp.name,
      "Your DeerCamp"
    );

    const city = firstNonEmpty(
      camp.city,
      camp.campCity,
      dashboardCamp.city
    );

    const state = firstNonEmpty(
      camp.state,
      camp.campState,
      dashboardCamp.state
    );

    const location =
      [city, state].filter(Boolean).join(", ");

    const established = firstNonEmpty(
      camp.established,
      camp.campEstablished,
      dashboardCamp.established
    );

    document.title =
      `${campName} | DeerCamp`;

    setText("campName", campName);
    setText("campLocation", location);
    setText("tabletopCampName", campName);
    setText(
      "tabletopCampEstablished",
      established ? `Est. ${established}` : ""
    );

    setText(
      "stageMessage",
      "Select an object to enter a room."
    );

    document.getElementById("backLink").href =
      buildUrl("../index.html", campId);

    document.querySelectorAll(".tabletop-hotspot").forEach(
      function (hotspot) {
        const href = hotspot.getAttribute("href");

        if (href) {
          hotspot.href = buildUrl(href, campId);
        }
      }
    );
  }

  async function initialize() {
    const campId = getCampId();

    if (!campId) {
      setText(
        "campName",
        "No DeerCamp selected"
      );

      setText(
        "stageMessage",
        "Return to the DeerCamp entry page and select a camp."
      );

      return;
    }

    localStorage.setItem(
      ACTIVE_CAMP_KEY,
      campId
    );

    let camp = null;
    let source = "Local browser data";

    try {
      if (
        window.DeerCampCloud &&
        typeof window.DeerCampCloud
          .hydrateCampToLocal === "function"
      ) {
        camp =
          await window.DeerCampCloud
            .hydrateCampToLocal(campId);

        if (
          camp &&
          typeof camp === "object"
        ) {
          source = "Firestore";
        }
      }
    } catch (error) {
      console.warn(
        "V2 main camp cloud hydration skipped.",
        error
      );
    }

    if (
      !camp ||
      typeof camp !== "object" ||
      !Object.keys(camp).length
    ) {
      camp = readLocalCamp(campId);
    }

    if (
      !camp ||
      !Object.keys(camp).length
    ) {
      setText(
        "campName",
        "Camp data unavailable"
      );

      setText(
        "stageMessage",
        "The camp ID resolved, but no matching camp record was found."
      );

      return;
    }

    renderCamp(campId, camp);
  }

  initialize().catch(function (error) {
    console.error(
      "V2 main camp initialization failed.",
      error
    );

    setText(
      "stageMessage",
      "The Main Camp could not initialize. Please try again."
    );
  });
})();

