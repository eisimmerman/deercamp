(function () {
  "use strict";

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function experience() {
    return (
      window.DeerCampDXBExperience ||
      null
    );
  }

  function slug() {
    const exp = experience();

    return (
      clean(exp?.slug) ||
      clean(exp?.id) ||
      "experience"
    );
  }

  function campName() {
    const exp = experience();

    return (
      clean(
        exp?.showcase
          ?.tabletop
          ?.campName
      ) ||
      clean(
        exp?.identity
          ?.campName
      ) ||
      "DeerCamp"
    );
  }

  function guestName() {
    const exp = experience();

    return (
      clean(
        exp?.showcase
          ?.opening
          ?.guestName
      ) ||
      clean(
        exp?.identity
          ?.subjectName
      )
    );
  }

  function namespace() {
    return `dxb.${slug()}`;
  }

  function key(suffix) {
    return (
      namespace() +
      "." +
      clean(suffix)
    );
  }

  function localGet(suffix) {
    return localStorage.getItem(
      key(suffix)
    );
  }

  function localSet(
    suffix,
    value
  ) {
    localStorage.setItem(
      key(suffix),
      value
    );
  }

  function localRemove(suffix) {
    localStorage.removeItem(
      key(suffix)
    );
  }

  function sessionGet(suffix) {
    return sessionStorage.getItem(
      key(suffix)
    );
  }

  function sessionSet(
    suffix,
    value
  ) {
    sessionStorage.setItem(
      key(suffix),
      value
    );
  }

  function sessionRemove(suffix) {
    sessionStorage.removeItem(
      key(suffix)
    );
  }

  function opening() {
    return (
      experience()
        ?.showcase
        ?.opening ||
      {}
    );
  }

  function tabletop() {
    return (
      experience()
        ?.showcase
        ?.tabletop ||
      {}
    );
  }

  function room(id) {
    const rooms =
      Array.isArray(
        experience()?.rooms
      )
        ? experience().rooms
        : [];

    return (
      rooms.find(
        entry =>
          clean(entry?.id) ===
          clean(id)
      ) ||
      null
    );
  }

  function startRoom() {
    return (
      clean(
        tabletop().startRoom
      ) ||
      "archives"
    );
  }

  function startGuidance() {
    return (
      clean(
        tabletop().startGuidance
      ) ||
      "Start here"
    );
  }

  function introVideo() {
    return clean(
      opening().introVideo
    );
  }

  function artwork(name) {
    const exp =
      experience();

    if (name === "tabletop") {
      return clean(
        exp?.showcase
          ?.tabletop
          ?.artwork
      );
    }

    if (name === "welcome") {
      return clean(
        exp?.showcase
          ?.opening
          ?.portraitImage
      );
    }

    return "";
  }

  window.DeerCampDXBParameters = {
    version: "1.0.0",

    experience,
    slug,
    campName,
    guestName,

    namespace,
    key,

    localGet,
    localSet,
    localRemove,

    sessionGet,
    sessionSet,
    sessionRemove,

    opening,
    tabletop,
    room,
    startRoom,
    startGuidance,
    introVideo,
    artwork
  };
})();
