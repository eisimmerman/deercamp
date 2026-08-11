(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function experienceSlug() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("experience") ||
      "craig-boddington"
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

  function setHtmlText(
    selector,
    value
  ) {
    return setText(
      selector,
      value
    );
  }

  async function loadJson(url) {
    const response =
      await fetch(
        url,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `DXB follow-up could not load ${url}: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async function loadExperience() {
    const slug =
      experienceSlug();

    const url =
      `../../../experiences/${slug}/experience.json`;

    return loadJson(url);
  }

  function bindIdentity(
    experience
  ) {
    const campName =
      clean(
        experience?.identity
          ?.campName
      ) ||
      "DeerCamp";

    document.title =
      `${campName} - DeerCamp Summary`;

    document.documentElement
      .setAttribute(
        "data-dxb-experience",
        experienceSlug()
      );

    return campName;
  }

  function bindFollowUp(
    experience
  ) {
    const followUp =
      experience?.followUp ||
      {};

    setText(
      "[data-dxb-followup-title]",
      followUp.title
    );

    setHtmlText(
      "[data-dxb-followup-lead]",
      followUp.lead
    );

    setText(
      "[data-dxb-thankyou-title]",
      followUp.thankYouTitle
    );

    setHtmlText(
      "[data-dxb-thankyou-body]",
      followUp.thankYouBody
    );

    setText(
      "[data-dxb-completion-eyebrow]",
      followUp.completionEyebrow
    );

    setText(
      "[data-dxb-completion-title]",
      followUp.completionTitle
    );

    setText(
      "[data-dxb-return-label]",
      followUp.returnLabel
    );
  }

  function bindAdvisor(
    experience
  ) {
    const advisor =
      experience?.advisor ||
      {};

    const wrapper =
      document.getElementById(
        "advisoryInvitation"
      );

    if (!wrapper) {
      return;
    }

    wrapper.hidden =
      advisor.enabled === false;

    setText(
      "[data-dxb-advisor-eyebrow]",
      advisor.eyebrow
    );

    setText(
      "[data-dxb-advisor-title]",
      advisor.title
    );

    setText(
      "[data-dxb-advisor-message]",
      advisor.message
    );

    setText(
      "[data-dxb-advisor-button]",
      advisor.buttonLabel
    );
  }

  function buildFeedbackConfig(
    experience
  ) {
    const followUp =
      experience?.followUp ||
      {};

    const campName =
      clean(
        experience?.identity
          ?.campName
      ) ||
      "DeerCamp";

    return {
      heading:
        clean(
          followUp.feedbackHeading
        ) ||
        `${campName.toUpperCase()} FEEDBACK`,

      subject:
        clean(
          followUp.feedbackSubject
        ) ||
        `${campName} feedback`
    };
  }

  function buildAdvisorConfig(
    experience
  ) {
    const advisor =
      experience?.advisor ||
      {};

    return {
      enabled:
        advisor.enabled !== false,

      subject:
        clean(
          advisor.emailSubject
        ),

      body:
        clean(
          advisor.emailBody
        )
    };
  }

  async function boot() {
    try {
      const experience =
        await loadExperience();

      bindIdentity(
        experience
      );

      bindFollowUp(
        experience
      );

      bindAdvisor(
        experience
      );

      window.DeerCampDXBFollowUp = {
        experience,

        feedback:
          buildFeedbackConfig(
            experience
          ),

        advisor:
          buildAdvisorConfig(
            experience
          )
      };

      window.dispatchEvent(
        new CustomEvent(
          "deercamp:dxb-followup-ready",
          {
            detail:
              window.DeerCampDXBFollowUp
          }
        )
      );
    }
    catch (error) {
      console.error(
        "DXB Follow-up Binder failed:",
        error
      );
    }
  }

  window.DeerCampDXBFollowUpBinder = {
    version: "1.0.0",
    boot,
    loadExperience
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  }
  else {
    boot();
  }
})();
