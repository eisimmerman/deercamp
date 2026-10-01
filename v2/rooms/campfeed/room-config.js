window.DEERCAMP_PREMIUM_ROOM = {
  id: "campfeed",
  title: "CampFeed Room",
  artwork: "./campfeed-room.png",

  navigation: {
    camp: "../main-camp.html",
    archives: "../archives/index.html",
    maps: "../maps/index.html",
    campfire: "../campfire/index.html",
    memory: "../memory/index.html",
    campfeed: "./index.html"
  },

  hotspots: [
    { id:"view-latest", label:"Latest Conversations", type:"view", action:"latest", x:17.0, y:70.8, width:30.7, height:1.8 },
    { id:"view-voice", label:"Voice Stories", type:"view", action:"voice", x:17.0, y:72.6, width:30.7, height:1.8 },
    { id:"view-photos", label:"Photo Shares", type:"view", action:"photos", x:17.0, y:74.4, width:30.7, height:1.8 },

    { id:"share-comment", label:"Start a Conversation", type:"create", action:"comment", x:52.2, y:70.8, width:31.1, height:1.8 },
    { id:"share-voice-story", label:"Record a Voice Story", type:"create", action:"voice-story", x:52.2, y:72.6, width:31.1, height:1.8 },
    { id:"share-photo-caption", label:"Share a Photo", type:"create", action:"photo-caption", x:52.2, y:74.4, width:31.1, height:1.8 }
  ],
  navHotspots: [
    { id:"nav-camp", label:"Back to Camp", route:"camp", x:6.2, y:93.9, width:13.7, height:2.6 },
    { id:"nav-archives", label:"Archives Room", route:"archives", x:20.9, y:93.9, width:13.7, height:2.6 },
    { id:"nav-maps", label:"Maps Room", route:"maps", x:35.6, y:93.9, width:13.7, height:2.6 },
    { id:"nav-campfire", label:"CampFire Room", route:"campfire", x:50.4, y:93.9, width:13.7, height:2.6 },
    { id:"nav-memory", label:"Memories Room", route:"memory", x:65.2, y:93.9, width:13.7, height:2.6 },
    { id:"nav-campfeed", label:"CampFeed Room", route:"campfeed", x:79.9, y:93.9, width:13.7, height:2.6 }
  ]
};










