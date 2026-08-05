window.DEERCAMP_ROOM_REGISTRY = {
  campfeed: {
    id: "campfeed",
    name: "CampFeed Room",
    eyebrow: "DEERCAMP",
    tagline: "Camp-wide activity from every room.",
    feedTitle: "CampFeed",
    viewActions: [
      {
        id: "latest",
        label: "Latest Activity",
        description: "See the newest activity across your camp."
      },
      {
        id: "this-week",
        label: "This Week at DeerCamp",
        description: "Review the week’s memories, maps, conversations, and updates."
      },
      {
        id: "photos",
        label: "Photos",
        description: "Browse recent camp photographs."
      },
      {
        id: "voice",
        label: "Voice Stories",
        description: "Listen to recently shared voice memories."
      }
    ],
    createActions: [
      {
        id: "photo-caption",
        label: "Post Photo + Caption"
      },
      {
        id: "voice-story",
        label: "Record Voice Story"
      },
      {
        id: "comment",
        label: "Comment on Post"
      }
    ],
    navigation: [
      { id: "camp", label: "Camp", route: "../main-camp.html" },
      { id: "archives", label: "Archives", route: "../archives/index.html" },
      { id: "maps", label: "Maps", route: "../maps/index.html" },
      { id: "campfire", label: "CampFire", route: "../campfire/index.html" },
      { id: "memory", label: "Memory & Voice", route: "../memory/index.html" },
      { id: "campfeed", label: "CampFeed", route: "./index.html" }
    ]
  }
};
