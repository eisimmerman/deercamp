const feedbackEmail =
  "simmerman.eric+dcstaging@gmail.com";

const screens =
  [...document.querySelectorAll("[data-screen]")];

const progress =
  [...document.querySelectorAll("[data-progress]")];

function showScreen(name) {
  screens.forEach(screen => {
    screen.classList.toggle(
      "active",
      screen.dataset.screen === name
    );
  });

  const step =
    name === "summary"
      ? 1
      : name === "thanks"
        ? 2
        : 3;

  progress.forEach((item,index) => {
    item.classList.toggle("active",index < step);
  });

  history.replaceState(null,"","#" + name);
  window.scrollTo(0,0);
}

document.addEventListener("click",event => {
  const next = event.target.closest("[data-next]");
  const back = event.target.closest("[data-back]");

  if(next) showScreen(next.dataset.next);
  if(back) showScreen(back.dataset.back);
});

const form =
  document.getElementById("feedbackForm");

const notice =
  document.getElementById("feedbackNotice");

const advisory =
  document.getElementById("advisoryInvitation");

function valueOf(name) {
  return (
    new FormData(form).get(name) || ""
  ).toString().trim();
}

form.addEventListener("submit",event => {
  event.preventDefault();

  if(!form.reportValidity()) return;

  const reaction = valueOf("reaction");
  const favorite = valueOf("favorite");
  const improvement =
    valueOf("improvement") || "No comment provided.";
  const followup = valueOf("followup");

  const positive =
    reaction === "Very positive" ||
    reaction === "Positive";

  localStorage.setItem(
    "dxb." + new URLSearchParams(window.location.search).get("experience") + ".feedback",
    JSON.stringify({
      reaction,
      favorite,
      improvement,
      followup,
      submittedAt:new Date().toISOString()
    })
  );

  const body = [
    (window.DeerCampDXBFollowUp?.feedback?.heading || "DEERCAMP FEEDBACK"),
    "",
    "Overall reaction:",
    reaction,
    "",
    "Most compelling experience:",
    favorite,
    "",
    "What could be clearer or easier:",
    improvement,
    "",
    "Open to a follow-up conversation:",
    followup
  ].join("\n");

  const mailto =
    "mailto:" +
    encodeURIComponent(feedbackEmail) +
    "?subject=" +
    encodeURIComponent(
      (window.DeerCampDXBFollowUp?.feedback?.subject || "DeerCamp feedback")
    ) +
    "&body=" +
    encodeURIComponent(body);

  notice.textContent =
    "Your answers are saved. Your email app will open with the " +
    "feedback prepared for review.";

  notice.classList.add("active");
  advisory.classList.toggle("active",positive);

  window.location.href = mailto;

  if(!positive) {
    window.setTimeout(
      () => showScreen("complete"),
      900
    );
  }
});

document
  .getElementById("advisoryButton")
  .addEventListener("click",() => {
    const body =
      "Eric,\n\n" +
      "I am open to hearing more about becoming one of " +
      (window.DeerCampDXBFollowUp?.advisor?.body || "I am open to hearing more about DeerCamp.");


    window.location.href =
      "mailto:" +
      encodeURIComponent(feedbackEmail) +
      "?subject=" +
      encodeURIComponent(
        (window.DeerCampDXBFollowUp?.advisor?.subject || "DeerCamp Advisor follow-up")
      ) +
      "&body=" +
      encodeURIComponent(body);

    window.setTimeout(
      () => showScreen("complete"),
      700
    );
  });

const requested =
  window.location.hash.replace("#","");

if(
  ["summary","thanks","survey","complete"]
    .includes(requested)
) {
  showScreen(requested);
}

