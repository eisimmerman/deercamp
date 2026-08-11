(function () {
  "use strict";

  const params =
    new URLSearchParams(
      window.location.search
    );

  const slug =
    params.get("experience") ||
    "";

  const returnTo =
    params.get("returnTo") ||
    "";

  const key =
    `dxb.${slug}.demoPosts`;

  const AUDIO_DB_NAME =
    "DeerCampDXBDemo";

  const AUDIO_DB_VERSION =
    1;

  const AUDIO_STORE_NAME =
    "voiceRecordings";


  function openAudioDB() {
    return new Promise(
      (resolve, reject) => {

        const request =
          indexedDB.open(
            AUDIO_DB_NAME,
            AUDIO_DB_VERSION
          );

        request.onupgradeneeded =
          () => {

            const db =
              request.result;

            if (
              !db.objectStoreNames
                .contains(
                  AUDIO_STORE_NAME
                )
            ) {
              db.createObjectStore(
                AUDIO_STORE_NAME
              );
            }
          };

        request.onsuccess =
          () => {
            resolve(
              request.result
            );
          };

        request.onerror =
          () => {
            reject(
              request.error
            );
          };
      }
    );
  }


  async function getVoiceBlob(id) {
    if (!id) {
      return null;
    }

    const db =
      await openAudioDB();

    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            AUDIO_STORE_NAME,
            "readonly"
          );

        const store =
          transaction.objectStore(
            AUDIO_STORE_NAME
          );

        const request =
          store.get(id);

        request.onsuccess =
          () => {
            db.close();

            resolve(
              request.result ||
              null
            );
          };

        request.onerror =
          () => {
            db.close();

            reject(
              request.error
            );
          };
      }
    );
  }


  function readPosts() {
    try {
      return JSON.parse(
        localStorage.getItem(
          key
        ) ||
        "[]"
      );
    }
    catch {
      return [];
    }
  }


  async function createFeedCard(
    post
  ) {
    const card =
      document.createElement(
        "article"
      );

    card.className =
      "feed-card";

    card.innerHTML =
      `
        ${
          post.imageUrl
            ? `
              <img
                src="${post.imageUrl}"
                alt="">
            `
            : ""
        }

        <div class="feed-card-body">

          <div class="feed-meta">
            ${post.author}
            ·
            ${
              post.type ===
                "conversation"
                ? "Conversation"
                : "Story"
            }
            · Just now
          </div>

          <h2>
            ${post.title}
          </h2>

          ${
            post.body
              ? `
                <p>
                  ${post.body}
                </p>
              `
              : ""
          }

          <div
            class="feed-audio"
            data-feed-audio>
          </div>

        </div>
      `;

    if (
      post.voiceRecorded &&
      post.voiceAudioId
    ) {
      try {
        const blob =
          await getVoiceBlob(
            post.voiceAudioId
          );

        if (blob) {
          const audioUrl =
            URL.createObjectURL(
              blob
            );

          const audioRoot =
            card.querySelector(
              "[data-feed-audio]"
            );

          audioRoot.innerHTML =
            `
              <p>
                🎙 Voice story
              </p>

              <audio
                controls
                preload="metadata"
                src="${audioUrl}">
              </audio>
            `;
        }
      }
      catch (error) {
        console.error(
          "DXB CampFeed audio load failed:",
          error
        );
      }
    }

    return card;
  }


  async function renderFeed() {
    const posts =
      readPosts();

    const root =
      document.querySelector(
        "[data-feed-list]"
      );

    for (
      const post
      of posts.slice(0,3)
    ) {
      const card =
        await createFeedCard(
          post
        );

      root.appendChild(
        card
      );
    }
  }


  document
    .querySelector(
      "[data-continue]"
    )
    .addEventListener(
      "click",
      () => {

        if (returnTo) {
          window.location.href =
            returnTo;
        }

      }
    );


  renderFeed().catch(
    error => {
      console.error(
        "DXB CampFeed proof failed:",
        error
      );
    }
  );

})();
