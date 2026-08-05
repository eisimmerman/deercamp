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

  function scopedKey(campId, suffix) {
    const cleanCampId = String(campId || "").trim();

    return cleanCampId
      ? `deercamp.camps.${cleanCampId}.${suffix}`
      : "";
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

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value || "");
    }
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

  function readLocalCamp(campId) {
    const campKey = scopedKey(campId, "campData");

    const scopedCamp = campKey
      ? safeParse(localStorage.getItem(campKey), {})
      : {};

    const genericCamp = safeParse(
      localStorage.getItem(CAMP_DATA_KEY),
      {}
    );

    return Object.keys(scopedCamp).length
      ? scopedCamp
      : genericCamp;
  }

  function buildUrl(route, campId) {
    const currentParams =
      new URLSearchParams(window.location.search);

    const url = new URL(route, window.location.href);

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

  function getCampIdentity(camp) {
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

    const established = firstNonEmpty(
      camp.established,
      camp.campYear,
      dashboardCamp.established
    );

    const steward = firstNonEmpty(
      camp.stewardName,
      camp.campSteward,
      dashboard.stewardName,
      "Camp Steward"
    );

    return {
      name,
      city,
      state,
      established,
      steward,
      location: [city, state]
        .filter(Boolean)
        .join(", ")
    };
  }

  function renderActionList(containerId, actions, type) {
    const container =
      document.getElementById(containerId);

    if (!container) {
      return;
    }

    container.innerHTML = "";

    actions.forEach(function (action) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        `room-engine-action room-engine-action-${type}`;

      button.dataset.actionId = action.id;
      button.dataset.actionType = type;

      const label =
        document.createElement("strong");

      label.textContent = action.label;

      button.appendChild(label);

      if (action.description) {
        const description =
          document.createElement("span");

        description.textContent =
          action.description;

        button.appendChild(description);
      }

      button.addEventListener(
        "click",
        function () {
          document.dispatchEvent(
            new CustomEvent(
              "deercamp:room-action",
              {
                detail: {
                  actionId: action.id,
                  actionType: type
                }
              }
            )
          );
        }
      );

      container.appendChild(button);
    });
  }

  function renderNavigation(
    containerId,
    navigation,
    activeRoomId,
    campId
  ) {
    const container =
      document.getElementById(containerId);

    if (!container) {
      return;
    }

    container.innerHTML = "";

    navigation.forEach(function (item) {
      const link =
        document.createElement("a");

      link.textContent = item.label;
      link.href = buildUrl(
        item.route,
        campId
      );

      link.className =
        "room-engine-nav-link";

      if (item.id === activeRoomId) {
        link.classList.add("is-active");
        link.setAttribute(
          "aria-current",
          "page"
        );
      }

      container.appendChild(link);
    });
  }

  function renderFeed(
    containerId,
    feedItems
  ) {
    const container =
      document.getElementById(containerId);

    if (!container) {
      return;
    }

    container.innerHTML = "";

    feedItems.forEach(function (item) {
      const card =
        document.createElement("article");

      card.className =
        "room-engine-feed-card";

      const room =
        document.createElement("span");

      room.className =
        "room-engine-feed-room";

      room.textContent =
        item.room || "CampFeed";

      const title =
        document.createElement("h3");

      title.textContent =
        item.title || "Camp activity";

      const copy =
        document.createElement("p");

      copy.textContent =
        item.copy || "";

      const meta =
        document.createElement("small");

      meta.textContent =
        item.meta || "Just now";

      card.append(
        room,
        title,
        copy,
        meta
      );

      container.appendChild(card);
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
          typeof camp === "object"
        ) {
          source = "Firestore";
        }
      }
    } catch (error) {
      console.warn(
        "Reusable room cloud hydration skipped.",
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

  async function initialize(options = {}) {
    const roomId =
      String(options.roomId || "").trim();

    const registry =
      window.DEERCAMP_ROOM_REGISTRY || {};

    const config =
      registry[roomId];

    if (!config) {
      throw new Error(
        `Room configuration not found: ${roomId}`
      );
    }

    const campId = getCampId();

    if (!campId) {
      setText(
        "roomCampName",
        "No DeerCamp selected"
      );

      setText(
        "roomStatusMessage",
        "Open this room from a DeerCamp with a valid campId."
      );

      return null;
    }

    localStorage.setItem(
      ACTIVE_CAMP_KEY,
      campId
    );

    const result =
      await loadCamp(campId);

    const camp =
      result.camp;

    if (
      !camp ||
      !Object.keys(camp).length
    ) {
      setText(
        "roomCampName",
        "Camp data unavailable"
      );

      setText(
        "roomStatusMessage",
        "The camp ID resolved, but no saved camp record was found."
      );

      setText("roomCampId", campId);

      return null;
    }

    const identity =
      getCampIdentity(camp);

    document.title =
      `${config.name} | ${identity.name}`;

    setText(
      "roomBrandEyebrow",
      config.eyebrow || "DEERCAMP"
    );

    setText(
      "roomTitle",
      config.name
    );

    setText(
      "roomTagline",
      config.tagline
    );

    setText(
      "roomCampName",
      identity.name
    );

    setText(
      "roomCampLocation",
      identity.location
    );

    setText(
      "roomCampId",
      campId
    );

    setText(
      "roomSteward",
      identity.steward
    );

    setText(
      "roomDataSource",
      result.source
    );

    setText(
      "roomFirebaseProject",
      window.DEERCAMP_FIREBASE_PROJECT_ID ||
        "Not connected"
    );

    setText(
      "roomStatusMessage",
      `${identity.name} is connected to the ${config.name}.`
    );

    renderActionList(
      "roomViewActions",
      config.viewActions || [],
      "view"
    );

    renderActionList(
      "roomCreateActions",
      config.createActions || [],
      "create"
    );

    renderNavigation(
      "roomNavigation",
      config.navigation || [],
      roomId,
      campId
    );

    renderFeed(
      "roomFeed",
      options.feedItems || []
    );

    document.dispatchEvent(
      new CustomEvent(
        "deercamp:room-ready",
        {
          detail: {
            roomId,
            campId,
            camp,
            identity,
            config
          }
        }
      )
    );

    return {
      roomId,
      campId,
      camp,
      identity,
      config
    };
  }

  window.DeerCampRoomEngine = {
    initialize,
    buildUrl,
    getCampId
  };
})();
