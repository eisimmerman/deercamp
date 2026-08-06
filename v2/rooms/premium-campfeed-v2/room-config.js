window.DEERCAMP_PREMIUM_ROOM = {
  id: "campfeed",
  title: "CampFeed Room",
  artwork: "./assets/campfeed-room.png",

  navigation: {
    camp: "../main-camp.html",
    archives: "../archives/index.html",
    maps: "../maps/index.html",
    campfire: "../campfire/index.html",
    memory: "../memory/index.html",
    campfeed: "./index.html"
  },

  hotspots: [
    {
      id: "view-latest",
      label: "Latest Conversations",
      type: "view",
      action: "latest",
      x: 4.5,
      y: 80.03,
      width: 42.0,
      height: 2.10
    },
    {
      id: "view-voice",
      label: "Voice Stories",
      type: "view",
      action: "voice",
      x: 4.5,
      y: 82.30,
      width: 42.0,
      height: 2.10
    },
    {
      id: "view-photos",
      label: "Photo Shares",
      type: "view",
      action: "photos",
      x: 4.5,
      y: 84.65,
      width: 42.0,
      height: 2.10
    },
    {
      id: "view-member",
      label: "Browse by Member",
      type: "view",
      action: "by-member",
      x: 4.5,
      y: 86.99,
      width: 42.0,
      height: 2.10
    },
    {
      id: "view-topic",
      label: "Browse by Topic",
      type: "view",
      action: "by-topic",
      x: 4.5,
      y: 89.33,
      width: 42.0,
      height: 2.10
    },
    {
      id: "view-search",
      label: "Search CampFeed",
      type: "view",
      action: "search",
      x: 4.5,
      y: 91.67,
      width: 42.0,
      height: 2.10
    },

    {
      id: "create-conversation",
      label: "Start a Conversation",
      type: "create",
      action: "new-conversation",
      x: 53.1,
      y: 80.03,
      width: 42.0,
      height: 2.10
    },
    {
      id: "create-voice",
      label: "Record a Voice Story",
      type: "create",
      action: "voice-story",
      x: 53.1,
      y: 82.30,
      width: 42.0,
      height: 2.10
    },
    {
      id: "create-photo",
      label: "Share a Photo",
      type: "create",
      action: "photo-caption",
      x: 53.1,
      y: 84.65,
      width: 42.0,
      height: 2.10
    },
    {
      id: "create-memory",
      label: "Share a Memory or Story",
      type: "create",
      action: "memory-story",
      x: 53.1,
      y: 86.99,
      width: 42.0,
      height: 2.10
    },
    {
      id: "create-announcement",
      label: "Post an Announcement",
      type: "create",
      action: "announcement",
      x: 53.1,
      y: 89.33,
      width: 42.0,
      height: 2.10
    },
    {
      id: "create-save",
      label: "Save to CampFeed",
      type: "create",
      action: "save-campfeed",
      x: 53.1,
      y: 91.67,
      width: 42.0,
      height: 2.10
    }
  ],

  viewers: {
    latest: {
      kicker: "CAMPFEED",
      title: "Latest Conversations",
      mode: "latest"
    },

    voice: {
      kicker: "CAMPFEED",
      title: "Voice Stories",
      mode: "voice"
    },

    photos: {
      kicker: "CAMPFEED",
      title: "Photo Shares",
      mode: "photos"
    },

    "by-member": {
      kicker: "CAMPFEED",
      title: "Browse by Member",
      mode: "members"
    },

    "by-topic": {
      kicker: "CAMPFEED",
      title: "Browse by Topic",
      mode: "topics"
    },

    search: {
      kicker: "CAMPFEED",
      title: "Search CampFeed",
      mode: "search"
    }
  },

  navHotspots: [
    {
      id: "nav-camp",
      label: "Back to Camp",
      route: "camp",
      x: 1.7,
      y: 95.1,
      width: 14.6,
      height: 2.34
    },
    {
      id: "nav-archives",
      label: "Archives Room",
      route: "archives",
      x: 16.7,
      y: 95.1,
      width: 16.5,
      height: 2.34
    },
    {
      id: "nav-maps",
      label: "Maps Room",
      route: "maps",
      x: 33.6,
      y: 95.1,
      width: 14.5,
      height: 2.34
    },
    {
      id: "nav-campfire",
      label: "CampFire Room",
      route: "campfire",
      x: 48.6,
      y: 95.1,
      width: 16.3,
      height: 2.34
    },
    {
      id: "nav-memory",
      label: "Memory and Voice Room",
      route: "memory",
      x: 65.3,
      y: 95.1,
      width: 18.2,
      height: 2.34
    },
    {
      id: "nav-campfeed",
      label: "CampFeed Room",
      route: "campfeed",
      x: 83.9,
      y: 95.1,
      width: 14.3,
      height: 2.34
    }
  ]
};







