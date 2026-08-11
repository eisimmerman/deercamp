(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function parameters() {
    return new URLSearchParams(
      window.location.search
    );
  }

  function experienceSlug() {
    return (
      parameters().get("experience") ||
      "craig-boddington"
    );
  }

  async function fetchJson(url) {
    const response =
      await fetch(
        url,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `DXB room content load failed: ${url} (${response.status})`
      );
    }

    return response.json();
  }

  async function loadExperience() {
    const slug =
      experienceSlug();

    return fetchJson(
      `/v2/experience-builder/experiences/${slug}/experience.json`
    );
  }

  function findRoom(
    experience,
    roomId
  ) {
    const rooms =
      Array.isArray(
        experience?.rooms
      )
        ? experience.rooms
        : [];

    return (
      rooms.find(
        room =>
          clean(room?.id) ===
          clean(roomId)
      ) ||
      null
    );
  }

  async function loadRoom(roomId) {
    const experience =
      await loadExperience();

    const room =
      findRoom(
        experience,
        roomId
      );

    if (!room) {
      throw new Error(
        `DXB room "${roomId}" is not configured for ${experienceSlug()}.`
      );
    }

    const contentUrl =
      clean(
        room.contentUrl
      );

    if (!contentUrl) {
      return {
        experience,
        room,
        content: null
      };
    }

    const content =
      await fetchJson(
        contentUrl
      );

    return {
      experience,
      room,
      content
    };
  }

  window.DeerCampDXBRoomContentLoader = {
    version: "1.0.0",
    experienceSlug,
    loadExperience,
    loadRoom
  };
})();

