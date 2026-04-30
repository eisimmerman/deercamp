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



  function dcSlug(value) {
    return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || "").split(",");
    if (parts.length < 2) throw new Error("Invalid image data URL.");
    const match = parts[0].match(/data:([^;]+);base64/i);
    const contentType = match ? match[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: contentType }), contentType };
  }

  const DeerCampStorage = window.DeerCampStorage || {
    ensureReady() {
      try {
        if (!window.firebase || !firebase.storage) return null;
        const app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
        return app.storage();
      } catch (error) {
        console.warn("DeerCamp Storage init failed.", error);
        return null;
      }
    },
    isDataUrl(value) { return /^data:image\//i.test(String(value || "")); },
    async uploadBlob(path, blob, metadata = {}) {
      const storage = this.ensureReady();
      if (!storage) throw new Error("Firebase Storage is not available.");
      if (!path || !blob) throw new Error("Missing Storage path or image blob.");
      const contentType = metadata.contentType || blob.type || "image/jpeg";
      const ref = storage.ref().child(path);
      const snapshot = await ref.put(blob, {
        contentType,
        customMetadata: Object.assign({ app: "DeerCamp" }, metadata.customMetadata || {})
      });
      const url = await snapshot.ref.getDownloadURL();
      return { url, path, bytes: blob.size || 0, contentType };
    },
    async uploadDataUrl(path, dataUrl, metadata = {}) {
      if (!this.isDataUrl(dataUrl)) return null;
      const converted = dataUrlToBlob(dataUrl);
      return this.uploadBlob(path, converted.blob, Object.assign({}, metadata, { contentType: converted.contentType }));
    },
    async uploadCampImagePair(options = {}) {
      const campId = dcSlug(options.campId || "camp");
      const folder = dcSlug(options.folder || "images");
      const entityId = dcSlug(options.entityId || Date.now());
      const displayDataUrl = String(options.displayDataUrl || "").trim();
      const thumbDataUrl = String(options.thumbDataUrl || "").trim() || displayDataUrl;
      const basePath = 'camps/' + campId + '/' + folder + '/' + entityId;
      const result = { displayUrl: "", thumbUrl: "", displayPath: "", thumbPath: "", bytes: 0, storageProvider: "firebase" };
      if (displayDataUrl && this.isDataUrl(displayDataUrl)) {
        const uploaded = await this.uploadDataUrl(basePath + '/display.jpg', displayDataUrl, { customMetadata: { role: "display", campId, folder, entityId } });
        if (uploaded) Object.assign(result, { displayUrl: uploaded.url, displayPath: uploaded.path, displayBytes: uploaded.bytes, displayContentType: uploaded.contentType });
      }
      if (thumbDataUrl && this.isDataUrl(thumbDataUrl)) {
        const uploaded = await this.uploadDataUrl(basePath + '/thumb.jpg', thumbDataUrl, { customMetadata: { role: "thumb", campId, folder, entityId } });
        if (uploaded) Object.assign(result, { thumbUrl: uploaded.url, thumbPath: uploaded.path, thumbBytes: uploaded.bytes, thumbContentType: uploaded.contentType });
      }
      result.bytes = Number(result.displayBytes || 0) + Number(result.thumbBytes || 0);
      return result;
    }
  };



  const DeerCampBilling = window.DeerCampBilling || {
    prices: {
      dcPlusMonthly: "price_1TRsjcDOIUbMFzLxNCO58x3n",
      dcPlusAnnual: "price_1TRsjcDOIUbMFzLxmw4bEOuM"
    },
    normalizeTier(value) {
      const clean = String(value || "").trim().toLowerCase();
      if (["dc_plus", "dc+", "plus", "deercamp_plus"].includes(clean)) return "dc_plus";
      if (["dcp", "premium", "deercamp_premium"].includes(clean)) return "dcp";
      return "dcf";
    },
    getBilling(data = {}) {
      const billing = data && typeof data.billing === "object" ? data.billing : {};
      return {
        tier: this.normalizeTier(billing.tier || data.tier || "dcf"),
        status: String(billing.status || data.billingStatus || "free").toLowerCase(),
        stripeCustomerId: String(billing.stripeCustomerId || ""),
        stripeSubscriptionId: String(billing.stripeSubscriptionId || ""),
        priceId: String(billing.priceId || ""),
        currentPeriodEnd: billing.currentPeriodEnd || null
      };
    },
    hasDcPlus(data = {}) {
      const billing = this.getBilling(data);
      return billing.tier === "dc_plus" && ["active", "trialing"].includes(billing.status);
    },
    async postJson(url, payload) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Billing request failed.");
      return json;
    },
    async postJsonWithFallback(urls, payload) {
      const endpointList = Array.isArray(urls) ? urls : [urls];
      let lastError = null;
      for (const url of endpointList) {
        try {
          return await this.postJson(url, payload);
        } catch (error) {
          lastError = error;
          console.warn("DeerCamp billing endpoint failed; trying next endpoint.", { url, error: error && error.message ? error.message : String(error) });
        }
      }
      throw lastError || new Error("Billing request failed.");
    },
    async startCheckout(options = {}) {
      const campId = String(options.campId || "").trim();
      const priceId = String(options.priceId || this.prices.dcPlusMonthly).trim();
      if (!campId) throw new Error("Missing campId for checkout.");
      if (!priceId) throw new Error("Missing Stripe priceId for checkout.");
      const origin = window.location.origin;
      const successUrl = options.successUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = options.cancelUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&checkout=cancelled`;
      const payload = {
        campId,
        priceId,
        email: options.email || "",
        successUrl,
        cancelUrl
      };
      const session = await this.postJsonWithFallback([
        "https://us-central1-deercamp-47c12.cloudfunctions.net/createCheckoutSession",
        "/api/create-checkout-session"
      ], payload);
      if (!session.url) throw new Error("Stripe checkout URL was not returned.");
      window.location.href = session.url;
      return session;
    },
    async manageBilling(options = {}) {
      const campId = String(options.campId || "").trim();
      if (!campId) throw new Error("Missing campId for billing portal.");
      const origin = window.location.origin;
      const returnUrl = options.returnUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&billing=returned`;
      const session = await this.postJsonWithFallback([
        "https://us-central1-deercamp-47c12.cloudfunctions.net/createBillingPortalSession",
        "/api/create-billing-portal-session"
      ], { campId, returnUrl });
      if (!session.url) throw new Error("Stripe billing portal URL was not returned.");
      window.location.href = session.url;
      return session;
    }
  };

  window.DeerCampCloud = DeerCampCloud;
  window.DeerCampStorage = DeerCampStorage;
  window.DeerCampBilling = DeerCampBilling;
  window.DEERCAMP_FIREBASE_READY = Boolean(DeerCampCloud.ensureReady());
})();
