(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function experienceSlug(experience) {
    return (
      clean(experience?.slug) ||
      clean(experience?.id) ||
      "experience"
    );
  }

  function campName(experience) {
    return (
      clean(
        experience?.showcase
          ?.tabletop
          ?.campName
      ) ||
      clean(
        experience?.identity
          ?.campName
      ) ||
      "DeerCamp"
    );
  }

  function storageNamespace(
    experience
  ) {
    return (
      "dxb." +
      experienceSlug(experience)
    );
  }

  function storageKey(
    experience,
    suffix
  ) {
    return (
      storageNamespace(experience) +
      "." +
      clean(suffix)
    );
  }

  function setText(
    selector,
    value
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (
      element &&
      clean(value)
    ) {
      element.textContent =
        clean(value);
    }

    return element;
  }

  function setAttribute(
    selector,
    attribute,
    value
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (
      element &&
      clean(value)
    ) {
      element.setAttribute(
        attribute,
        clean(value)
      );
    }

    return element;
  }

  function getRegistryRoom(
    roomRegistry,
    roomId
  ) {
    const rooms =
      Array.isArray(
        roomRegistry?.rooms
      )
        ? roomRegistry.rooms
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

  function getExperienceRoom(
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

  function resolvedRoomRoute(
    experience,
    roomRegistry,
    roomId
  ) {
    const experienceRoom =
      getExperienceRoom(
        experience,
        roomId
      );

    if (
      clean(
        experienceRoom?.route
      )
    ) {
      return clean(
        experienceRoom.route
      );
    }

    const registryRoom =
      getRegistryRoom(
        roomRegistry,
        roomId
      );

    return clean(
      registryRoom?.routes?.v2
    );
  }

  function bindDocument(
    experience
  ) {
    const name =
      campName(experience);

    document.title =
      `${name} - Private DeerCamp Experience`;
  }

  function bindWelcome(
    experience
  ) {
    const name =
      campName(experience);

    const welcome =
      document.getElementById(
        "welcomeScreen"
      );

    if (welcome) {
      welcome.setAttribute(
        "aria-label",
        `${name} welcome`
      );
    }

    const welcomeImage =
      document.querySelector(
        "#welcomeScreen img"
      );

    if (welcomeImage) {
      welcomeImage.alt =
        `Private ${name} invitation`;

      const configuredWelcome =
        clean(
          experience?.showcase
            ?.opening
            ?.portraitImage
        );

      if (configuredWelcome) {
        welcomeImage.src =
          configuredWelcome;
      }
    }

    const opening =
      experience?.showcase
        ?.opening ||
      {};

    const openingCopy =
      document.querySelector(
        "[data-dxb-opening-copy]"
      );

    const openingEyebrow =
      document.querySelector(
        "[data-dxb-opening-eyebrow]"
      );

    const openingTitle =
      document.querySelector(
        "[data-dxb-opening-title]"
      );

    const openingBody =
      document.querySelector(
        "[data-dxb-opening-body]"
      );

    const openingCta =
      document.querySelector(
        "[data-dxb-opening-cta]"
      );

    const legacyWelcomeCta =
      document.querySelector(
        "[data-dxb-legacy-welcome-cta]"
      );

    const hasOpeningCopy =
      Boolean(
        clean(opening.eyebrow) ||
        clean(opening.title) ||
        clean(opening.body) ||
        clean(opening.continueLabel)
      );

    if (openingCopy) {
      openingCopy.hidden =
        !hasOpeningCopy;
    }

    if (legacyWelcomeCta) {
      legacyWelcomeCta.hidden =
        hasOpeningCopy;
    }

    if (openingEyebrow) {
      openingEyebrow.textContent =
        clean(opening.eyebrow);
    }

    if (openingTitle) {
      openingTitle.textContent =
        clean(opening.title);
    }

    if (openingBody) {
      openingBody.textContent =
        clean(opening.body);
    }

    if (openingCta) {
      openingCta.textContent =
        clean(opening.continueLabel) ||
        `Enter ${name}`;
    }

    const enter =
      document.getElementById(
        "enterButton"
      );

    if (enter) {
      enter.setAttribute(
        "aria-label",
        `Enter ${name}`
      );

      const hidden =
        enter.querySelector(
          ".visually-hidden"
        );

      if (hidden) {
        hidden.textContent =
          `Enter ${name}`;
      }
    }

    const aboutImage =
      document.querySelector(
        "#modalScreen img"
      );

    if (aboutImage) {
      const configuredAbout =
        clean(
          experience?.showcase
            ?.opening
            ?.aboutImage
        );

      if (configuredAbout) {
        aboutImage.src =
          configuredAbout;
      }

      aboutImage.alt =
        `About ${name}`;
    }

    const continueButton =
      document.getElementById(
        "continueButton"
      );

    if (continueButton) {
      continueButton.setAttribute(
        "aria-label",
        `Continue into ${name}`
      );

      const hidden =
        continueButton.querySelector(
          ".visually-hidden"
        );

      if (hidden) {
        hidden.textContent =
          `Continue into ${name}`;
      }
    }
  }

  function bindVideo(
    experience
  ) {
    const name =
      campName(experience);

    const videoScreen =
      document.getElementById(
        "videoScreen"
      );

    if (videoScreen) {
      videoScreen.setAttribute(
        "aria-label",
        `${name} introduction`
      );
    }

    const configuredVideo =
      clean(
        experience?.showcase
          ?.opening
          ?.introVideo
      );

    if (configuredVideo) {
      const source =
        document.querySelector(
          "#introVideo source"
        );

      if (source) {
        source.src =
          configuredVideo;

        source.parentElement
          ?.load?.();
      }
    }
  }

  function bindTabletop(
    experience
  ) {
    const tabletop =
      experience?.showcase
        ?.tabletop ||
      {};

    const name =
      campName(experience);

    const screen =
      document.getElementById(
        "tabletopScreen"
      );

    if (screen) {
      screen.setAttribute(
        "aria-label",
        `Interactive ${name} tabletop`
      );
    }

    const image =
      document.querySelector(
        "#tabletopScreen img.tabletop-art"
      );

    if (image) {
      image.alt =
        `${name} tabletop`;

      const artwork =
        clean(
          tabletop.artwork
        );

      if (artwork) {
        image.src =
          artwork;
      }
    }

    const status =
      document.getElementById(
        "tabletopStatus"
      );

    if (
      status &&
      clean(
        tabletop.startGuidance
      )
    ) {
      status.textContent =
        clean(
          tabletop.startGuidance
        );
    }

    document.documentElement
      .setAttribute(
        "data-dxb-camp-name",
        name
      );

    document.documentElement
      .setAttribute(
        "data-dxb-storage-namespace",
        storageNamespace(
          experience
        )
      );
  }

  function bindRooms(
    experience,
    roomRegistry
  ) {
    const roomBindings = [
      {
        id:
          "archives",

        elementId:
          "archiveHotspot"
      },

      {
        id:
          "maps",

        elementId:
          "mapsHotspot"
      }
    ];

    roomBindings.forEach(
      binding => {
        const element =
          document.getElementById(
            binding.elementId
          );

        if (!element) {
          return;
        }

        const route =
          resolvedRoomRoute(
            experience,
            roomRegistry,
            binding.id
          );

        if (route) {
          const url =
            new URL(
              route,
              window.location.href
            );

          url.searchParams.set(
            "experience",
            experienceSlug(
              experience
            )
          );

          element.href =
            url.href;
        }

        const room =
          getExperienceRoom(
            experience,
            binding.id
          ) ||
          getRegistryRoom(
            roomRegistry,
            binding.id
          );

        const label =
          clean(room?.label) ||
          binding.id;

        element.setAttribute(
          "aria-label",
          `Enter the ${label} Room`
        );
      }
    );
  }

  function bindStartRoom(
    experience
  ) {
    const tabletop =
      experience?.showcase
        ?.tabletop ||
      {};

    const startRoom =
      clean(
        tabletop.startRoom
      ) ||
      "archives";

    const startGuidance =
      clean(
        tabletop.startGuidance
      ) ||
      "Start here";

    const hotspots = {
      archives:
        document.getElementById(
          "archiveHotspot"
        ),

      maps:
        document.getElementById(
          "mapsHotspot"
        )
    };

    Object.entries(
      hotspots
    ).forEach(
      ([id, element]) => {
        if (!element) {
          return;
        }

        element.classList
          .toggle(
            "primary-start",
            id === startRoom
          );
      }
    );

    const selected =
      hotspots[startRoom];

    if (selected) {
      selected.dataset.tooltip =
        startGuidance;
    }
  }

  function bindTabletopIdentity(
    experience
  ) {
    const tabletop =
      experience?.showcase
        ?.tabletop ||
      {};

    const identity =
      document.querySelector(
        "[data-dxb-tabletop-identity]"
      );

    const camp =
      document.querySelector(
        "[data-dxb-tabletop-camp-name]"
      );

    const subtitle =
      document.querySelector(
        "[data-dxb-tabletop-subtitle]"
      );

    if (camp) {
      camp.textContent =
        clean(
          tabletop.campName
        ) ||
        clean(
          experience?.identity
            ?.campName
        ) ||
        "DeerCamp";
    }

    if (subtitle) {
      subtitle.textContent =
        clean(
          tabletop.subtitle
        );
    }

    if (identity) {
      identity.hidden =
        !clean(
          tabletop.campName
        );
    }
  }

  function bind(
    experience,
    roomRegistry
  ) {
    if (!experience) {
      throw new Error(
        "DXB DOM Binder requires an experience."
      );
    }

    bindDocument(
      experience
    );

    bindWelcome(
      experience
    );

    bindVideo(
      experience
    );

    bindTabletop(
      experience
    );

    bindTabletopIdentity(
      experience
    );

    bindRooms(
      experience,
      roomRegistry
    );

    bindStartRoom(
      experience
    );

    window.dispatchEvent(
      new CustomEvent(
        "deercamp:dxb-dom-bound",
        {
          detail: {
            experience,
            roomRegistry,
            namespace:
              storageNamespace(
                experience
              )
          }
        }
      )
    );

    return {
      campName:
        campName(experience),

      namespace:
        storageNamespace(
          experience
        ),

      startRoom:
        clean(
          experience?.showcase
            ?.tabletop
            ?.startRoom
        ) ||
        "archives"
    };
  }

  window.DeerCampDXBDOMBinder = {
    version:
      "1.0.0",

    bind,

    storageNamespace,

    storageKey,

    resolvedRoomRoute
  };
})();






