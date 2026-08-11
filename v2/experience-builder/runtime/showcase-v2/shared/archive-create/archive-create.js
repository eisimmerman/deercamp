(function () {
  "use strict";


  const params =
    new URLSearchParams(
      window.location.search
    );


  const flowId =
    params.get("flow") ||
    "memory";


  const experience =
    params.get("experience") ||
    "steve-rinella";


  const CONFIG_URL =
    "/v2/experience-builder/experiences/steve-rinella/content/archives/create.json";


  const ARCHIVES_URL =
    "/v2/experience-builder/experiences/steve-rinella/content/archives/content.json";


  const ROOM_URL =
    "/v2/experience-builder/runtime/showcase-v2/rooms/archives/index.html?experience=steve-rinella";


  const POST_KEY =
    "deercamp.dxb.archives.demoPosts";


  const DRAFT_KEY =
    "deercamp.dxb.archives.captureDraft";


  const DB_NAME =
    "DeerCampDXBMedia";


  const STORE_NAME =
    "audio";


  const state = {
    config: null,
    archives: null,
    flow: null,
    choice: null,
    title: "",
    story: "",
    audioBlob: null,
    audioUrl: "",
    recorder: null,
    stream: null,
    chunks: []
  };


  const stage =
    document.querySelector(
      "[data-stage]"
    );


  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }


  function escapeHtml(value) {
    return clean(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }


  async function fetchJson(url) {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `${url} (${response.status})`
      );
    }

    return response.json();
  }


  function featured() {
    return Array.isArray(
      state.archives?.featured
    )
      ? state.archives.featured
      : [];
  }


  function archiveItem(assetId) {
    return (
      featured().find(
        item =>
          clean(item.assetId) ===
          clean(assetId)
      ) ||
      null
    );
  }


  function flow() {
    return (
      state.config?.flows?.find(
        item =>
          item.id === flowId
      ) ||
      state.config?.flows?.[0] ||
      null
    );
  }


  function imageFor(choice) {
    return (
      archiveItem(
        choice?.sourceAssetId
      )?.assetUrl ||
      ""
    );
  }


  function openDb() {
    return new Promise(
      (resolve,reject) => {

        const request =
          indexedDB.open(
            DB_NAME,
            1
          );

        request.onupgradeneeded =
          () => {

            const db =
              request.result;

            if (
              !db.objectStoreNames.contains(
                STORE_NAME
              )
            ) {
              db.createObjectStore(
                STORE_NAME
              );
            }
          };

        request.onsuccess =
          () =>
            resolve(
              request.result
            );

        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );
  }


  async function saveAudio(
    id,
    blob
  ) {
    const db =
      await openDb();

    return new Promise(
      (resolve,reject) => {

        const tx =
          db.transaction(
            STORE_NAME,
            "readwrite"
          );

        tx.objectStore(
          STORE_NAME
        ).put(
          blob,
          id
        );

        tx.oncomplete =
          () => resolve();

        tx.onerror =
          () => reject(
            tx.error
          );
      }
    );
  }


  function readPosts() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            POST_KEY
          ) ||
          "[]"
        );

      return Array.isArray(value)
        ? value
        : [];
    }
    catch {
      return [];
    }
  }


  function writePosts(posts) {
    localStorage.setItem(
      POST_KEY,
      JSON.stringify(posts)
    );
  }


  function renderChoices() {
    const current =
      state.flow;

    stage.innerHTML =
      `
        <p class="step-label">
          STEP 1 OF 4
        </p>

        <h2>
          ${escapeHtml(current.title)}
        </h2>

        <p>
          ${escapeHtml(current.intro)}
        </p>

        <div class="choice-grid">

          ${
            current.choices
              .map(
                choice => `
                  <button
                    type="button"
                    class="choice-card"
                    data-choice="${escapeHtml(choice.id)}">

                    <img
                      src="${escapeHtml(imageFor(choice))}"
                      alt="">

                    <span class="choice-copy">

                      <span class="choice-kicker">
                        CHOOSE
                      </span>

                      <strong>
                        ${escapeHtml(choice.label)}
                      </strong>

                    </span>

                  </button>
                `
              )
              .join("")
          }

        </div>
      `;


    stage
      .querySelectorAll(
        "[data-choice]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              state.choice =
                current.choices.find(
                  item =>
                    item.id ===
                    button.dataset.choice
                );

              renderTellStory();
            }
          );
        }
      );
  }


  function renderTellStory() {
    const choice =
      state.choice;

    stage.innerHTML =
      `
        <button
          type="button"
          class="back-btn"
          data-change>

          ← Change choice

        </button>

        <p class="step-label">
          STEP 2 OF 4
        </p>

        <h2>
          Give this memory a voice.
        </h2>

        <div class="selection-summary">

          <img
            src="${escapeHtml(imageFor(choice))}"
            alt="">

          <div>

            <p class="choice-kicker">
              YOU CHOSE
            </p>

            <h3>
              ${escapeHtml(choice.label)}
            </h3>

            <p>
              ${escapeHtml(choice.prompt)}
            </p>

          </div>

        </div>


        <h3>
          Choose a title
        </h3>

        <div class="title-choices">

          ${
            choice.suggestedTitles
              .map(
                title => `
                  <button
                    type="button"
                    class="title-choice"
                    data-title="${escapeHtml(title)}">

                    ${escapeHtml(title)}

                  </button>
                `
              )
              .join("")
          }

        </div>

        <input
          class="title-input"
          data-title-input
          placeholder="Or write your own title">


        <div class="voice-panel">

          <p class="choice-kicker">
            RECORD THE MEMORY
          </p>

          <button
            type="button"
            class="voice-btn"
            data-record>

            🎙 Record Voice

          </button>

          <span
            class="voice-status"
            data-voice-status>

            Microphone ready.

          </span>

          <audio
            controls
            hidden
            data-audio>
          </audio>

        </div>


        <textarea
          class="story-input"
          data-story
          placeholder="Optional: add a few words too.">
        </textarea>


        <div class="actions">

          <span></span>

          <button
            type="button"
            class="action-btn primary"
            data-preview>

            Preview My Archive →

          </button>

        </div>
      `;


    stage
      .querySelector(
        "[data-change]"
      )
      .addEventListener(
        "click",
        renderChoices
      );


    stage
      .querySelectorAll(
        "[data-title]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              state.title =
                button.dataset.title;

              stage.querySelector(
                "[data-title-input]"
              ).value =
                state.title;
            }
          );
        }
      );


    const input =
      stage.querySelector(
        "[data-title-input]"
      );


    input.value =
      state.title;


    input.addEventListener(
      "input",
      () => {
        state.title =
          input.value;
      }
    );


    stage
      .querySelector(
        "[data-story]"
      )
      .addEventListener(
        "input",
        event => {
          state.story =
            event.target.value;
        }
      );


    stage
      .querySelector(
        "[data-record]"
      )
      .addEventListener(
        "click",
        toggleRecording
      );


    stage
      .querySelector(
        "[data-preview]"
      )
      .addEventListener(
        "click",
        renderPreview
      );
  }


  async function toggleRecording() {
    const button =
      stage.querySelector(
        "[data-record]"
      );

    const status =
      stage.querySelector(
        "[data-voice-status]"
      );


    if (
      state.recorder &&
      state.recorder.state ===
        "recording"
    ) {

      state.recorder.stop();

      return;
    }


    try {

      state.stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true
          });


      state.chunks =
        [];


      state.recorder =
        new MediaRecorder(
          state.stream
        );


      state.recorder.ondataavailable =
        event => {

          if (
            event.data &&
            event.data.size
          ) {
            state.chunks.push(
              event.data
            );
          }
        };


      state.recorder.onstop =
        () => {

          state.audioBlob =
            new Blob(
              state.chunks,
              {
                type:
                  state.recorder.mimeType ||
                  "audio/webm"
              }
            );


          if (state.audioUrl) {
            URL.revokeObjectURL(
              state.audioUrl
            );
          }


          state.audioUrl =
            URL.createObjectURL(
              state.audioBlob
            );


          const audio =
            stage.querySelector(
              "[data-audio]"
            );


          audio.src =
            state.audioUrl;

          audio.hidden =
            false;


          button.textContent =
            "🎙 Record Again";


          status.textContent =
            "Voice captured ✓";


          state.stream
            ?.getTracks()
            ?.forEach(
              track =>
                track.stop()
            );
        };


      state.recorder.start();


      button.textContent =
        "■ Stop Recording";


      status.textContent =
        "Recording… tell the story in your own words.";
    }
    catch (error) {

      console.error(
        error
      );


      status.textContent =
        "Microphone permission was not available.";
    }
  }


  function renderPreview() {
    state.title =
      clean(state.title) ||
      state.choice
        ?.suggestedTitles?.[0] ||
      "A Camp Memory";


    stage.innerHTML =
      `
        <button
          type="button"
          class="back-btn"
          data-edit>

          ← Edit

        </button>

        <p class="step-label">
          STEP 3 OF 4
        </p>

        <h2>
          Here's what you're preserving.
        </h2>


        <article class="preview-card">

          <img
            src="${escapeHtml(imageFor(state.choice))}"
            alt="">

          <div>

            <p class="choice-kicker">
              CAMP RINELLA · JUST NOW
            </p>

            <h3>
              ${escapeHtml(state.title)}
            </h3>

            <p>
              ${escapeHtml(state.story)}
            </p>

            ${
              state.audioBlob
                ? `
                  <p>
                    🎙 Voice attached
                  </p>
                `
                : `
                  <p>
                    Text memory
                  </p>
                `
            }

          </div>

        </article>


        <div class="actions">

          <button
            type="button"
            class="back-btn"
            data-edit-two>

            Edit

          </button>

          <button
            type="button"
            class="action-btn primary"
            data-save>

            Save to Archives →

          </button>

        </div>
      `;


    stage
      .querySelectorAll(
        "[data-edit],[data-edit-two]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            renderTellStory
          )
      );


    stage
      .querySelector(
        "[data-save]"
      )
      .addEventListener(
        "click",
        savePost
      );
  }


  async function savePost() {
    const id =
      `rinella-archive-${Date.now()}`;


    let audioKey =
      "";


    if (state.audioBlob) {

      audioKey =
        `${id}-voice`;


      await saveAudio(
        audioKey,
        state.audioBlob
      );
    }


    const post = {
      id,
      room:
        "archives",

      experience,

      createdAt:
        new Date().toISOString(),

      title:
        state.title,

      story:
        state.story,

      flow:
        flowId,

      choiceId:
        state.choice?.id ||
        "",

      sourceAssetId:
        state.choice?.sourceAssetId ||
        "",

      imageUrl:
        imageFor(
          state.choice
        ),

      audioKey,

      hasVoice:
        Boolean(audioKey),

      type:
        flowId === "artifact"
          ? "Artifact Memory"
          : "Camp Memory"
    };


    const posts =
      readPosts();


    posts.unshift(
      post
    );


    writePosts(
      posts.slice(0,20)
    );


    localStorage.setItem(
      "deercamp.dxb.archives.latestPost",
      JSON.stringify(post)
    );


    localStorage.removeItem(
      DRAFT_KEY
    );


    renderSuccess(
      post
    );
  }


  function renderSuccess(post) {
    stage.innerHTML =
      `
        <section class="success">

          <p class="step-label">
            STEP 4 OF 4
          </p>

          <h2>
            Added to Camp Rinella
          </h2>

          <p>
            This memory is now part of the camp archive.
          </p>


          <article class="success-card">

            <img
              src="${escapeHtml(post.imageUrl)}"
              alt="">

            <div class="success-copy">

              <p class="choice-kicker">
                NEW · #1 RECENT ARCHIVE
              </p>

              <h3>
                ${escapeHtml(post.title)}
              </h3>

              ${
                post.hasVoice
                  ? `
                    <p>
                      🎙 Voice attached
                    </p>
                  `
                  : ""
              }

            </div>

          </article>


          <div class="actions">

            <button
              type="button"
              class="back-btn"
              data-room>

              See It in Archives

            </button>

            <button
              type="button"
              class="action-btn primary"
              data-feed>

              See It in CampFeed →

            </button>

          </div>

        </section>
      `;


    stage
      .querySelector(
        "[data-room]"
      )
      .addEventListener(
        "click",
        () => {

          window.location.href =
            `${ROOM_URL}&saved=${encodeURIComponent(post.id)}&v=20260811-dxb016`;
        }
      );


    stage
      .querySelector(
        "[data-feed]"
      )
      .addEventListener(
        "click",
        () => {

          window.location.href =
            `/v2/experience-builder/runtime/showcase-v2/shared/feed-proof/index.html?experience=steve-rinella&post=${encodeURIComponent(post.id)}&source=archives`;
        }
      );
  }


  document
    .querySelector(
      "[data-back]"
    )
    .addEventListener(
      "click",
      () => {

        window.location.href =
          `${ROOM_URL}&v=20260811-dxb016`;
      }
    );


  async function init() {
    try {

      [
        state.config,
        state.archives
      ] =
        await Promise.all([
          fetchJson(
            CONFIG_URL
          ),
          fetchJson(
            ARCHIVES_URL
          )
        ]);


      state.flow =
        flow();


      renderChoices();
    }
    catch (error) {

      console.error(
        "DXB-016 archive create failed:",
        error
      );


      stage.textContent =
        "Unable to load the guided Archives experience.";
    }
  }


  init();

})();
