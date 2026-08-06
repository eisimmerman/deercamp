(function () {
  "use strict";

  let items = [];
  let selectedIndex = 0;
  let context = {};

  function clampIndex(index) {
    if (!items.length) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        Number(index) || 0,
        items.length - 1
      )
    );
  }

  function setItems(nextItems, options = {}) {
    items = Array.isArray(nextItems)
      ? nextItems.slice()
      : [];

    selectedIndex = clampIndex(
      options.selectedIndex || 0
    );

    context =
      options.context &&
      typeof options.context === "object"
        ? { ...options.context }
        : {};

    return getSnapshot();
  }

  function select(index) {
    selectedIndex = clampIndex(index);
    return getSnapshot();
  }

  function next() {
    return select(selectedIndex + 1);
  }

  function previous() {
    return select(selectedIndex - 1);
  }

  function getCurrent() {
    return items[selectedIndex] || null;
  }

  function getSnapshot() {
    return {
      items: items.slice(),
      selectedIndex,
      selectedItem: getCurrent(),
      total: items.length,
      hasPrevious: selectedIndex > 0,
      hasNext:
        selectedIndex >= 0 &&
        selectedIndex < items.length - 1,
      context: { ...context }
    };
  }

  function reset() {
    items = [];
    selectedIndex = 0;
    context = {};

    return getSnapshot();
  }

  window.DeerCampViewerState = {
    setItems,
    select,
    next,
    previous,
    getCurrent,
    getSnapshot,
    reset
  };
})();
