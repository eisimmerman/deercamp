window.DEERCAMP_PREMIUM_ROOM = {
  id: "memory",
  title: "Memories Room",
  artwork: "./memories-room.png",

  navigation: {
    camp: "../main-camp.html",
    archives: "../archives/index.html",
    maps: "../maps/index.html",
    campfire: "../campfire/index.html",
    memory: "./index.html",
    campfeed: "../campfeed/index.html"
  },

  hotspots: [
    {
      id: "view-all-memories",
      label: "All Memories",
      type: "view",
      action: "latest",
      x: 4.4,
      y: 69.9,
      width: 43.7,
      height: 5.3
    },
    {
      id: "view-voice-stories",
      label: "Voice Stories",
      type: "view",
      action: "voice",
      x: 4.4,
      y: 76.0,
      width: 43.7,
      height: 5.3
    },
    {
      id: "view-photos",
      label: "Photos",
      type: "view",
      action: "photos",
      x: 4.4,
      y: 81.8,
      width: 43.7,
      height: 5.3
    },

    {
      id: "share-voice-memory",
      label: "Record Voice Memory",
      type: "create",
      action: "voice-memory",
      x: 52.0,
      y: 69.9,
      width: 43.7,
      height: 5.3
    },
    {
      id: "share-photo",
      label: "Share Photo",
      type: "create",
      action: "photo-memory",
      x: 52.0,
      y: 76.0,
      width: 43.7,
      height: 5.3
    },
    {
      id: "write-camp-story",
      label: "Write Camp Story",
      type: "create",
      action: "camp-story",
      x: 52.0,
      y: 81.8,
      width: 43.7,
      height: 5.3
    }
  ],

  viewers: {
    latest: {
      kicker: "MEMORIES ROOM",
      title: "All Memories",
      mode: "latest"
    },

    voice: {
      kicker: "MEMORIES ROOM",
      title: "Voice Stories",
      mode: "voice"
    },

    photos: {
      kicker: "MEMORIES ROOM",
      title: "Photos",
      mode: "photos"
    }
  },

  navHotspots: [
    {
      id: "nav-camp",
      label: "Back to Camp",
      route: "camp",
      x: 7.3,
      y: 95.3,
      width: 12.8,
      height: 3.5
    },
    {
      id: "nav-archives",
      label: "Archives Room",
      route: "archives",
      x: 20.6,
      y: 95.3,
      width: 13.1,
      height: 3.5
    },
    {
      id: "nav-maps",
      label: "Maps Room",
      route: "maps",
      x: 34.8,
      y: 95.3,
      width: 13.0,
      height: 3.5
    },
    {
      id: "nav-campfire",
      label: "CampFire Room",
      route: "campfire",
      x: 48.6,
      y: 95.3,
      width: 13.1,
      height: 3.5
    },
    {
      id: "nav-memory",
      label: "Memories Room",
      route: "memory",
      x: 62.7,
      y: 95.3,
      width: 14.9,
      height: 3.5
    },
    {
      id: "nav-campfeed",
      label: "CampFeed Room",
      route: "campfeed",
      x: 78.7,
      y: 95.3,
      width: 14.2,
      height: 3.5
    }
  ]
};




