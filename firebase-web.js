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
    tiers: {
      DCF: "dcf",
      DC_PLUS: "dc_plus",
      DCP: "dcp"
    },
    featureKeys: {
      SCOUT_ELITE: "scout_elite",
      STAND_BUILDER: "stand_builder",
      DRIVE_BUILDER: "drive_builder",
      SHOW_ALL_STANDS: "show_all_stands",
      SHOW_ALL_DRIVES: "show_all_drives",
      POSTER_EXPORT: "poster_export",
      MULTI_IMAGE_POSTS: "multi_image_posts",
      VIDEO_POSTS: "video_posts",
      MEMBER_LIMIT: "member_limit",
      STAND_LIMIT: "stand_limit",
      DRIVE_LIMIT: "drive_limit",
      BASIC_DEER_STAND: "basic_deer_stand",
      BASIC_DEER_DRIVE: "basic_deer_drive",
      SINGLE_IMAGE_POSTS: "single_image_posts",
      BASIC_CAMP: "basic_camp"
    },
    tierLimits: {
      dcf: {
        members: 8,
        deerStands: 3,
        deerDrives: 1,
        imagesPerPost: 1,
        videosPerPost: 0
      },
      dc_plus: {
        members: Infinity,
        deerStands: Infinity,
        deerDrives: Infinity,
        imagesPerPost: Infinity,
        videosPerPost: Infinity
      },
      dcp: {
        members: Infinity,
        deerStands: Infinity,
        deerDrives: Infinity,
        imagesPerPost: Infinity,
        videosPerPost: Infinity
      }
    },
    featureRules: {
      basic_camp: { tiers: ["dcf", "dc_plus", "dcp"] },
      single_image_posts: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "imagesPerPost" },
      basic_deer_stand: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "deerStands" },
      basic_deer_drive: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "deerDrives" },
      scout_elite: { tiers: ["dc_plus", "dcp"] },
      stand_builder: { tiers: ["dc_plus", "dcp"] },
      drive_builder: { tiers: ["dc_plus", "dcp"] },
      show_all_stands: { tiers: ["dc_plus", "dcp"] },
      show_all_drives: { tiers: ["dc_plus", "dcp"] },
      poster_export: { tiers: ["dc_plus", "dcp"] },
      multi_image_posts: { tiers: ["dc_plus", "dcp"] },
      video_posts: { tiers: ["dc_plus", "dcp"] },
      member_limit: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "members" },
      stand_limit: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "deerStands" },
      drive_limit: { tiers: ["dcf", "dc_plus", "dcp"], limitKey: "deerDrives" }
    },
    featureAliases: {
      dc_plus: "scout_elite",
      dcplus: "scout_elite",
      scout: "scout_elite",
      scoutelite: "scout_elite",
      deer_camp_scout_elite: "scout_elite",
      deerstand_builder: "stand_builder",
      deer_drive_builder: "drive_builder",
      deerdrive_builder: "drive_builder",
      show_all: "show_all_stands",
      showall_stands: "show_all_stands",
      showall_drives: "show_all_drives",
      pdf_export: "poster_export",
      poster_pdf: "poster_export",
      export_poster: "poster_export",
      members: "member_limit",
      member: "member_limit",
      deer_stands: "stand_limit",
      stands: "stand_limit",
      stand: "stand_limit",
      basic_stand: "basic_deer_stand",
      basic_deerstand: "basic_deer_stand",
      basic_deer_stands: "basic_deer_stand",
      save_stand: "stand_limit",
      saved_stands: "stand_limit",
      deer_drives: "drive_limit",
      drives: "drive_limit",
      drive: "drive_limit",
      basic_drive: "basic_deer_drive",
      basic_deerdrive: "basic_deer_drive",
      basic_deer_drives: "basic_deer_drive",
      save_drive: "drive_limit",
      saved_drives: "drive_limit",
      multi_image: "multi_image_posts",
      multi_images: "multi_image_posts",
      video: "video_posts",
      videos: "video_posts"
    },
    upgradeMessages: {
      scout_elite: "Upgrade to DC+ to unlock DeerCamp Scout Elite planning tools.",
      stand_builder: "Upgrade to DC+ to unlock Stand Builder and save more stand plans.",
      drive_builder: "Upgrade to DC+ to unlock Drive Builder and save more deer drive plans.",
      show_all_stands: "Upgrade to DC+ to show all stands on one map.",
      show_all_drives: "Upgrade to DC+ to show all deer drives on one map.",
      poster_export: "Upgrade to DC+ to unlock 24×36 printable map exports.",
      multi_image_posts: "Upgrade to DC+ to add multi-image camp posts.",
      video_posts: "Upgrade to DC+ to add video camp posts.",
      member_limit: "DCF includes up to 8 members. Upgrade to DC+ for a larger camp roster.",
      stand_limit: "DCF includes up to 3 saved stands. Upgrade to DC+ to save more stands.",
      drive_limit: "DCF includes 1 saved deer drive. Upgrade to DC+ to save more deer drives.",
      basic_deer_stand: "DCF includes up to 3 basic deer stand cards. Upgrade to DC+ for map-based Stand Builder and more stands.",
      basic_deer_drive: "DCF includes 1 basic deer drive card. Upgrade to DC+ for map-based Drive Builder and more drives."
    },
    normalizeTier(value) {
      const clean = String(value || "").trim().toLowerCase();
      if (["dc_plus", "dc+", "plus", "deercamp_plus"].includes(clean)) return "dc_plus";
      if (["dcp", "premium", "deercamp_premium"].includes(clean)) return "dcp";
      return "dcf";
    },
    normalizeFeatureKey(value) {
      const clean = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return this.featureRules[clean] ? clean : (this.featureAliases[clean] || clean || "basic_camp");
    },
    parseBoolean(value) {
      if (value === true) return true;
      if (value === false || value == null) return false;
      const clean = String(value || "").trim().toLowerCase();
      return ["true", "1", "yes", "y", "scheduled", "at_period_end"].includes(clean);
    },
    parseDate(value) {
      if (!value) return null;
      try {
        if (typeof value === "object") {
          if (typeof value.toDate === "function") return value.toDate();
          if (Number.isFinite(value.seconds)) return new Date(Number(value.seconds) * 1000);
          if (Number.isFinite(value._seconds)) return new Date(Number(value._seconds) * 1000);
        }
        if (typeof value === "number") return new Date(value < 10000000000 ? value * 1000 : value);
        const clean = String(value || "").trim();
        if (!clean) return null;
        if (/^\d+$/.test(clean)) {
          const numeric = Number(clean);
          return new Date(numeric < 10000000000 ? numeric * 1000 : numeric);
        }
        const parsed = new Date(clean);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      } catch (error) {
        return null;
      }
    },
    formatDate(value) {
      const date = this.parseDate(value);
      if (!date) return "";
      try {
        return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
      } catch (error) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }
    },
    getBilling(data = {}) {
      const billing = data && typeof data.billing === "object" ? data.billing : {};
      const currentPeriodEnd = billing.currentPeriodEnd || billing.current_period_end || billing.currentPeriodEndsAt || billing.periodEnd || billing.activeUntil || billing.dcPlusActiveUntil || data.currentPeriodEnd || data.current_period_end || data.dcPlusActiveUntil || null;
      const cancelAt = billing.cancelAt || billing.cancel_at || billing.canceledAtPeriodEnd || data.cancelAt || data.cancel_at || null;
      return {
        tier: this.normalizeTier(billing.tier || data.tier || "dcf"),
        status: String(billing.status || data.billingStatus || "free").toLowerCase(),
        stripeCustomerId: String(billing.stripeCustomerId || ""),
        stripeSubscriptionId: String(billing.stripeSubscriptionId || billing.subscriptionId || ""),
        priceId: String(billing.priceId || ""),
        currentPeriodEnd,
        cancelAt,
        cancelAtPeriodEnd: this.parseBoolean(billing.cancelAtPeriodEnd || billing.cancel_at_period_end || billing.cancelScheduled || billing.scheduledCancellation || data.cancelAtPeriodEnd || data.cancel_at_period_end) || Boolean(cancelAt && this.parseDate(cancelAt))
      };
    },
    getBillingState(data = {}) {
      const billing = this.getBilling(data);
      const periodEnd = this.parseDate(billing.currentPeriodEnd || billing.cancelAt);
      const periodStillOpen = periodEnd ? periodEnd.getTime() > Date.now() : false;
      const activeStatus = ["active", "trialing"].includes(billing.status);
      const pastDueStatus = ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(billing.status);
      const endedStatus = ["canceled", "cancelled", "deleted", "ended", "expired"].includes(billing.status);
      const dcPlusTier = ["dc_plus", "dcp"].includes(billing.tier);
      const active = dcPlusTier && (activeStatus || (endedStatus && periodStillOpen));
      const scheduledCancel = active && (billing.cancelAtPeriodEnd || Boolean(billing.cancelAt));
      const effectiveTier = active ? billing.tier : "dcf";
      return {
        ...billing,
        dcPlusTier,
        active,
        scheduledCancel,
        pastDue: dcPlusTier && pastDueStatus,
        ended: dcPlusTier && endedStatus && !periodStillOpen,
        activeUntilDate: periodEnd,
        activeUntilLabel: this.formatDate(billing.currentPeriodEnd || billing.cancelAt),
        effectiveTier
      };
    },
    getTier(data = {}) {
      return this.getBillingState(data).effectiveTier;
    },
    hasDcPlus(data = {}) {
      return ["dc_plus", "dcp"].includes(this.getTier(data));
    },
    getLimit(limitKey, data = {}) {
      const tier = this.getTier(data);
      const tierLimits = this.tierLimits[tier] || this.tierLimits.dcf;
      return Object.prototype.hasOwnProperty.call(tierLimits, limitKey) ? tierLimits[limitKey] : Infinity;
    },
    getFeatureAccess(featureKey, data = {}, options = {}) {
      const normalizedFeature = this.normalizeFeatureKey(featureKey);
      const rule = this.featureRules[normalizedFeature] || { tiers: ["dcf", "dc_plus", "dcp"] };
      const tier = this.getTier(data);
      const allowedTier = (rule.tiers || ["dcf", "dc_plus", "dcp"]).includes(tier);
      const limit = rule.limitKey ? this.getLimit(rule.limitKey, data) : Infinity;
      const usage = Number.isFinite(Number(options.usage)) ? Number(options.usage) : null;
      const withinLimit = !rule.limitKey || !Number.isFinite(limit) || usage === null || usage < limit;
      const allowed = Boolean(allowedTier && withinLimit);
      const billingState = this.getBillingState(data);
      let reason = allowed ? "allowed" : "upgrade_required";
      if (allowedTier && !withinLimit) reason = "limit_reached";
      if (billingState.pastDue && rule.tiers && !rule.tiers.includes("dcf")) reason = "billing_attention_required";
      return {
        allowed,
        featureKey: normalizedFeature,
        tier,
        requiredTiers: rule.tiers || ["dcf", "dc_plus", "dcp"],
        limit,
        usage,
        remaining: Number.isFinite(limit) && usage !== null ? Math.max(0, limit - usage) : Infinity,
        reason,
        upgradeMessage: this.upgradeMessages[normalizedFeature] || "Upgrade to DC+ to unlock this DeerCamp feature.",
        billingState
      };
    },
    canUseFeature(featureKey, data = {}, options = {}) {
      return this.getFeatureAccess(featureKey, data, options).allowed;
    },
    getUpgradeMessage(featureKey, data = {}, options = {}) {
      const access = this.getFeatureAccess(featureKey, data, options);
      if (access.reason === "limit_reached") {
        const used = Number.isFinite(access.usage) ? access.usage : 0;
        const limit = Number.isFinite(access.limit) ? access.limit : "unlimited";
        return `${access.upgradeMessage} (${used}/${limit} used.)`;
      }
      if (access.reason === "billing_attention_required") return "Fix billing to keep using this DC+ feature.";
      return access.upgradeMessage || "Upgrade to DC+ to unlock this DeerCamp feature.";
    },
    countFeatureUsage(featureKey, data = {}) {
      const normalizedFeature = this.normalizeFeatureKey(featureKey);
      const arrays = {
        member_limit: [data.memberProfiles, data.dashboardMembers, data.members, data.campMembers],
        stand_limit: [data.deerStandPosts, data.deerStands, data.savedDeerStands, data.scoutDeerStands, data.stands],
        basic_deer_stand: [data.deerStandPosts, data.deerStands, data.savedDeerStands, data.scoutDeerStands, data.stands],
        drive_limit: [data.deerDrivePosts, data.deerDrives, data.savedDeerDrives, data.scoutDeerDrives],
        basic_deer_drive: [data.deerDrivePosts, data.deerDrives, data.savedDeerDrives, data.scoutDeerDrives]
      };
      const candidates = arrays[normalizedFeature] || [];
      for (const list of candidates) {
        if (Array.isArray(list)) {
          if (normalizedFeature === "member_limit") {
            return list.filter(item => {
              if (item && typeof item === "object") {
                const role = String(item.role || "").toLowerCase();
                const status = String(item.status || "Active").toLowerCase();
                return role !== "camp steward" && status !== "removed";
              }
              return String(item || "").trim();
            }).length;
          }
          return list.filter(Boolean).length;
        }
      }
      return 0;
    },
    getLimitFeatureAccess(featureKey, data = {}, usageOverride) {
      const usage = Number.isFinite(Number(usageOverride)) ? Number(usageOverride) : this.countFeatureUsage(featureKey, data);
      return this.getFeatureAccess(featureKey, data, { usage });
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
      const planKey = String(options.planKey || "").trim();
      const priceId = String(options.priceId || (planKey ? this.prices[planKey] : "") || this.prices.dcPlusMonthly).trim();
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
