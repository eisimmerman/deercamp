(function () {
  "use strict";

  const VERSION =
    "1.0.0";

  function clean(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function slug(experience) {
    return (
      clean(
        experience?.slug
      ) ||
      "experience"
    );
  }

  function namespace(
    experience
  ) {
    return (
      `dxb.${slug(experience)}.progress`
    );
  }

  function flow(
    experience
  ) {
    return Array.isArray(
      experience?.showcaseFlow
    )
      ? experience.showcaseFlow
          .map(clean)
          .filter(Boolean)
      : [];
  }

  function read(
    experience
  ) {
    const key =
      namespace(experience);

    try {
      const raw =
        localStorage.getItem(
          key
        );

      if (!raw) {
        return {
          completed: [],
          current: null,
          finished: false
        };
      }

      const parsed =
        JSON.parse(raw);

      return {
        completed:
          Array.isArray(
            parsed.completed
          )
            ? parsed.completed
            : [],

        current:
          clean(
            parsed.current
          ) || null,

        finished:
          parsed.finished === true
      };
    }
    catch (error) {
      console.warn(
        "DXB progress read failed:",
        error
      );

      return {
        completed: [],
        current: null,
        finished: false
      };
    }
  }

  function write(
    experience,
    state
  ) {
    localStorage.setItem(
      namespace(experience),
      JSON.stringify(state)
    );

    window.dispatchEvent(
      new CustomEvent(
        "deercamp:dxb-progress-changed",
        {
          detail: {
            experience,
            state
          }
        }
      )
    );

    return state;
  }

  function firstStep(
    experience
  ) {
    return (
      flow(experience)[0] ||
      null
    );
  }

  function normalize(
    experience,
    state
  ) {
    const sequence =
      flow(experience);

    const completed =
      [...new Set(
        (state?.completed || [])
          .map(clean)
          .filter(
            id =>
              sequence.includes(id)
          )
      )];

    let current =
      clean(
        state?.current
      ) || null;

    if (
      !current ||
      !sequence.includes(current) ||
      completed.includes(current)
    ) {
      current =
        sequence.find(
          id =>
            !completed.includes(id)
        ) || null;
    }

    return {
      completed,
      current,
      finished:
        completed.length ===
          sequence.length &&
        sequence.length > 0
    };
  }

  function start(
    experience
  ) {
    const current =
      normalize(
        experience,
        read(experience)
      );

    if (
      !current.current &&
      !current.finished
    ) {
      current.current =
        firstStep(experience);
    }

    return write(
      experience,
      current
    );
  }

  function markComplete(
    experience,
    stepId
  ) {
    const id =
      clean(stepId);

    if (!id) {
      return read(
        experience
      );
    }

    const sequence =
      flow(experience);

    if (
      !sequence.includes(id)
    ) {
      console.warn(
        "DXB progress step is not in showcaseFlow:",
        id
      );

      return read(
        experience
      );
    }

    const state =
      normalize(
        experience,
        read(experience)
      );

    if (
      !state.completed.includes(
        id
      )
    ) {
      state.completed.push(
        id
      );
    }

    const next =
      sequence.find(
        item =>
          !state.completed.includes(
            item
          )
      ) || null;

    state.current =
      next;

    state.finished =
      state.completed.length ===
      sequence.length;

    return write(
      experience,
      state
    );
  }

  function reset(
    experience
  ) {
    localStorage.removeItem(
      namespace(experience)
    );

    return start(
      experience
    );
  }

  function nextStep(
    experience
  ) {
    return normalize(
      experience,
      read(experience)
    ).current;
  }

  function isComplete(
    experience,
    stepId
  ) {
    return normalize(
      experience,
      read(experience)
    ).completed.includes(
      clean(stepId)
    );
  }

  window.DeerCampDXBProgress = {
    version:
      VERSION,

    namespace,

    flow,

    read,

    start,

    markComplete,

    reset,

    nextStep,

    isComplete
  };
})();
