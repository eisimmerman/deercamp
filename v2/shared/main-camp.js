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

  function campScopeKey(campId, suffix) {
    const cleanCampId = String(campId || "").trim();

    return cleanCampId
      ? `deercamp.camps.${cleanCampId}.${suffix}`
      : "";
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
    const scopedKey = campScopeKey(campId, "campData");

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

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value || "");
    }
  }

  function buildUrl(path, campId) {
    const currentParams =
      new URLSearchParams(window.location.search);

    const url =
      new URL(path, window.location.href);

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

  function renderCamp(campId, camp) {
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

    const location =
      [city, state].filter(Boolean).join(", ");

    const established = firstNonEmpty(
      camp.established,
      camp.campEstablished,
      dashboardCamp.established
    );

    document.title =
      `${campName} | DeerCamp`;

    setText("campName", campName);
    setText("campLocation", location);
    setText("tabletopCampName", campName);
    setText(
      "tabletopCampEstablished",
      established ? `Est. ${established}` : ""
    );

    setText(
      "stageMessage",
      "Select an object to enter a room."
    );



    document.querySelectorAll(".tabletop-hotspot").forEach(
      function (hotspot) {
        const href = hotspot.getAttribute("href");

        if (href) {
          hotspot.href = buildUrl(href, campId);
        }
      }
    );
  }

  function setupMainCampSignIn() {
    const panel = document.getElementById("mainCampSignIn");
    const form = document.getElementById("mainCampSignInForm");
    const emailInput = document.getElementById("mainCampSignInEmail");
    const button = document.getElementById("mainCampSendSignInLink");
    const feedback = document.getElementById("mainCampSignInFeedback");

    if (!form || !emailInput || !button || !feedback) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = emailInput.value.trim().toLowerCase();
      if (!email) {
        feedback.textContent = "Enter your DeerCamp email address.";
        return;
      }

      const auth = window.DeerCampAuth;
      const completingLink =
        typeof auth.isEmailSignInLink === "function" &&
        auth.isEmailSignInLink(window.location.href);

      button.disabled = true;
      feedback.textContent = completingLink
        ? "Completing your secure sign-in..."
        : "Sending your sign-in link...";

      try {
        if (completingLink) {
          await auth.completeEmailSignIn({
            url: window.location.href,
            email: email
          });

          const cleanUrl = new URL(window.location.href);
          ["apiKey", "oobCode", "mode", "lang"].forEach((key) =>
            cleanUrl.searchParams.delete(key)
          );
          window.location.replace(cleanUrl.toString());
          return;
        }

        await auth.sendEmailSignInLink(email, {
          returnUrl: window.location.href
        });
        feedback.textContent =
          "Sign-in link sent. Check your email on this or another device.";
      } catch (error) {
        console.error("Main Camp sign-in failed.", error);
        feedback.textContent =
          error.message || "Unable to send sign-in link.";
      } finally {
        button.disabled = false;
      }
    });

    return panel;
  }
  async function initialize() {
    const tabletop = document.querySelector('.tabletop-frame');
    if (tabletop) tabletop.hidden = true;
    const signInPanel = setupMainCampSignIn();
    const campId = getCampId();

    if (!campId) {
      setText(
        "campName",
        "No DeerCamp selected"
      );

      setText(
        "stageMessage",
        "Return to the DeerCamp entry page and select a camp."
      );

      return;
    }

    const auth = window.DeerCampAuth;
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      setText("stageMessage", "Authentication is unavailable.");
      return;
    }

    if (typeof auth.isEmailSignInLink === "function" &&
        auth.isEmailSignInLink(window.location.href)) {
      const feedback = document.getElementById("mainCampSignInFeedback");
      const emailInput = document.getElementById("mainCampSignInEmail");
      const button = document.getElementById("mainCampSendSignInLink");
      const storedEmail = typeof auth.getStoredEmailForSignIn === "function"
        ? auth.getStoredEmailForSignIn()
        : "";

      if (signInPanel) signInPanel.hidden = false;
      if (emailInput && storedEmail) emailInput.value = storedEmail;
      if (button) button.textContent = "Complete Sign-In";
      if (feedback) {
        feedback.textContent = storedEmail
          ? "Completing your secure sign-in..."
          : "Enter the email address that received your sign-in link.";
      }

      if (storedEmail) {
        try {
          await auth.completeEmailSignIn({
            url: window.location.href,
            email: storedEmail
          });
          const cleanUrl = new URL(window.location.href);
          ["apiKey", "oobCode", "mode", "lang"].forEach((key) =>
            cleanUrl.searchParams.delete(key)
          );
          window.history.replaceState(
            {},
            document.title,
            cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
          );
          if (signInPanel) signInPanel.hidden = true;
        } catch (error) {
          console.error("Main Camp email-link completion failed.", error);
          if (feedback) feedback.textContent =
            "Automatic sign-in failed. Verify the email address below and select Complete Sign-In.";
          if (emailInput) emailInput.focus();
          return;
        }
      } else {
        return;
      }
    }
    const user = await new Promise((resolve) => {
      let settled = false;
      let unsubscribe = () => {};
      const finish = (value) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(value);
      };
      const timeout = setTimeout(() => finish(null), 5000);
      unsubscribe = auth.onAuthStateChanged((currentUser) => {
        if (currentUser) {
          clearTimeout(timeout);
          finish(currentUser);
        }
      });
    });

    if (!user) {
      if (signInPanel) signInPanel.hidden = false;
      setText("campName", "Sign-in required");
      setText("stageMessage", "Please sign in to access your DeerCamp.");
      return;
    }

    let authorized = false;
    let stewardAuthorized = false;
    try {
      const [member, steward] = await Promise.allSettled([
        auth.getMemberAccess(campId),
        auth.getStewardAccess(campId)
      ]);
      stewardAuthorized = steward.status === "fulfilled" && steward.value?.authorized === true;
      authorized =
        (member.status === "fulfilled" && member.value?.authorized === true) ||
        (steward.status === "fulfilled" && steward.value?.authorized === true);
    } catch (error) {
      console.warn("Main Camp access verification failed.", error);
    }

    if (!authorized) {
      setText("campName", "Access not verified");
      setText("stageMessage", "Your access to this DeerCamp could not be verified.");
      return;
    }
    const dashboardLink = document.getElementById("backLink");
    if (dashboardLink && stewardAuthorized) {
      const dashboardUrl = new URL("../../steward-dashboard.html", window.location.href);
      dashboardUrl.searchParams.set("campId", campId);
      if (new URLSearchParams(window.location.search).get("useStagingFirebase") === "true") dashboardUrl.searchParams.set("useStagingFirebase", "true");
      dashboardLink.href = dashboardUrl.toString();
      dashboardLink.hidden = false;
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
        "V2 main camp cloud hydration skipped.",
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

    if (
      !camp ||
      !Object.keys(camp).length
    ) {
      setText(
        "campName",
        "Camp data unavailable"
      );

      setText(
        "stageMessage",
        "The camp ID resolved, but no matching camp record was found."
      );

      return;
    }

    renderCamp(campId, camp);
    const stage = document.querySelector(".tabletop-stage");
    if (stage) stage.hidden = false;
    if (tabletop) tabletop.hidden = false;
  }

  initialize().catch(function (error) {
    console.error(
      "V2 main camp initialization failed.",
      error
    );

    setText(
      "stageMessage",
      "The Main Camp could not initialize. Please try again."
    );
  });
})();

