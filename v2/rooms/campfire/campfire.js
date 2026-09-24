(function () {
  "use strict";

  const VIEWERS = {
    "latest-conversations": {
      title: "Latest Conversations",
      mode: "latest"
    },

    "voice-stories": {
      title: "Voice Stories",
      mode: "voice"
    },

    "photo-shares": {
      title: "Photo Shares",
      mode: "photos"
    }
  };

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function resolveCampId() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const fromUrl =
      clean(
        params.get("campId")
      );

    if (fromUrl) {
      return fromUrl;
    }

    const activeCampId =
      clean(
        localStorage.getItem(
          "deercamp.activeCampId"
        )
      );

    if (activeCampId) {
      return activeCampId;
    }

    try {
      const campData =
        JSON.parse(
          localStorage.getItem(
            "campData"
          ) || "{}"
        );

      return clean(
        campData.campId ||
        campData.id
      );
    }
    catch {
      return "";
    }
  }

  async function openViewer(actionId) {
    const viewer =
      VIEWERS[actionId];

    if (!viewer) {
      return;
    }

    const campId =
      resolveCampId();

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.DeerCampMemoryProvider ||
      typeof window.DeerCampMemoryProvider.load !==
        "function"
    ) {
      throw new Error(
        "CampFire memory provider is unavailable."
      );
    }

    if (
      !window.DeerCampUniversalViewer ||
      typeof window.DeerCampUniversalViewer.show !==
        "function"
    ) {
      throw new Error(
        "CampFire viewer is unavailable."
      );
    }



    const result =
      await Promise.race([
        window.DeerCampMemoryProvider.load({
          campId,
          mode: viewer.mode,
          limit: 50
        }),

        new Promise(function (_, reject) {
          setTimeout(function () {
            const user =
              window.firebase &&
              typeof window.firebase.auth === "function"
                ? window.firebase.auth().currentUser
                : null;

            reject(
              new Error(
                "Memory load timed out after 8 seconds." +
                " campId=" + campId +
                " auth=" +
                (user ? user.email || user.uid : "none")
              )
            );
          }, 8000);
        })
      ]);

    window.DeerCampUniversalViewer.show({
      kicker: "CAMPFIRE",
      title: viewer.title,
      items: result.items,
      selectedIndex: 0,
      context: {
        campId,
        source: result.source,
        collection: result.collection,
        mode: viewer.mode,
        room: "campfire"
      }
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  let campfireVoiceRecorder = null;
  let campfireVoiceStream = null;
  let campfireVoiceChunks = [];
  let campfireVoiceBlob = null;
  let campfireVoiceUrl = "";

  function resetVoiceCapture() {
    if (
      campfireVoiceRecorder &&
      campfireVoiceRecorder.state !== "inactive"
    ) {
      try {
        campfireVoiceRecorder.stop();
      } catch (error) {}
    }

    if (campfireVoiceStream) {
      campfireVoiceStream
        .getTracks()
        .forEach(function (track) {
          track.stop();
        });
    }

    if (campfireVoiceUrl) {
      URL.revokeObjectURL(
        campfireVoiceUrl
      );
    }

    campfireVoiceRecorder = null;
    campfireVoiceStream = null;
    campfireVoiceChunks = [];
    campfireVoiceBlob = null;
    campfireVoiceUrl = "";

    const recordButton =
      byId("campfireVoiceRecord");

    const publishButton =
      byId("campfireVoicePublish");

    const preview =
      byId("campfireVoicePreview");

    if (recordButton) {
      recordButton.textContent =
        "Start Recording";
    }

    if (publishButton) {
      publishButton.disabled = true;
    }

    if (preview) {
      preview.pause();
      preview.removeAttribute("src");
      preview.hidden = true;
      preview.load();
    }
  }

  async function toggleVoiceRecording() {
    const recordButton =
      byId("campfireVoiceRecord");

    const publishButton =
      byId("campfireVoicePublish");

    const preview =
      byId("campfireVoicePreview");

    const feedback =
      byId("campfireFeedback");

    if (
      campfireVoiceRecorder &&
      campfireVoiceRecorder.state === "recording"
    ) {
      if (feedback) {
        feedback.textContent =
          "Finishing recording...";
      }

      campfireVoiceRecorder.stop();
      return;
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !==
        "function"
    ) {
      throw new Error(
        "Microphone recording is unavailable in this browser."
      );
    }

    if (
      typeof window.MediaRecorder !==
        "function"
    ) {
      throw new Error(
        "This browser does not support MediaRecorder."
      );
    }

    resetVoiceCapture();

    if (feedback) {
      feedback.textContent =
        "Requesting microphone access...";
    }

    campfireVoiceStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true
        });

    campfireVoiceChunks = [];

    campfireVoiceRecorder =
      new MediaRecorder(
        campfireVoiceStream
      );

    campfireVoiceRecorder.addEventListener(
      "dataavailable",
      function (event) {
        if (
          event.data &&
          event.data.size > 0
        ) {
          campfireVoiceChunks.push(
            event.data
          );
        }
      }
    );

    campfireVoiceRecorder.addEventListener(
      "stop",
      function () {
        const mimeType =
          campfireVoiceRecorder.mimeType ||
          "audio/webm";

        campfireVoiceBlob =
          new Blob(
            campfireVoiceChunks,
            {
              type: mimeType
            }
          );

        if (campfireVoiceStream) {
          campfireVoiceStream
            .getTracks()
            .forEach(function (track) {
              track.stop();
            });

          campfireVoiceStream = null;
        }

        if (!campfireVoiceBlob.size) {
          if (feedback) {
            feedback.textContent =
              "No audio was captured. Please try again.";
          }

          return;
        }

        campfireVoiceUrl =
          URL.createObjectURL(
            campfireVoiceBlob
          );

        if (preview) {
          preview.src =
            campfireVoiceUrl;

          preview.hidden = false;
          preview.load();
        }

        if (recordButton) {
          recordButton.textContent =
            "Record Again";
        }

        if (publishButton) {
          publishButton.disabled = false;
        }

        if (feedback) {
          feedback.textContent =
            "Recording ready. Play it back before sharing.";
        }
      }
    );

    campfireVoiceRecorder.start();

    if (recordButton) {
      recordButton.textContent =
        "Stop Recording";
    }

    if (publishButton) {
      publishButton.disabled = true;
    }

    if (feedback) {
      feedback.textContent =
        "Recording... tap Stop Recording when finished.";
    }
  }
  function hideShareForms() {
    const authForm = byId("campfireAuthForm");
    const textForm = byId("campfireTextForm");
    const photoForm = byId("campfirePhotoForm");
    const voiceForm = byId("campfireVoiceForm");

    if (authForm) authForm.hidden = true;
    if (textForm) textForm.hidden = true;
    if (photoForm) photoForm.hidden = true;
    if (voiceForm) voiceForm.hidden = true;
  }

  let campfireTextShareMode = "conversation";

  function openShareDialog(mode) {
    const dialog = byId("campfireDialog");
    const title = byId("campfireDialogTitle");
    const message = byId("campfireDialogMessage");
    const feedback = byId("campfireFeedback");

    if (!dialog) {
      throw new Error("CampFire Share dialog was not found.");
    }

    hideShareForms();

    if (feedback) {
      feedback.textContent = "";
    }

    if (
      mode === "conversation" ||
      mode === "memory"
    ) {
      campfireTextShareMode = mode;

      if (title) {
        title.textContent =
          mode === "memory"
            ? "Share a Memory / Story"
            : "Start a Conversation";
      }

      if (message) {
        message.textContent =
          mode === "memory"
            ? "Add a title and preserve a camp memory or story for your camp."
            : "Add a title and share a thought, story, question, or camp update.";
      }

      const form = byId("campfireTextForm");
      if (form) {
        form.hidden = false;
      }
    }

    if (mode === "photo") {
      if (title) {
        title.textContent = "Share a Photo";
      }

      if (message) {
        message.textContent =
          "Choose a photo, add an optional caption, and share it with your camp.";
      }

      const form = byId("campfirePhotoForm");
      if (form) {
        form.hidden = false;
      }
    }

    if (mode === "voice") {
      resetVoiceCapture();

      if (title) {
        title.textContent =
          "Record a Voice Story";
      }

      if (message) {
        message.textContent =
          "Record a story in your own voice, play it back, then share it with your camp.";
      }

      const form =
        byId("campfireVoiceForm");

      if (form) {
        form.hidden = false;
      }
    }

    if (
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  function closeShareDialog() {
    const dialog = byId("campfireDialog");

    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function showAuthDialog(message) {
    const dialog =
      byId("campfireDialog");

    const title =
      byId("campfireDialogTitle");

    const dialogMessage =
      byId("campfireDialogMessage");

    const authForm =
      byId("campfireAuthForm");

    const authFeedback =
      byId("campfireAuthFeedback");

    hideShareForms();

    if (title) {
      title.textContent =
        "Sign in to DeerCamp";
    }

    if (dialogMessage) {
      dialogMessage.textContent =
        message ||
        "Sign in to share with your private CampFire.";
    }

    if (authFeedback) {
      authFeedback.textContent = "";
    }

    if (authForm) {
      authForm.hidden = false;
    }

    if (
      dialog &&
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  async function completePendingEmailSignIn() {
    if (
      !window.DeerCampAuth ||
      typeof window.DeerCampAuth.isEmailSignInLink !==
        "function" ||
      !window.DeerCampAuth.isEmailSignInLink(
        window.location.href
      )
    ) {
      return null;
    }

    try {
      const user =
        await window.DeerCampAuth
          .completeEmailSignIn({
            url: window.location.href
          });

      if (user) {
        const cleanUrl =
          new URL(
            window.location.href
          );

        [
          "apiKey",
          "oobCode",
          "mode",
          "lang"
        ].forEach(function (key) {
          cleanUrl.searchParams.delete(
            key
          );
        });

        window.history.replaceState(
          {},
          document.title,
          cleanUrl.pathname +
            cleanUrl.search +
            cleanUrl.hash
        );
      }

      return user || null;
    }
    catch (error) {
      console.error(
        "DeerCamp email sign-in could not be completed.",
        error
      );

      showAuthDialog(
        error.message ||
        "The DeerCamp sign-in link could not be completed."
      );

      return null;
    }
  }
  async function getSignedInUser() {
    if (
      !window.firebase ||
      typeof window.firebase.auth !== "function"
    ) {
      throw new Error(
        "Firebase Authentication is unavailable."
      );
    }

    const auth = window.firebase.auth();
    let user = auth.currentUser;

    if (!user) {
      user = await new Promise(function (resolve) {
        let settled = false;

        const unsubscribe =
          auth.onAuthStateChanged(function (nextUser) {
            if (settled || !nextUser) {
              return;
            }

            settled = true;

            try {
              unsubscribe();
            } catch (error) {}

            resolve(nextUser);
          });

        setTimeout(function () {
          if (settled) {
            return;
          }

          settled = true;

          try {
            unsubscribe();
          } catch (error) {}

          resolve(auth.currentUser || null);
        }, 3000);
      });
    }

    if (!user || user.isAnonymous) {
      showAuthDialog(
        "Sign in to share with your private CampFire."
      );

      throw new Error(
        "Sign-in required."
      );
    }

    return user;
  }

  function getAuthorName(user) {
    const displayName =
      clean(user && user.displayName);

    if (displayName) {
      return displayName;
    }

    const email =
      clean(user && user.email);

    if (email) {
      return email.split("@")[0];
    }

    return "DeerCamp Member";
  }

  async function publishConversation() {
    const titleInput = byId("campfireTitle");
    const bodyInput = byId("campfireBody");
    const feedback = byId("campfireFeedback");
    const publishButton = byId("campfireTextPublish");

    const isMemory =
      campfireTextShareMode === "memory";

    const title =
      clean(titleInput && titleInput.value) ||
      (
        isMemory
          ? "CampFire Memory"
          : "CampFire Conversation"
      );

    const body =
      clean(bodyInput && bodyInput.value);

    if (!body) {
      throw new Error(
        "Add a story or thought before sharing."
      );
    }

    const user =
      await getSignedInUser();

    const campId =
      resolveCampId();

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.firebase ||
      typeof window.firebase.firestore !== "function"
    ) {
      throw new Error(
        "Cloud Firestore is unavailable."
      );
    }

    if (feedback) {
      feedback.textContent =
        isMemory ? "Sharing memory..." : "Sharing conversation...";
    }

    if (publishButton) {
      publishButton.disabled = true;
    }

    try {
      const authorName =
        getAuthorName(user);

      const createdAtMs =
        Date.now();

      const docRef =
        await window.firebase
          .firestore()
          .collection("feedItems")
          .add({
            campId,
            room: "campfire",
            authorId: user.uid,
            authorName,
            author: authorName,
            title,
            caption: body,
            body,
            story: body,
            transcript: "",
            transcriptPreview: "",
            mediaType: "text",
            type: isMemory ? "memory" : "conversation",
            category: "campfire",
            tags: [
              "CampFire",
              isMemory ? "Memory" : "Conversation",
              "Web"
            ],
            published: true,
            source: "app",
            createdAt:
              window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAtMs,
            clientCreatedAt:
              createdAtMs
          });

      if (!docRef || !docRef.id) {
        throw new Error(
          "CampFire conversation publish was not confirmed."
        );
      }

      if (feedback) {
        feedback.textContent =
          isMemory ? "Memory shared to CampFire." : "Conversation shared to CampFire.";
      }

      if (titleInput) {
        titleInput.value = "";
      }

      if (bodyInput) {
        bodyInput.value = "";
      }
    }
    finally {
      if (publishButton) {
        publishButton.disabled = false;
      }
    }
  }

  async function publishPhoto() {
    const fileInput = byId("campfirePhotoFile");
    const captionInput = byId("campfirePhotoCaption");
    const feedback = byId("campfireFeedback");
    const publishButton = byId("campfirePhotoPublish");

    const file =
      fileInput &&
      fileInput.files &&
      fileInput.files[0];

    if (!file) {
      throw new Error(
        "Choose a photo before sharing."
      );
    }

    const caption =
      clean(
        captionInput &&
        captionInput.value
      );

    const user =
      await getSignedInUser();

    const campId =
      resolveCampId();

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.DeerCampStorage ||
      typeof window.DeerCampStorage.uploadCampImageFilePair !==
        "function"
    ) {
      throw new Error(
        "DeerCamp photo upload is unavailable."
      );
    }

    if (
      !window.firebase ||
      typeof window.firebase.firestore !== "function"
    ) {
      throw new Error(
        "Cloud Firestore is unavailable."
      );
    }

    if (feedback) {
      feedback.textContent =
        "Uploading photo...";
    }

    if (publishButton) {
      publishButton.disabled = true;
    }

    try {
      const entityId =
        "web-" +
        Date.now() +
        "-" +
        user.uid.slice(0, 8);

      const uploaded =
        await window.DeerCampStorage
          .uploadCampImageFilePair({
            campId,
            folder: "campfire",
            entityId,
            file
          });

      const imageUrl =
        clean(
          uploaded.displayUrl ||
          uploaded.thumbUrl
        );

      if (!imageUrl) {
        throw new Error(
          "Photo upload did not return a Firebase Storage URL."
        );
      }

      const authorName =
        getAuthorName(user);

      const createdAtMs =
        Date.now();

      const cleanCaption =
        caption ||
        "Photo shared from CampFire.";

      const feedDoc = {
        campId,
        room: "campfire",
        authorId: user.uid,
        authorName,
        author: authorName,
        title: "CampFire Photo",
        caption: cleanCaption,
        body: cleanCaption,
        story: cleanCaption,
        titleSource: "fallback",
        captionSource:
          caption ? "manual" : "fallback",
        transcript: "",
        transcriptPreview: "",
        transcriptionStatus:
          "not_applicable",
        transcriptionError: "",
        generatedTitle: "",
        generatedCaption: "",
        imageUrl,
        displayUrl:
          uploaded.displayUrl ||
          imageUrl,
        thumbUrl:
          uploaded.thumbUrl ||
          imageUrl,
        thumbnailUrl:
          uploaded.thumbUrl ||
          imageUrl,
        mediaType: "photo",
        type: "photo",
        category: "campfire",
        tags: [
          "CampFire",
          "Picture",
          "Web"
        ],
        published: true,
        source: "app",
        localMemoryId: entityId,
        createdAt:
          window.firebase.firestore.FieldValue.serverTimestamp(),
        createdAtMs,
        clientCreatedAt:
          createdAtMs,
        imagePath:
          uploaded.displayPath ||
          uploaded.thumbPath ||
          ""
      };

      const docRef =
        await window.firebase
          .firestore()
          .collection("feedItems")
          .add(feedDoc);

      if (!docRef || !docRef.id) {
        throw new Error(
          "CampFire photo publish was not confirmed."
        );
      }

      if (feedback) {
        feedback.textContent =
          "Photo shared to CampFire.";
      }

      if (fileInput) {
        fileInput.value = "";
      }

      if (captionInput) {
        captionInput.value = "";
      }
    }
    finally {
      if (publishButton) {
        publishButton.disabled = false;
      }
    }
  }

  async function publishVoiceStory() {
    const titleInput =
      byId("campfireVoiceTitle");

    const bodyInput =
      byId("campfireVoiceBody");

    const publishButton =
      byId("campfireVoicePublish");

    const feedback =
      byId("campfireFeedback");

    if (
      !campfireVoiceBlob ||
      !campfireVoiceBlob.size
    ) {
      throw new Error(
        "Record a voice story before sharing."
      );
    }

    const user =
      await getSignedInUser();

    const campId =
      resolveCampId();

    if (!campId) {
      throw new Error(
        "No active DeerCamp camp was found."
      );
    }

    if (
      !window.DeerCampStorage ||
      typeof window.DeerCampStorage.uploadBlob !==
        "function"
    ) {
      throw new Error(
        "DeerCamp audio upload is unavailable."
      );
    }

    if (
      !window.firebase ||
      typeof window.firebase.firestore !==
        "function"
    ) {
      throw new Error(
        "Cloud Firestore is unavailable."
      );
    }

    const title =
      clean(
        titleInput &&
        titleInput.value
      ) ||
      "Voice Story";

    const body =
      clean(
        bodyInput &&
        bodyInput.value
      );

    if (feedback) {
      feedback.textContent =
        "Uploading voice story...";
    }

    if (publishButton) {
      publishButton.disabled = true;
    }

    try {
      const entityId =
        "voice-" +
        Date.now() +
        "-" +
        user.uid.slice(0, 8);

      const contentType =
        campfireVoiceBlob.type ||
        "audio/webm";

      let extension = "webm";

      if (
        contentType.includes("ogg")
      ) {
        extension = "ogg";
      }
      else if (
        contentType.includes("mp4")
      ) {
        extension = "m4a";
      }
      else if (
        contentType.includes("mpeg")
      ) {
        extension = "mp3";
      }

      const audioPath =
        "camps/" +
        campId +
        "/campfire/" +
        entityId +
        "/voice." +
        extension;

      const uploaded =
        await window.DeerCampStorage
          .uploadBlob(
            audioPath,
            campfireVoiceBlob,
            {
              contentType,
              customMetadata: {
                campId,
                room: "campfire",
                entityId,
                authorId: user.uid
              }
            }
          );

      const audioUrl =
        clean(
          uploaded &&
          uploaded.url
        );

      if (!audioUrl) {
        throw new Error(
          "Voice upload did not return a Firebase Storage URL."
        );
      }

      const authorName =
        getAuthorName(user);

      const createdAtMs =
        Date.now();

      const feedDoc = {
        campId,
        room: "campfire",

        authorId: user.uid,
        authorName,
        author: authorName,

        title,

        caption:
          body ||
          "Voice story shared from CampFire.",

        body,
        story: body,

        transcript: "",
        transcriptPreview: "",
        transcriptionStatus:
          "not_requested",
        transcriptionError: "",

        audioUrl,
        audioPath:
          uploaded.path ||
          audioPath,

        audioContentType:
          uploaded.contentType ||
          contentType,

        audioBytes:
          uploaded.bytes ||
          campfireVoiceBlob.size,

        mediaType: "audio",
        type: "voice",
        category: "campfire",

        tags: [
          "CampFire",
          "Voice",
          "Field Memory",
          "Web"
        ],

        published: true,
        source: "app",
        localMemoryId: entityId,

        createdAt:
          window.firebase.firestore
            .FieldValue.serverTimestamp(),

        createdAtMs,
        clientCreatedAt:
          createdAtMs
      };

      const docRef =
        await window.firebase
          .firestore()
          .collection("feedItems")
          .add(feedDoc);

      if (
        !docRef ||
        !docRef.id
      ) {
        throw new Error(
          "CampFire voice publish was not confirmed."
        );
      }

      if (feedback) {
        feedback.textContent =
          "Voice story shared to CampFire.";
      }

      if (titleInput) {
        titleInput.value = "";
      }

      if (bodyInput) {
        bodyInput.value = "";
      }

      resetVoiceCapture();
    }
    finally {
      if (publishButton) {
        publishButton.disabled =
          !campfireVoiceBlob;
      }
    }
  }
  const authEmail =
    byId("campfireAuthEmail");

  const authSendLink =
    byId("campfireAuthSendLink");

  const authFeedback =
    byId("campfireAuthFeedback");
  const dialogClose =
    byId("campfireDialogClose");

  const textPublish =
    byId("campfireTextPublish");

  const photoPublish =
    byId("campfirePhotoPublish");

  if (authSendLink) {
    authSendLink.addEventListener(
      "click",
      async function () {
        const email =
          clean(
            authEmail &&
            authEmail.value
          ).toLowerCase();

        if (!email) {
          if (authFeedback) {
            authFeedback.textContent =
              "Enter your DeerCamp email.";
          }

          if (authEmail) {
            authEmail.focus();
          }

          return;
        }

        authSendLink.disabled = true;

        if (authFeedback) {
          authFeedback.textContent =
            "Sending sign-in link...";
        }

        try {
          if (
            !window.DeerCampAuth ||
            typeof window.DeerCampAuth.sendEmailSignInLink !==
              "function"
          ) {
            throw new Error(
              "DeerCamp sign-in is unavailable."
            );
          }

          await window.DeerCampAuth
            .sendEmailSignInLink(
              email,
              {
                returnUrl:
                  window.location.href
              }
            );

          if (authFeedback) {
            authFeedback.textContent =
              "Sign-in link sent. Open the email link on this device.";
          }
        }
        catch (error) {
          console.error(
            "DeerCamp sign-in link could not be sent.",
            error
          );

          if (authFeedback) {
            authFeedback.textContent =
              error.message ||
              "Sign-in link could not be sent.";
          }
        }
        finally {
          authSendLink.disabled =
            false;
        }
      }
    );
  }
  if (dialogClose) {
    dialogClose.addEventListener(
      "click",
      closeShareDialog
    );
  }

  if (textPublish) {
    textPublish.addEventListener(
      "click",
      async function () {
        const feedback =
          byId("campfireFeedback");

        try {
          await publishConversation();
        }
        catch (error) {
          console.error(
            "CampFire conversation could not be shared.",
            error
          );

          if (feedback) {
            feedback.textContent =
              error.message ||
              "Conversation could not be shared.";
          }
        }
      }
    );
  }

  const voiceRecord =
    byId("campfireVoiceRecord");

  const voicePublish =
    byId("campfireVoicePublish");

  if (voiceRecord) {
    voiceRecord.addEventListener(
      "click",
      async function () {
        const feedback =
          byId("campfireFeedback");

        try {
          await toggleVoiceRecording();
        }
        catch (error) {
          console.error(
            "CampFire voice recording failed.",
            error
          );

          if (feedback) {
            feedback.textContent =
              error.message ||
              "Voice recording could not start.";
          }
        }
      }
    );
  }
  if (voicePublish) {
    voicePublish.addEventListener(
      "click",
      async function () {
        const feedback =
          byId("campfireFeedback");

        try {
          await publishVoiceStory();
        }
        catch (error) {
          console.error(
            "CampFire voice story could not be shared.",
            error
          );

          if (feedback) {
            feedback.textContent =
              error.message ||
              "Voice story could not be shared.";
          }
        }
      }
    );
  }
  if (photoPublish) {
    photoPublish.addEventListener(
      "click",
      async function () {
        const feedback =
          byId("campfireFeedback");

        try {
          await publishPhoto();
        }
        catch (error) {
          console.error(
            "CampFire photo could not be shared.",
            error
          );

          if (feedback) {
            feedback.textContent =
              error.message ||
              "Photo could not be shared.";
          }
        }
      }
    );
  }
  completePendingEmailSignIn();
  if (
    window.DeerCampUniversalViewer &&
    typeof window.DeerCampUniversalViewer.initialize === "function"
  ) {
    window.DeerCampUniversalViewer.initialize();
  }

  document.addEventListener(
    "click",
    async function (event) {
      const control =
        event.target.closest(
          "[data-action-id]"
        );

      if (!control) {
        return;
      }

      const actionId =
        control.dataset.actionId || "";


      console.log(
        "CampFire action selected:",
        actionId
      );

      if (actionId === "start-conversation") {
        openShareDialog("conversation");
        return;
      }

      if (actionId === "share-photo") {
        openShareDialog("photo");
        return;
      }

      if (actionId === "share-memory-story") {
        openShareDialog("memory");
        return;
      }

      if (actionId === "record-voice-story") {
        openShareDialog("voice");
        return;
      }

      if (!VIEWERS[actionId]) {
        return;
      }


      try {
        await openViewer(
          actionId
        );
      }
      catch (error) {
        console.error(
          "CampFire viewer failed:",
          error
        );

        alert(
          "CampFire viewer error: " +
          (
            error &&
            error.message
              ? error.message
              : String(error)
          )
        );
      }
    }
  );
})();

