(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCjw3z52JzomgclqczxJguGGlltlXWU45w",
    authDomain: "deercamp-47c12.firebaseapp.com",
    projectId: "deercamp-47c12",
    storageBucket: "deercamp-47c12.firebasestorage.app",
    messagingSenderId: "343631330837",
    appId: "1:343631330837:web:246adec6a15421c390d81c"
  };

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
        await db.collection("camps").doc(cleanCampId).set({
          ...payload,
          campId: cleanCampId,
          updatedAtClient: new Date().toISOString()
        }, { merge: true });
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
        const scopedKey = `deercamp.camps.${cleanCampId}.campData`;
        localStorage.setItem("campData", JSON.stringify(cloud));
        localStorage.setItem(scopedKey, JSON.stringify(cloud));
        localStorage.setItem("deercamp.activeCampId", cleanCampId);
      } catch (error) {
        console.warn("Could not cache Firestore camp locally.", error);
      }
      return cloud;
    }
  };

  window.DeerCampCloud = DeerCampCloud;
  window.DEERCAMP_FIREBASE_READY = Boolean(DeerCampCloud.ensureReady());
})();
