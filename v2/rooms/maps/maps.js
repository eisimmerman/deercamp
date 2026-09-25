(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  const ACTIONS = {
    "property-maps": {
      title: "Property Maps",
      message: "Property Maps selected."
    },

    "stand-maps": {
      title: "Stand Maps",
      message: "Stand Maps selected."
    },

    "drive-maps": {
      title: "Drive Maps",
      message: "Drive Maps selected."
    },

    "deer-analytics": {
      title: "Deer Analytics Map",
      message: "Deer Analytics Map selected."
    },

    "create-stand-map": {
      title: "Create Stand Map",
      message: "Create Stand Map selected."
    },

    "create-drive-map": {
      title: "Create Drive Map",
      message: "Create Drive Map selected."
    },

    "record-deer-count": {
      title: "Record Deer Count",
      message: "Record Deer Count selected."
    },

    "export-map": {
      title: "Export Map",
      message: "Export Map selected."
    }
  };

  function openDialog(title, message) {
    const dialog = byId("mapsDialog");
    const titleElement = byId("mapsDialogTitle");
    const messageElement = byId("mapsDialogMessage");

    if (!dialog) {
      return;
    }

    if (titleElement) {
      titleElement.textContent = title;
    }

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  function closeDialog() {
    const dialog = byId("mapsDialog");

    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  document.addEventListener("click", function (event) {
    const button =
      event.target.closest("[data-action-id]");

    if (!button) {
      return;
    }

    const actionId =
      String(button.dataset.actionId || "");

    const action =
      ACTIONS[actionId];

    if (!action) {
      return;
    }

    openDialog(
      action.title,
      action.message
    );
  });

  const closeButton =
    byId("mapsDialogClose");

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      closeDialog
    );
  }

  const dialog =
    byId("mapsDialog");

  if (dialog) {
    dialog.addEventListener(
      "click",
      function (event) {
        if (event.target === dialog) {
          closeDialog();
        }
      }
    );
  }
})();
