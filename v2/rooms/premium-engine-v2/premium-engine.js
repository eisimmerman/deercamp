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

      if (clean) {
        return clean;
      }
    }

    return "";
  }

  function campScopeKey(campId) {
    return campId
      ? `deercamp.camps.${campId}.campData`
      : "";
  }

  function getCampId() {
    const params =
      new URLSearchParams(window.location.search);

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
    const scopedKey = campScopeKey(campId);

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

    const name = firstNonEmpty(
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

    return {
      name,
      location: [city, state]
        .filter(Boolean)
        .join(", ")
    };
  }

  function buildUrl(route, campId) {
    const currentParams =
      new URLSearchParams(window.location.search);

    const url =
      new URL(route, window.location.href);

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

  function applyPosition(element, item) {
    element.style.left = `${item.x}%`;
    element.style.top = `${item.y}%`;
    element.style.width = `${item.width}%`;
    element.style.height = `${item.height}%`;
  }

  function renderActionHotspots(config) {
    const layer =
      document.getElementById("premiumHotspotLayer");

    if (!layer) {
      return;
    }

    layer
      .querySelectorAll(".premium-v2-action")
      .forEach(function (element) {
        element.remove();
      });

    (config.hotspots || []).forEach(function (item) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        "premium-v2-hotspot premium-v2-action";

      button.setAttribute(
        "aria-label",
        item.label || "Room action"
      );

      applyPosition(button, item);

      button.addEventListener(
        "click",
        function () {
          document.dispatchEvent(
            new CustomEvent(
              "deercamp:premium-action",
              {
                detail: {
                  id: item.id,
                  type: item.type,
                  action: item.action,
                  label: item.label
                }
              }
            )
          );
        }
      );

      layer.appendChild(button);
    });
  }

  function renderNavigation(config, campId) {
    const layer =
      document.getElementById("premiumHotspotLayer");

    if (!layer) {
      return;
    }

    layer
      .querySelectorAll(".premium-v2-nav")
      .forEach(function (element) {
        element.remove();
      });

    (config.navHotspots || []).forEach(function (item) {
      const link =
        document.createElement("a");

      link.className =
        "premium-v2-hotspot premium-v2-nav";

      link.setAttribute(
        "aria-label",
        item.label || "Room navigation"
      );

      link.href = buildUrl(
        config.navigation[item.route] || "#",
        campId
      );

      applyPosition(link, item);
      layer.appendChild(link);
    });
  }

  async function loadCamp(campId) {
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
          typeof camp === "object" &&
          Object.keys(camp).length
        ) {
          source = "Firestore";
        }
      }
    } catch (error) {
      console.warn(
        "Premium V2 cloud hydration skipped.",
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

    return {
      camp,
      source
    };
  }

  async function initialize() {
    const config =
      window.DEERCAMP_PREMIUM_ROOM;

    if (!config) {
      throw new Error(
        "Premium room configuration is missing."
      );
    }

    const artwork =
      document.getElementById("premiumRoomArtwork");

    if (artwork) {
      artwork.src = config.artwork;
    }

    const campId = getCampId();

    if (!campId) {
      throw new Error(
        "No DeerCamp campId was provided."
      );
    }

    localStorage.setItem(
      ACTIVE_CAMP_KEY,
      campId
    );

    const result =
      await loadCamp(campId);

    if (
      !result.camp ||
      !Object.keys(result.camp).length
    ) {
      throw new Error(
        `No camp record found for ${campId}.`
      );
    }

    const identity =
      getIdentity(result.camp);

    document.title =
      `${config.title} | ${identity.name}`;

    const values = {
      premiumCampName: identity.name,
      premiumCampLocation: identity.location,
      premiumCampId: campId,
      premiumDataSource: result.source,
      premiumFirebaseProject:
        window.DEERCAMP_FIREBASE_PROJECT_ID ||
        "Not connected"
    };

    Object.entries(values).forEach(
      function ([id, value]) {
        const element =
          document.getElementById(id);

        if (element) {
          element.textContent =
            String(value || "");
        }
      }
    );

    renderActionHotspots(config);
    renderNavigation(config, campId);

    document.dispatchEvent(
      new CustomEvent(
        "deercamp:premium-ready",
        {
          detail: {
            config,
            campId,
            camp: result.camp,
            identity,
            source: result.source
          }
        }
      )
    );
  }

  window.DeerCampPremiumEngine = {
    initialize,
    buildUrl,
    getCampId
  };
})();



