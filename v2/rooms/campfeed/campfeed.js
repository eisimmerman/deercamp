(function () {
  "use strict";

  const starterFeed = [
    {
      room: "Memory & Voice",
      title: "Opening Morning Memory",
      copy: "A photograph and voice story were preserved from opening morning.",
      meta: "Shared recently"
    },
    {
      room: "Archives",
      title: "Historic Camp Photo Added",
      copy: "A new archival photograph was added to the camp collection.",
      meta: "Added today"
    },
    {
      room: "Maps",
      title: "Pine Ridge Stand Saved",
      copy: "A new deer stand location was saved in the Maps Room.",
      meta: "Updated today"
    },
    {
      room: "CampFire",
      title: "What Hunt Do You Remember Most?",
      copy: "A new CampFire discussion is ready for member replies.",
      meta: "Discussion active"
    },
    {
      room: "CampFeed",
      title: "Your Camp Is Connected",
      copy: "Activity from every DeerCamp room will appear here.",
      meta: "Just now"
    }
  ];

  async function start() {
    await window.DeerCampRoomEngine.initialize({
      roomId: "campfeed",
      feedItems: starterFeed
    });
  }

  document.addEventListener(
    "deercamp:room-action",
    function (event) {
      const detail = event.detail || {};
      const actionLabel =
        detail.actionType === "view"
          ? "View"
          : "Create";

      console.log(
        "CampFeed action selected:",
        detail.actionType,
        detail.actionId
      );

      alert(
        `${actionLabel} action: ${detail.actionId}`
      );
    }
  );

  start().catch(function (error) {
    console.error(
      "CampFeed room initialization failed.",
      error
    );
  });
})();
