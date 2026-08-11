(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function params() {
    return new URLSearchParams(
      window.location.search
    );
  }

  function query(name) {
    return clean(
      params().get(name)
    );
  }

  function text(
    selector,
    value
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (element) {
      element.textContent =
        clean(value);
    }
  }

  function hideIfEmpty(
    selector,
    value
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (!element) {
      return;
    }

    element.hidden =
      !clean(value);
  }

  async function fetchJson(
    url
  ) {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `${url} (${response.status})`
      );
    }

    return await response.json();
  }

  function resolveStory(
    content,
    storyId
  ) {
    const collections = [
      content?.stories,
      content?.featured,
      content?.items
    ];

    for (
      const collection
      of collections
    ) {
      if (
        !Array.isArray(
          collection
        )
      ) {
        continue;
      }

      const match =
        collection.find(
          item =>
            clean(item?.id) === storyId ||
            clean(item?.assetId) === storyId
        );

      if (match) {
        return match;
      }
    }

    return null;
  }

  function paragraphs(
    selector,
    value
  ) {
    const element =
      document.querySelector(
        selector
      );

    if (!element) {
      return;
    }

    element.innerHTML =
      "";

    const values =
      Array.isArray(value)
        ? value
        : clean(value)
          ? [value]
          : [];

    values.forEach(
      paragraph => {
        const p =
          document.createElement(
            "p"
          );

        p.textContent =
          clean(paragraph);

        element.appendChild(
          p
        );
      }
    );
  }

  function relatedTopics(
    value
  ) {
    const root =
      document.querySelector(
        "[data-story-related]"
      );

    if (!root) {
      return;
    }

    root.innerHTML =
      "";

    (
      Array.isArray(value)
        ? value
        : []
    ).forEach(topic => {
      const span =
        document.createElement(
          "span"
        );

      span.className =
        "story-topic";

      span.textContent =
        clean(topic);

      root.appendChild(
        span
      );
    });
  }

  function back() {
    const returnTo =
      query("returnTo");

    if (returnTo) {
      window.location.href =
        returnTo;

      return;
    }

    if (
      window.history.length > 1
    ) {
      window.history.back();
    }
  }

  function bindBack() {
    document
      .querySelectorAll(
        "[data-story-back]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          back
        );
      });
  }

  function render(
    experience,
    room,
    content,
    story
  ) {
    const campName =
      clean(
        experience?.showcase
          ?.tabletop
          ?.campName
      ) ||
      clean(
        experience?.identity
          ?.campName
      ) ||
      "DeerCamp";

    document.title =
      `${
        clean(story?.title) ||
        "Story"
      } - ${campName}`;

    text(
      "[data-story-camp-name]",
      campName
    );

    text(
      "[data-story-room-label]",
      clean(room?.label) ||
      clean(room?.id) ||
      "DeerCamp"
    );

    text(
      "[data-story-kicker]",
      story?.kicker ||
      story?.category ||
      content?.hero?.kicker ||
      "DEERCAMP STORY"
    );

    text(
      "[data-story-title]",
      story?.title ||
      "DeerCamp Story"
    );

    text(
      "[data-story-subtitle]",
      story?.subtitle
    );

    const image =
      document.querySelector(
        "[data-story-image]"
      );

    if (image) {
      const src =
        clean(
          story?.assetUrl
        );

      if (src) {
        image.src =
          src;
      }

      image.alt =
        clean(story?.title) ||
        "Featured DeerCamp story";

      image.style.objectFit =
        clean(
          story?.imageFit
        ) ||
        "cover";

      image.style.objectPosition =
        clean(
          story?.imagePosition
        ) ||
        "center";
    }

    paragraphs(
      "[data-story-overview]",
      story?.overview ||
      story?.body ||
      story?.description ||
      story?.subtitle
    );

    text(
      "[data-story-quote]",
      story?.quote
    );

    paragraphs(
      "[data-story-why]",
      story?.whyItMatters
    );

    text(
      "[data-story-type]",
      story?.type
    );

    text(
      "[data-story-theme]",
      story?.theme
    );

    text(
      "[data-story-source]",
      story?.sourceLabel ||
      story?.source ||
      ""
    );

    relatedTopics(
      story?.relatedTopics
    );

    text(
      "[data-story-action-title]",
      story?.actionTitle ||
      "Add Your Story"
    );

    text(
      "[data-story-action-copy]",
      story?.actionCopy ||
      "What would your camp add to this conversation?"
    );

    text(
      "[data-story-disclaimer]",
      content?.disclaimer
        ?.enabled
        ? content.disclaimer.text
        : ""
    );

    hideIfEmpty(
      "[data-story-why-section]",
      Array.isArray(
        story?.whyItMatters
      )
        ? story.whyItMatters.join(" ")
        : story?.whyItMatters
    );

    window.DeerCampDXBStoryViewer = {
      experience,
      room,
      content,
      story
    };
  }

  async function start() {
    bindBack();

    const experienceSlug =
      query(
        "experience"
      );

    const roomId =
      query(
        "room"
      );

    const storyId =
      query(
        "story"
      );

    if (
      !experienceSlug ||
      !roomId ||
      !storyId
    ) {
      throw new Error(
        "Story Viewer requires experience, room and story."
      );
    }

    const experienceUrl =
      `/v2/experience-builder/experiences/${encodeURIComponent(
        experienceSlug
      )}/experience.json`;

    const experience =
      await fetchJson(
        experienceUrl
      );

    const room =
      Array.isArray(
        experience?.rooms
      )
        ? experience.rooms.find(
            item =>
              clean(item?.id) ===
              roomId
          )
        : null;

    if (!room) {
      throw new Error(
        `DXB room not found: ${roomId}`
      );
    }

    const contentUrl =
      clean(
        room.contentUrl
      );

    if (!contentUrl) {
      throw new Error(
        `DXB room has no contentUrl: ${roomId}`
      );
    }

    const content =
      await fetchJson(
        contentUrl
      );

    const story =
      resolveStory(
        content,
        storyId
      );

    if (!story) {
      throw new Error(
        `DXB story not found: ${storyId}`
      );
    }

    render(
      experience,
      room,
      content,
      story
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      start().catch(
        error => {
          console.error(
            "DXB Story Viewer failed:",
            error
          );
        }
      );
    }
  );
})();
