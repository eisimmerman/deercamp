(function () {
  "use strict";

  const ACTIVE_CAMP_KEY = "deercamp.activeCampId";
  const CAMP_DATA_KEY = "campData";

  function safeParse(raw, fallback = {}) {
    try {
      const parsed = JSON.parse(raw || "");
      return parsed && typeof parsed === "object" ? parsed : fallback;
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
    const urlCampId = String(params.get("campId") || "").trim();

    const genericCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    return String(
      urlCampId ||
      localStorage.getItem(ACTIVE_CAMP_KEY) ||
      genericCamp.campId ||
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
    const scopedStorageKey = campScopeKey(campId, "campData");

    const scopedCamp = scopedStorageKey
      ? safeParse(localStorage.getItem(scopedStorageKey), {})
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
    const url = new URL(path, window.location.href);

    if (campId) {
      url.searchParams.set("campId", campId);
    }

    return url.toString();
  }

  function renderCamp(campId, camp, source) {
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

    const location = [city, state]
      .filter(Boolean)
      .join(", ");

    const stewardName = firstNonEmpty(
      camp.stewardName,
      camp.campSteward,
      dashboard.stewardName,
      "Camp Steward"
    );

    document.title = `${campName} | DeerCamp V2`;

    setText("campTitle", campName);
    setText("campLocation", location);
    setText("campIdValue", campId);
    setText("stewardValue", stewardName);
    setText("dataSourceValue", source);
    setText(
      "firebaseProjectValue",
      window.DEERCAMP_FIREBASE_PROJECT_ID || "Not connected"
    );

    const continueButton =
      document.getElementById("continueV2Btn");

    const dashboardButton =
      document.getElementById("dashboardBtn");

    const v1Button =
      document.getElementById("v1Btn");

    continueButton.href = buildUrl(
      "./rooms/main-camp.html",
      campId
    );

    dashboardButton.href = buildUrl(
      "../steward-dashboard.html",
      campId
    );

    v1Button.href = buildUrl(
      "../camp.html",
      campId
    );
  }

  async function initialize() {
    const campId = getCampId();
    const message =
      document.getElementById("loadMessage");

    const continueButton =
      document.getElementById("continueV2Btn");

    if (!campId) {
      setText("campTitle", "No DeerCamp selected");
      setText("campIdValue", "Missing");
      setText("stewardValue", "Unavailable");
      setText("dataSourceValue", "No camp data");
      setText(
        "firebaseProjectValue",
        window.DEERCAMP_FIREBASE_PROJECT_ID ||
          "Not connected"
      );

      message.textContent =
        "Open DeerCamp V2 from the five-minute camp flow or provide a campId in the URL.";

      message.classList.add("is-error");

      continueButton.setAttribute(
        "aria-disabled",
        "true"
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
        "V2 cloud hydration skipped.",
        error
      );
    }

    if (
      !camp ||
      typeof camp !== "object"
    ) {
      camp = readLocalCamp(campId);
    }

    if (
      !camp ||
      !Object.keys(camp).length
    ) {
      setText(
        "campTitle",
        "Camp data unavailable"
      );

      setText("campIdValue", campId);
      setText("stewardValue", "Unavailable");
      setText(
        "dataSourceValue",
        "No saved camp found"
      );

      setText(
        "firebaseProjectValue",
        window.DEERCAMP_FIREBASE_PROJECT_ID ||
          "Not connected"
      );

      message.textContent =
        "The camp ID was resolved, but no matching Firestore or local camp record was found.";

      message.classList.add("is-error");

      continueButton.setAttribute(
        "aria-disabled",
        "true"
      );

      return;
    }

    renderCamp(
      campId,
      camp,
      source
    );

    message.textContent =
      "Your existing DeerCamp data is connected. The room-based V2 experience is ready for construction.";
  }

  initialize().catch(function (error) {
    console.error(
      "DeerCamp V2 initialization failed.",
      error
    );

    const message =
      document.getElementById("loadMessage");

    if (message) {
      message.textContent =
        "DeerCamp V2 could not initialize. Check the browser console for details.";

      message.classList.add("is-error");
    }
  });
})();
