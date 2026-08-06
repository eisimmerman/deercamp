(function () {
  "use strict";

  const demoItems = [
    {
      id: "opening-day-traditions",
      contentType: "conversation",
      author: "Craig B.",
      room: "CampFire",
      timestamp: "1h ago",
      title: "Opening Day Traditions",
      subtitle: "The traditions that make opening day feel like home.",
      heroImage: "./assets/KS-8pointer-rockriverAR-223.jpg",
      imageAlt: "Kansas whitetail deer hunting memory",
      transcript: "What is one tradition your camp never misses on opening day? For us, the morning starts before daylight with coffee, a quiet check of the wind, and the same stories told around the table. The details may change, but the feeling never does.",
      comments: [
        { author: "Mike R.", timestamp: "42m ago", text: "We always take the same group photo before anyone heads out." },
        { author: "Eric S.", timestamp: "18m ago", text: "The stories around the table are as important as the hunt itself." }
      ],
      tags: ["Opening Day", "Tradition", "CampFire", "Kansas"],
      metadata: {
        date: "Opening weekend",
        location: "Independence, Kansas",
        members: ["Craig B.", "Mike R.", "Eric S."],
        source: "CampFire conversation"
      }
    },
    {
      id: "buck-never-forget",
      contentType: "photo",
      author: "Mike R.",
      room: "CampFeed",
      timestamp: "3h ago",
      title: "That Buck We’ll Never Forget",
      subtitle: "One shot at last light and a story that still gives us chills.",
      heroImage: "./assets/KS-8pointer-rockriverAR-223.jpg",
      imageAlt: "Eight-point Kansas whitetail deer",
      transcript: "He came in at last light, slipping through the timber without a sound. One shot, one buck, and one memory the whole camp still talks about.",
      comments: [
        { author: "Craig B.", timestamp: "2h ago", text: "A classic camp story. That evening will be remembered for a long time." }
      ],
      tags: ["Whitetail", "Buck", "Last Light", "Photo Memory"],
      metadata: {
        date: "November 2025",
        location: "North Ridge",
        weather: "Cold, clear evening",
        source: "CampFeed photo share"
      }
    },
    {
      id: "camp-swede-weekend",
      contentType: "conversation",
      author: "Jane R.",
      room: "CampFeed",
      timestamp: "5h ago",
      title: "Camp Swede Weekend",
      subtitle: "Good laughs, good food, and the people who make camp matter.",
      transcript: "Great weekend with the crew. We did not fill every tag, but we filled the camp with stories, laughter, and another year of memories worth keeping.",
      comments: [
        { author: "Mike R.", timestamp: "4h ago", text: "That is exactly what camp is all about." }
      ],
      tags: ["Camp Weekend", "Members", "Tradition"],
      metadata: {
        location: "Camp Swede",
        source: "CampFeed conversation"
      }
    },
    {
      id: "north-pond",
      contentType: "photo",
      author: "Eric S.",
      room: "Memory & Voice",
      timestamp: "7h ago",
      title: "Sunset on the North Pond",
      subtitle: "A quiet ending to a memorable day at camp.",
      heroImage: "./assets/KS-8pointer-rockriverAR-223.jpg",
      imageAlt: "DeerCamp field memory",
      transcript: "Couldn’t ask for a better way to end the day. The woods went still, the sky turned orange, and for a few minutes nobody needed to say a word.",
      comments: [],
      tags: ["Sunset", "North Pond", "Photo Memory"],
      metadata: {
        location: "North Pond",
        source: "Memory & Voice"
      }
    },
    {
      id: "still-hunting",
      contentType: "voice",
      author: "Craig B.",
      room: "Memory & Voice",
      timestamp: "10h ago",
      title: "Still-Hunting Stories",
      subtitle: "A voice memory from the ridges and river bottoms.",
      transcript: "Still-hunting is a patient way to hunt. You move slowly, stop often, and let the woods settle around you. Some of the best stories begin in those long quiet pauses.",
      comments: [
        { author: "Eric S.", timestamp: "8h ago", text: "Hearing the story in the hunter’s own voice makes all the difference." }
      ],
      tags: ["Voice Story", "Still-Hunting", "Ridges", "River Bottoms"],
      metadata: {
        source: "Memory & Voice recording"
      }
    }
  ];

  function getItems(mode) {
    switch (mode) {
      case "voice":
        return demoItems.filter(function (item) { return item.contentType === "voice"; });
      case "photos":
        return demoItems.filter(function (item) { return item.contentType === "photo"; });
      case "members":
      case "topics":
      case "search":
      case "latest":
      default:
        return demoItems.slice();
    }
  }

  window.DeerCampCampFeedProvider = {
    schemaVersion: "viewerItem.v2",
    getItems: getItems
  };
})();
