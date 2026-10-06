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

  function firstNonEmpty(...values) {
    for (const value of values) {
      const clean = String(value || "").trim();
      if (clean) return clean;
    }
    return "";
  }

  function getCampId() {
    const params = new URLSearchParams(window.location.search);
    const genericCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    return String(
      params.get("campId") ||
      localStorage.getItem(ACTIVE_CAMP_KEY) ||
      genericCamp.campId ||
      ""
    ).trim();
  }

  function readLocalCamp(campId) {
    const scopedKey = campId
      ? `deercamp.camps.${campId}.campData`
      : "";

    const scopedCamp = scopedKey
      ? safeParse(localStorage.getItem(scopedKey), {})
      : {};

    const genericCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    const matchingGenericCamp =
      String(genericCamp.campId || "").trim() === campId
        ? genericCamp
        : {};

    return Object.keys(scopedCamp).length
      ? scopedCamp
      : matchingGenericCamp;
  }

  function getIdentity(camp) {
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

    return {
      name: firstNonEmpty(
        camp.name,
        camp.campName,
        dashboardCamp.name,
        "Your DeerCamp"
      )
    };
  }

  function render(identity) {
    document
      .querySelectorAll("[data-camp-identity-name]")
      .forEach(function (element) {
        element.textContent = identity.name;
      });

    document
      .querySelectorAll("[data-camp-identity]")
      .forEach(function (element) {
        element.setAttribute(
          "aria-label",
          identity.name
        );
      });
  }

  async function initialize() {
    const campId = getCampId();
    if (!campId) return;

    localStorage.setItem(ACTIVE_CAMP_KEY, campId);

    let camp = null;

    try {
      if (
        window.DeerCampCloud &&
        typeof window.DeerCampCloud.hydrateCampToLocal === "function"
      ) {
        camp =
          await window.DeerCampCloud.hydrateCampToLocal(campId);
      }
    } catch (error) {
      console.warn(
        "V2 room camp identity cloud hydration skipped.",
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

    if (!camp || typeof camp !== "object") return;

    render(getIdentity(camp));
  }

  window.DeerCampRoomIdentity = {
    initialize,
    render,
    getCampId,
    getIdentity
  };
})();
