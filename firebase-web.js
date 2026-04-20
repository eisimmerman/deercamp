(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCjw3z52JzomgclqczxJguGGlltlXWU45w",
    authDomain: "deercamp-47c12.firebaseapp.com",
    projectId: "deercamp-47c12",
    storageBucket: "deercamp-47c12.firebasestorage.app",
    messagingSenderId: "343631330837",
    appId: "1:343631330837:web:246adec6a15421c390d81c"
  };

  function scopedKey(campId, suffix) {
    const cleanCampId = String(campId || "").trim();
    return cleanCampId ? `deercamp.camps.${cleanCampId}.${suffix}` : "";
  }

  const DeerCampCloud = window.DeerCampCloud || {
    _ready: false,
    _db: null,

    ensureReady() {
      try {
        if (this._ready && this._db) return this._db;
        if (!window.firebase || !firebase.firestore) return null;

        const existing = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
        this._db = existing.firestore();
        this._ready = true;
        return this._db;
      } catch (error) {
        console.warn("DeerCamp Firebase init failed.", error);
        return null;
      }
    },

    async getCamp(campId) {
      const cleanCampId = String(campId || "").trim();
      if (!cleanCampId) return null;
      const db = this.ensureReady();
      if (!db) return null;
      try {
        const snap = await db.collection("camps").doc(cleanCampId).get();
        return snap.exists ? snap.data() : null;
      } catch (error) {
        console.warn("Could not load camp from Firestore.", error);
        return null;
      }
    },

    async saveCamp(campId, payload) {
      const cleanCampId = String(campId || "").trim();
      if (!cleanCampId || !payload || typeof payload !== "object") return false;
      const db = this.ensureReady();
      if (!db) return false;
      try {
        let dashboardSlim = null;
        try {
          const scopedDashboardKey = scopedKey(cleanCampId, "dashboardSlim");
          const scopedDashboardRaw = scopedDashboardKey ? localStorage.getItem(scopedDashboardKey) : "";
          const genericDashboardRaw = localStorage.getItem("deercamp.stewardDashboardSlim") || localStorage.getItem("deerCampStewardDashboard") || "";
          const dashboardRaw = scopedDashboardRaw || genericDashboardRaw || "";
          if (dashboardRaw) {
            const parsed = JSON.parse(dashboardRaw);
            if (parsed && typeof parsed === "object") {
              dashboardSlim = parsed;
            }
          }
        } catch (error) {
          console.warn("Could not read dashboard state before Firestore save.", error);
        }

        const payloadToSave = {
          ...payload,
          campId: cleanCampId,
          updatedAtClient: new Date().toISOString()
        };

        if (dashboardSlim && typeof dashboardSlim === "object") {
          payloadToSave.dashboardSlim = {
            ...dashboardSlim,
            campId: cleanCampId
          };
          if (Array.isArray(dashboardSlim.pendingInvites)) payloadToSave.pendingInvites = dashboardSlim.pendingInvites;
          if (Array.isArray(dashboardSlim.members)) payloadToSave.dashboardMembers = dashboardSlim.members;
          if (Array.isArray(dashboardSlim.people)) payloadToSave.dashboardPeople = dashboardSlim.people;
        }

        await db.collection("camps").doc(cleanCampId).set(payloadToSave, { merge: true });
        return true;
      } catch (error) {
        console.warn("Could not save camp to Firestore.", error);
        return false;
      }
    },

    async hydrateCampToLocal(campId) {
      const cleanCampId = String(campId || "").trim();
      if (!cleanCampId) return null;
      const cloud = await this.getCamp(cleanCampId);
      if (!cloud || typeof cloud !== "object") return null;
      try {
        const scopedCampKey = scopedKey(cleanCampId, "campData");
        const scopedDashboardKey = scopedKey(cleanCampId, "dashboardSlim");

        localStorage.setItem("campData", JSON.stringify(cloud));
        localStorage.setItem(scopedCampKey, JSON.stringify(cloud));
        localStorage.setItem("deercamp.activeCampId", cleanCampId);

        const hydratedDashboard = cloud.dashboardSlim && typeof cloud.dashboardSlim === "object"
          ? {
              ...cloud.dashboardSlim,
              campId: cleanCampId,
              pendingInvites: Array.isArray(cloud.dashboardSlim.pendingInvites)
                ? cloud.dashboardSlim.pendingInvites
                : (Array.isArray(cloud.pendingInvites) ? cloud.pendingInvites : []),
              members: Array.isArray(cloud.dashboardSlim.members)
                ? cloud.dashboardSlim.members
                : (Array.isArray(cloud.dashboardMembers) ? cloud.dashboardMembers : []),
              people: Array.isArray(cloud.dashboardSlim.people)
                ? cloud.dashboardSlim.people
                : (Array.isArray(cloud.dashboardPeople) ? cloud.dashboardPeople : [])
            }
          : {
              campId: cleanCampId,
              camp: {
                campId: cleanCampId,
                name: cloud.name || cloud.campName || "",
                city: cloud.city || "",
                state: cloud.state || "",
                zip: cloud.zip || "",
                established: cloud.established || "",
                summary: cloud.summary || cloud.about || "",
                hero: cloud.hero || cloud.brandImage || cloud.brandingImage || "",
                publishState: cloud.publishState || (cloud.isPublic ? "public" : "private")
              },
              stewardName: cloud.stewardName || cloud.steward || "",
              stewardEmail: cloud.stewardEmail || "",
              sections: cloud.enabledSections || {},
              selectedRecipeIds: Array.isArray(cloud.selectedRecipeIds) ? cloud.selectedRecipeIds : [],
              members: Array.isArray(cloud.dashboardMembers)
                ? cloud.dashboardMembers
                : (Array.isArray(cloud.memberProfiles) ? cloud.memberProfiles : []),
              people: Array.isArray(cloud.dashboardPeople)
                ? cloud.dashboardPeople
                : (Array.isArray(cloud.memberProfiles) ? cloud.memberProfiles : []),
              pendingInvites: Array.isArray(cloud.pendingInvites) ? cloud.pendingInvites : []
            };

        localStorage.setItem("deercamp.stewardDashboardSlim", JSON.stringify(hydratedDashboard));
        localStorage.setItem("deerCampStewardDashboard", JSON.stringify(hydratedDashboard));
        localStorage.setItem(scopedDashboardKey, JSON.stringify(hydratedDashboard));
      } catch (error) {
        console.warn("Could not cache Firestore camp locally.", error);
      }
      return cloud;
    },

    subscribeToCamp(campId, onData) {
      const cleanCampId = String(campId || "").trim();
      if (!cleanCampId || typeof onData !== "function") return () => {};
      const db = this.ensureReady();
      if (!db) return () => {};

      try {
        return db.collection("camps").doc(cleanCampId).onSnapshot((snap) => {
          if (!snap || !snap.exists) return;
          const payload = snap.data();
          if (!payload || typeof payload !== "object") return;
          onData(payload);
        }, (error) => {
          console.warn("Realtime Firestore subscription failed.", error);
        });
      } catch (error) {
        console.warn("Could not subscribe to Firestore camp.", error);
        return () => {};
      }
    }
  };

  window.DeerCampCloud = DeerCampCloud;
  window.DEERCAMP_FIREBASE_READY = Boolean(DeerCampCloud.ensureReady());
})();
