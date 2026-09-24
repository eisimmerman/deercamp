(function () {
  "use strict";

  const VIEWERS = {
    "latest-conversations": {
      title: "Latest Conversations",
      mode: "latest"
    },

    "voice-stories": {
      title: "Voice Stories",
      mode: "voice"
    },

    "photo-shares": {
      title: "Photo Shares",
      mode: "photos"
    }
  };

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function resolveCampId() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const fromUrl =
      clean(
        params.get("campId")
      );

    if (fromUrl) {
      return fromUrl;
    }

    const activeCampId =
      clean(
        localStorage.getItem(
          "deercamp.activeCampId"
        )
      );

    if (activeCampId) {
      return activeCampId;
    }

    try {
      const campData =
        JSON.parse(
          localStorage.getItem(
            "campData"
          ) || "{}"
        );

      return clean(
        campData.campId ||
        campData.id
      );
    }
    catch {
      return "";
    }
  }

  async function openViewer(actionId) {
    const viewer =
      VIEWERS[actionId];

    if (!viewer) {
      return;
    }

    const campId =
      resolveCampId();

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.DeerCampMemoryProvider ||
      typeof window.DeerCampMemoryProvider.load !==
        "function"
    ) {
      throw new Error(
        "CampFire memory provider is unavailable."
      );
    }

    if (
      !window.DeerCampUniversalViewer ||
      typeof window.DeerCampUniversalViewer.show !==
        "function"
    ) {
      throw new Error(
        "CampFire viewer is unavailable."
      );
    }



    const result =
      await Promise.race([
        window.DeerCampMemoryProvider.load({
          campId,
          mode: viewer.mode,
          limit: 50
        }),

        new Promise(function (_, reject) {
          setTimeout(function () {
            const user =
              window.firebase &&
              typeof window.firebase.auth === "function"
                ? window.firebase.auth().currentUser
                : null;

            reject(
              new Error(
                "Memory load timed out after 8 seconds." +
                " campId=" + campId +
                " auth=" +
                (user ? user.email || user.uid : "none")
              )
            );
          }, 8000);
        })
      ]);

    window.DeerCampUniversalViewer.show({
      kicker: "CAMPFIRE",
      title: viewer.title,
      items: result.items,
      selectedIndex: 0,
      context: {
        campId,
        source: result.source,
        collection: result.collection,
        mode: viewer.mode,
        room: "campfire"
      }
    });
  }

  if (
    window.DeerCampUniversalViewer &&
    typeof window.DeerCampUniversalViewer.initialize === "function"
  ) {
    window.DeerCampUniversalViewer.initialize();
  }

  document.addEventListener(
    "click",
    async function (event) {
      const control =
        event.target.closest(
          "[data-action-id]"
        );

      if (!control) {
        return;
      }

      const actionId =
        control.dataset.actionId || "";


      console.log(
        "CampFire action selected:",
        actionId
      );

      if (!VIEWERS[actionId]) {
        return;
      }


      try {
        await openViewer(
          actionId
        );
      }
      catch (error) {
        console.error(
          "CampFire viewer failed:",
          error
        );

        alert(
          "CampFire viewer error: " +
          (
            error &&
            error.message
              ? error.message
              : String(error)
          )
        );
      }
    }
  );
})();

