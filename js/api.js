// /js/api.js — Supabase CRUD facade
(function () {
  "use strict";

  const storage = window.localStorage;
  const Core = window.SeavApiCore;
  const M = window.SeavApiMappers;

  const {
    STORAGE_BUCKETS, ENTITY_FILE_FIELDS, getAuthUserId, resolveAuthUserId,
    isVesselKey, isSeatimeKey, isCertKey, isRefKey, isProfileKey,
    isTenderKey, isAchievementKey, isNavigationAreaKey, isOnboardExperienceKey,
    isHobbyInterestKey, isSpecialistQualificationKey, isPayslipKey,
    resolveStorageFileUrl, sanitizeFileForStorage, buildUploadedFileMeta,
    hydrateProfilePhoto, withUserId, findIndexById, hydrateArrayFiles
  } = Core;

  const {
    mapProfileFromSupabase, mapProfileToSupabase,
    mapVesselFromSupabase, mapVesselToSupabase,
    mapSeatimeFromSupabase, mapSeatimeToSupabase,
    mapCertFromSupabase, mapCertToSupabase,
    mapRefFromSupabase, mapRefToSupabase,
    mapTenderFromSupabase, mapTenderToSupabase,
    mapAchievementFromSupabase, mapAchievementToSupabase,
    mapNavigationAreaFromSupabase, mapNavigationAreaToSupabase,
    mapOnboardExperienceFromSupabase, mapOnboardExperienceToSupabase,
    mapHobbyInterestFromSupabase, mapHobbyInterestToSupabase,
    mapSpecialistQualificationFromSupabase, mapSpecialistQualificationToSupabase,
    mapPayslipFromSupabase, mapPayslipToSupabase
  } = M;

  let bulkHydrateFiles = true;

  function setBulkHydrateFiles(enabled) {
    bulkHydrateFiles = enabled === true;
  }

  function keyToStateField(key) {
    const K = window.SeavData?.KEYS;
    if (!K) return null;
    const map = {
      [K.SEATIMES]: "seatimes",
      [K.CERTS]: "certs",
      [K.VESSELS]: "vessels",
      [K.REFS]: "refs",
      [K.ACHIEVEMENTS]: "achievements",
      [K.NAVIGATION_AREAS]: "navigationAreas",
      [K.TENDERS]: "tenders",
      [K.ONBOARD_EXPERIENCES]: "onboardExperiences",
      [K.HOBBIES_INTERESTS]: "hobbiesInterests",
      [K.SPECIALIST_QUALIFICATIONS]: "specialistQualifications",
      [K.PAYSLIPS]: "payslips"
    };
    return map[key] || null;
  }

  function getCachedArray(key) {
    const field = keyToStateField(key);
    if (!field || !window.SeavState?.ready) return null;
    const items = window.SeavState.data?.[field];
    return Array.isArray(items) ? items : null;
  }

  function writeCachedArray(key, items) {
    const field = keyToStateField(key);
    if (!field || !window.SeavState?.data) return items;
    window.SeavState.data[field] = items;
    window.SeavState.syncCache?.();
    return items;
  }

  async function resolveArrayAfterMutation(key, mutator) {
    const cached = getCachedArray(key);
    if (cached) {
      return writeCachedArray(key, mutator([...cached]));
    }
    return fetchArrayByKey(key, await resolveAuthUserId());
  }

  function clientForOptions(options = {}) {
    return options.public === true
      ? window.SeavPublicSupabase || window.SeavSupabase
      : window.SeavSupabase;
  }

  const PUBLIC_ARRAY_COLUMNS = {
    vessels: [
      "id", "user_id", "name", "flag", "gt", "vessel_length", "builder", "vessel_role",
      "vessel_type", "program", "experience_onboard", "date_from", "date_to", "photo",
      "created_at", "updated_at"
    ].join(","),
    seatimes: [
      "id", "user_id", "vessel_id", "flag", "gt", "capacity_served", "date_joined",
      "date_left", "actual_sea_service_days", "standby_service_days", "yard_service_days",
      "watchkeeping_days", "verification_status", "created_at", "updated_at"
    ].join(","),
    // No "attachment" here on purpose: the public profile never renders a
    // certificate file link (only expiry/issue metadata), and certificate
    // scans can contain PII (full name, DOB, nationality). The matching
    // DB-level anon grant and the certificate-files storage read policy
    // were tightened to match — see docs/schema-phase2-public-hardening.sql.
    certificates: [
      "id", "user_id", "code", "name", "issue_date", "expiry_date", "status",
      "is_mandatory", "is_template", "created_at", "updated_at"
    ].join(","),
    sea_references: [
      "id", "user_id", "name", "title", "vessel_id", "role", "period", "reference_text",
      "reference_date", "status", "attachment", "verification", "created_at", "updated_at"
    ].join(","),
    achievements: [
      "id", "user_id", "code", "title", "category", "dashboard_section", "badge_key",
      "badge_file_name", "badge_tier", "badge_label", "badge_image", "badge_locked_image",
      "vessel_id", "vessel", "achievement_date", "status", "witness_name",
      "witness_position", "description", "attachment", "auto_awarded", "created_at", "updated_at"
    ].join(","),
    navigation_areas: [
      "id", "user_id", "country", "port", "from_country", "from_port", "from_lat",
      "from_lng", "to_country", "to_port", "to_lat", "to_lng", "vessel_id", "seatime_id",
      "operation_type", "passage_name", "visited_date", "departure_date", "arrival_date",
      "lat", "lng", "waypoints", "note", "created_at", "updated_at"
    ].join(","),
    // No "signoff" here on purpose: it's a jsonb blob including the
    // supervisor's signatory_email, and the public onboard-experience row
    // never renders any part of it (only category/title/dates/status) — see
    // js/seav-cards.js's buildOnboardRow. Matching DB-level anon grant is
    // column-scoped to exclude signoff too (docs/schema-phase2-public-hardening.sql).
    onboard_experiences: [
      "id", "user_id", "vessel_id", "category", "title", "description", "location_onboard",
      "date_from", "date_to", "hours", "is_familiarisation", "status",
      "attachment", "created_at", "updated_at"
    ].join(","),
    hobbies_interests: [
      "id", "user_id", "category", "title", "description", "date_from", "date_to",
      "status", "photos", "created_at", "updated_at"
    ].join(","),
    specialist_qualifications: [
      "id", "user_id", "category", "title", "issuing_body", "date_obtained", "expiry",
      "status", "notes", "attachment", "created_at", "updated_at"
    ].join(","),
    tenders: [
      "id", "user_id", "name", "vessel_id", "type", "model", "length", "engine", "capacity",
      "reg", "proficiency_level", "description", "photo", "created_at", "updated_at"
    ].join(",")
  };

  async function fetchSupabaseArray(table, mapper, orderColumn, userId, options = {}) {
    const client = clientForOptions(options);
    if (!client) return [];

    const columns = options.public ? PUBLIC_ARRAY_COLUMNS[table] || "id" : "*";
    let query = client.from(table).select(columns);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[SEA-V] Supabase fetch failed for ${table}:`, error);
      if (!options.public) {
        document.dispatchEvent(
          new CustomEvent("seav:fetch-error", {
            detail: { table, message: error.message || String(error) }
          })
        );
      }
      return [];
    }

    const mapped = (data || []).map(mapper);
    const shouldHydrateFiles = bulkHydrateFiles || options.public === true;
    if (!shouldHydrateFiles) return mapped;
    return hydrateArrayFiles(mapped, table, { client });
  }

  async function fetchArrayByKey(key, userId, options = {}) {
    if (isVesselKey(key)) {
      return await fetchSupabaseArray("vessels", mapVesselFromSupabase, "date_from", userId, options);
    }

    if (isSeatimeKey(key)) {
      return await fetchSupabaseArray("seatimes", mapSeatimeFromSupabase, "date_joined", userId, options);
    }

    if (isCertKey(key)) {
      return await fetchSupabaseArray("certificates", mapCertFromSupabase, null, userId, options);
    }

    if (isRefKey(key)) {
      return await fetchSupabaseArray("sea_references", mapRefFromSupabase, null, userId, options);
    }

    if (isTenderKey(key)) {
      return await fetchSupabaseArray("tenders", mapTenderFromSupabase, "created_at", userId, options);
    }

    if (isAchievementKey(key)) {
      return await fetchSupabaseArray("achievements", mapAchievementFromSupabase, "achievement_date", userId, options);
    }

    if (isNavigationAreaKey(key)) {
      return await fetchSupabaseArray("navigation_areas", mapNavigationAreaFromSupabase, "visited_date", userId, options);
    }

    if (isOnboardExperienceKey(key)) {
      return await fetchSupabaseArray("onboard_experiences", mapOnboardExperienceFromSupabase, "date_from", userId, options);
    }

    if (isHobbyInterestKey(key)) {
      return await fetchSupabaseArray("hobbies_interests", mapHobbyInterestFromSupabase, "date_from", userId, options);
    }

    if (isSpecialistQualificationKey(key)) {
      return await fetchSupabaseArray(
        "specialist_qualifications",
        mapSpecialistQualificationFromSupabase,
        "date_obtained",
        userId,
        options
      );
    }

    if (isPayslipKey(key)) {
      return await fetchSupabaseArray("payslips", mapPayslipFromSupabase, "payment_date", userId, options);
    }

    return [];
  }

  function getSupabaseErrorText(error) {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  }

  function isMissingSupabaseColumnError(error, column) {
    const text = getSupabaseErrorText(error).toLowerCase();
    const col = String(column || "").toLowerCase();
    return (
      !!col &&
      text.includes(col) &&
      (text.includes("column") || text.includes("schema cache"))
    );
  }

  function emitSchemaWarning(table, message) {
    document.dispatchEvent(
      new CustomEvent("seav:schema-warning", {
        detail: { table, message }
      })
    );
  }

  function stripNavigationSeatimeLink(item) {
    if (!item || !Object.prototype.hasOwnProperty.call(item, "seatime_id")) {
      return item;
    }
    const next = { ...item };
    delete next.seatime_id;
    return next;
  }

  async function saveNavigationAreaItem(mode, id, item) {
    const payload = withUserId(item);

    if (mode === "upsert") {
      let { error } = await window.SeavSupabase.from("navigation_areas").upsert([payload]);
      if (
        error &&
        isMissingSupabaseColumnError(error, "seatime_id") &&
        payload.seatime_id
      ) {
        ({ error } = await window.SeavSupabase
          .from("navigation_areas")
          .upsert([stripNavigationSeatimeLink(payload)]));
        if (!error) {
          emitSchemaWarning(
            "navigation_areas",
            "Passage saved, but the sea time link was skipped because your database is missing navigation_areas.seatime_id. Run docs/navigation-complete-migration.sql in Supabase."
          );
          return;
        }
      }
      if (error) throw error;
      return;
    }

    let query = window.SeavSupabase
      .from("navigation_areas")
      .update(payload)
      .eq("id", id);

    const userId = getAuthUserId();
    if (userId) query = query.eq("user_id", userId);

    let { error } = await query;
    if (
      error &&
      isMissingSupabaseColumnError(error, "seatime_id") &&
      payload.seatime_id
    ) {
      query = window.SeavSupabase
        .from("navigation_areas")
        .update(stripNavigationSeatimeLink(payload))
        .eq("id", id);
      if (userId) query = query.eq("user_id", userId);
      ({ error } = await query);
      if (!error) {
        emitSchemaWarning(
          "navigation_areas",
          "Passage saved, but the sea time link was skipped because your database is missing navigation_areas.seatime_id. Run docs/navigation-complete-migration.sql in Supabase."
        );
        return;
      }
    }
    if (error) throw error;
  }

  async function upsertSupabaseItem(table, item) {
    if (!window.SeavSupabase) {
      throw new Error("Supabase is not available.");
    }

    if (table === "navigation_areas") {
      try {
        await saveNavigationAreaItem("upsert", null, item);
      } catch (error) {
        console.error(`[SEA-V] Supabase save failed for ${table}:`, error);
        throw error;
      }
      return;
    }

    const { error } = await window.SeavSupabase.from(table).upsert([withUserId(item)]);

    if (error) {
      console.error(`[SEA-V] Supabase save failed for ${table}:`, error);
      throw error;
    }
  }

  async function updateSupabaseItem(table, id, item) {
    if (!window.SeavSupabase) {
      throw new Error("Supabase is not available.");
    }

    if (table === "navigation_areas") {
      try {
        await saveNavigationAreaItem("update", id, item);
      } catch (error) {
        console.error(`[SEA-V] Supabase update failed for ${table}:`, error);
        throw error;
      }
      return;
    }

    let query = window.SeavSupabase
      .from(table)
      .update(withUserId(item))
      .eq("id", id);

    const userId = getAuthUserId();
    if (userId) query = query.eq("user_id", userId);

    const { error } = await query;

    if (error) {
      console.error(`[SEA-V] Supabase update failed for ${table}:`, error);
      throw error;
    }
  }

  function collectStoragePathsFromRow(table, row) {
    if (!row) return [];

    const paths = [];
    const fields = ENTITY_FILE_FIELDS[table] || [];

    fields.forEach(({ field, bucket, isArray }) => {
      const value = row[field];
      if (!value) return;

      if (isArray && Array.isArray(value)) {
        value.forEach((fileMeta) => {
          if (fileMeta?.path) {
            paths.push({ bucket: fileMeta.bucket || bucket, path: fileMeta.path });
          }
        });
        return;
      }

      if (value?.path) {
        paths.push({ bucket: value.bucket || bucket, path: value.path });
      }
    });

    return paths;
  }

  async function fetchSupabaseRowById(table, id) {
    if (!window.SeavSupabase || !id) return null;

    let query = window.SeavSupabase
      .from(table)
      .select("*")
      .eq("id", id);

    const userId = getAuthUserId();
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn(`[SEA-V] Could not fetch ${table} row before delete:`, error);
      return null;
    }

    return data;
  }

  async function removeStoragePaths(paths) {
    if (!window.SeavSupabase || !paths.length) return;

    const byBucket = {};

    paths.forEach(({ bucket, path }) => {
      if (!bucket || !path) return;
      if (!byBucket[bucket]) byBucket[bucket] = [];
      byBucket[bucket].push(path);
    });

    for (const [bucket, filePaths] of Object.entries(byBucket)) {
      const { error } = await window.SeavSupabase.storage.from(bucket).remove(filePaths);
      if (error) {
        console.warn(`[SEA-V] Storage cleanup failed for ${bucket}:`, error);
      }
    }
  }

  async function deleteSupabaseItem(table, id) {
    if (!window.SeavSupabase) {
      throw new Error("Supabase is not available.");
    }

    const row = await fetchSupabaseRowById(table, id);
    if (row) {
      await removeStoragePaths(collectStoragePathsFromRow(table, row));
    }

    let query = window.SeavSupabase
      .from(table)
      .delete()
      .eq("id", id);

    const userId = getAuthUserId();
    if (userId) query = query.eq("user_id", userId);

    const { error } = await query;

    if (error) {
      console.error(`[SEA-V] Supabase delete failed for ${table}:`, error);
      throw error;
    }
  }

  function notifyDeleteFailure(err) {
    const message =
      window.SeavFeedback?.formatActionError?.(err, "Could not delete this record.") ||
      String(err?.message || "Could not delete this record.");
    if (window.SeavFeedback?.error) {
      window.SeavFeedback.error("Delete failed", message);
    }
  }

// dob intentionally excluded — anon no longer has SELECT on profile.dob
// (exact date of birth is an identity-theft risk and was never shown on
// the public profile UI). Requesting it here would make PostgREST reject
// the whole query for anon callers, not just omit the column.
const PUBLIC_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "name",
  "rank",
  "qualification",
  "nationality",
  "location",
  "availability",
  "bio",
  "photo",
  "public_enabled",
  "created_at",
  "updated_at"
].join(",");

/** Owner read — includes private fields; never use select("*") (blocked after column hardening). */
const OWNER_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "name",
  "rank",
  "qualification",
  "nationality",
  "dob",
  "location",
  "email",
  "phone",
  "passports_held",
  "visas_held",
  "salary",
  "availability",
  "bio",
  "photo",
  "public_enabled",
  "created_at",
  "updated_at"
].join(",");

async function fetchOwnerProfileRow(userId) {
  if (!window.SeavSupabase || !userId) return { data: null, error: null };

  const [byId, byUserId] = await Promise.all([
    window.SeavSupabase
      .from("profile")
      .select(OWNER_PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle(),
    window.SeavSupabase
      .from("profile")
      .select(OWNER_PROFILE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (byId.error) {
    console.warn("[SEA-V] Profile fetch by id failed:", byId.error.message);
  }

  if (byId.data) return byId;
  if (byUserId.data) return byUserId;
  return byId.error ? byId : byUserId;
}

const SeavAPI = {
  async getPublicProfile(profileId) {
    const client = clientForOptions({ public: true });
    if (!client || !profileId) return null;

    const baseQuery = () =>
      client
        .from("profile")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("public_enabled", true);

    let { data, error } = await baseQuery().eq("id", profileId).maybeSingle();

    if (!error && !data) {
      const byUser = await baseQuery().eq("user_id", profileId).maybeSingle();
      data = byUser.data;
      error = byUser.error;
    }

    if (error) {
      console.error("[SEA-V] Public profile fetch failed:", error);
      return null;
    }

    const profile = data ? mapProfileFromSupabase(data) : null;
    return profile ? hydrateProfilePhoto(profile, { client }) : null;
  },

  async resolvePhotoUrl(photo, bucket = STORAGE_BUCKETS.PROFILE_PHOTOS) {
    return resolveStorageFileUrl(photo, bucket);
  },

  async resolveFileUrl(fileMeta, bucket) {
    return resolveStorageFileUrl(fileMeta, bucket);
  },

  buildUploadedFileMeta(bucket, filePath, file) {
    return buildUploadedFileMeta(bucket, filePath, file);
  },

  sanitizeFileForStorage(fileMeta, bucket = null) {
    return sanitizeFileForStorage(fileMeta, bucket);
  },

  buildStoragePath(entityId, fileName) {
    if (window.SeavAuth?.buildStoragePath) {
      return window.SeavAuth.buildStoragePath(entityId, fileName);
    }
    const safeName = String(fileName || "file")
      .replace(/[^\w.\-()+ ]/g, "_")
      .slice(0, 120);
    return `${entityId}/${Date.now()}-${safeName}`;
  },

  getAuthUserId,
  resolveAuthUserId,
  async get(key, fallback = null) {
    if (isProfileKey(key)) {
      if (!window.SeavSupabase) return fallback;

      const userId = await resolveAuthUserId();
      if (!userId) return fallback;

      const { data, error } = await fetchOwnerProfileRow(userId);

      if (error) {
        console.error("[SEA-V] Supabase profile fetch failed:", error);
        if (window.SeavFeedback?.error) {
          window.SeavFeedback.error(
            "Profile did not load",
            "Run grant select on profile to authenticated in Supabase, then reload. Details: " +
              (error.message || "permission denied")
          );
        }
        return fallback;
      }

      if (!data) {
        console.warn("[SEA-V] No profile row for signed-in user — bootstrap may be needed.");
        return {
          ...(fallback || {}),
          id: userId,
          email: window.SeavAuth?.getUserEmail?.() || fallback?.email || ""
        };
      }

      const profile = mapProfileFromSupabase(data);
      if (!profile) return fallback;
      if (!bulkHydrateFiles) return profile;
      return hydrateProfilePhoto(profile);
    }

    try {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[SEA-V] Failed to read key "${key}" from storage.`, err);
      return fallback;
    }
  },

    async save(key, value) {
  if (isProfileKey(key)) {
    if (!window.SeavSupabase) return value;

    const { error } = await window.SeavSupabase
      .from("profile")
      .upsert([mapProfileToSupabase(value)]);

    if (error) {
      console.error("[SEA-V] Supabase profile save failed:", error);
      throw error;
    }

    return value;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return value;
  } catch (err) {
    console.warn(`[SEA-V] Failed to save key "${key}" to storage.`, err);
    throw err;
  }
},

    async remove(key) {
      try {
        storage.removeItem(key);
        return true;
      } catch (err) {
        console.error(`[SEA-V] Failed to remove key "${key}" from storage.`, err);
        throw err;
      }
    },

    async getArray(key) {
      const userId = await resolveAuthUserId();
      if (!userId) {
        console.warn("[SEA-V] getArray skipped — no auth session for", key);
        return [];
      }
      return fetchArrayByKey(key, userId);
    },

    async getArrayForUser(key, userId, options = {}) {
      return fetchArrayByKey(key, userId, options);
    },

    async fetchCertificateCatalog() {
      if (!window.SeavSupabase) return null;

      const { data, error } = await window.SeavSupabase
        .from("certificate_catalog")
        .select("code, name, category, is_mandatory, sort_order")
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("[SEA-V] certificate_catalog fetch failed:", error.message);
        return null;
      }

      return Array.isArray(data) && data.length ? data : null;
    },

    async upsertItemById(key, item) {
      if (!item || !item.id) {
        throw new Error("[SEA-V] upsertItemById requires an item with an id.");
      }

      if (isVesselKey(key)) {
        await upsertSupabaseItem("vessels", mapVesselToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isSeatimeKey(key)) {
        await upsertSupabaseItem("seatimes", mapSeatimeToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isCertKey(key)) {
        await upsertSupabaseItem("certificates", mapCertToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isRefKey(key)) {
        await upsertSupabaseItem("sea_references", mapRefToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isTenderKey(key)) {
        await upsertSupabaseItem("tenders", mapTenderToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isAchievementKey(key)) {
        await upsertSupabaseItem("achievements", mapAchievementToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isNavigationAreaKey(key)) {
        await upsertSupabaseItem("navigation_areas", mapNavigationAreaToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isOnboardExperienceKey(key)) {
        await upsertSupabaseItem("onboard_experiences", mapOnboardExperienceToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isHobbyInterestKey(key)) {
        await upsertSupabaseItem("hobbies_interests", mapHobbyInterestToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isSpecialistQualificationKey(key)) {
        await upsertSupabaseItem(
          "specialist_qualifications",
          mapSpecialistQualificationToSupabase(item)
        );
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      if (isPayslipKey(key)) {
        await upsertSupabaseItem("payslips", mapPayslipToSupabase(item));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, item.id);
          if (index === -1) items.unshift(item);
          else items[index] = item;
          return items;
        });
      }

      return [];
    },

    async updateItemById(key, id, updatedItem) {
      const merged = { ...updatedItem, id };

      if (isVesselKey(key)) {
        await updateSupabaseItem("vessels", id, mapVesselToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isSeatimeKey(key)) {
        await updateSupabaseItem("seatimes", id, mapSeatimeToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isCertKey(key)) {
        await updateSupabaseItem("certificates", id, mapCertToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isRefKey(key)) {
        await updateSupabaseItem("sea_references", id, mapRefToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isTenderKey(key)) {
        await updateSupabaseItem("tenders", id, mapTenderToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isAchievementKey(key)) {
        await updateSupabaseItem("achievements", id, mapAchievementToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isNavigationAreaKey(key)) {
        await updateSupabaseItem("navigation_areas", id, mapNavigationAreaToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isOnboardExperienceKey(key)) {
        await updateSupabaseItem(
          "onboard_experiences",
          id,
          mapOnboardExperienceToSupabase(merged)
        );
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isHobbyInterestKey(key)) {
        await updateSupabaseItem(
          "hobbies_interests",
          id,
          mapHobbyInterestToSupabase(merged)
        );
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isSpecialistQualificationKey(key)) {
        await updateSupabaseItem(
          "specialist_qualifications",
          id,
          mapSpecialistQualificationToSupabase(merged)
        );
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      if (isPayslipKey(key)) {
        await updateSupabaseItem("payslips", id, mapPayslipToSupabase(merged));
        return resolveArrayAfterMutation(key, (items) => {
          const index = findIndexById(items, id);
          if (index === -1) items.unshift(merged);
          else items[index] = merged;
          return items;
        });
      }

      return [];
    },

    async deleteItemById(key, id) {
      try {
        if (isVesselKey(key)) {
          await deleteSupabaseItem("vessels", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isSeatimeKey(key)) {
          await deleteSupabaseItem("seatimes", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isCertKey(key)) {
          await deleteSupabaseItem("certificates", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isRefKey(key)) {
          await deleteSupabaseItem("sea_references", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isTenderKey(key)) {
          await deleteSupabaseItem("tenders", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isAchievementKey(key)) {
          await deleteSupabaseItem("achievements", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isNavigationAreaKey(key)) {
          await deleteSupabaseItem("navigation_areas", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isOnboardExperienceKey(key)) {
          await deleteSupabaseItem("onboard_experiences", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isHobbyInterestKey(key)) {
          await deleteSupabaseItem("hobbies_interests", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isSpecialistQualificationKey(key)) {
          await deleteSupabaseItem("specialist_qualifications", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        if (isPayslipKey(key)) {
          await deleteSupabaseItem("payslips", id);
          return resolveArrayAfterMutation(key, (items) => items.filter((item) => item.id !== id));
        }

        return [];
      } catch (err) {
        notifyDeleteFailure(err);
        return resolveArrayAfterMutation(key, (items) => items);
      }
    },

    async addItem(key, item) {
      if (!item.id && window.SeavData?.createId) {
        item.id = window.SeavData.createId("item");
      }

      return await this.upsertItemById(key, item);
    },

    async updateItem(key, index, item) {
      const items = await this.getArray(key);

      if (!Array.isArray(items) || index < 0 || index >= items.length) {
        return items;
      }

      const existing = items[index];
      return await this.updateItemById(key, existing.id, { ...existing, ...item });
    },

    async deleteItem(key, index) {
      const items = await this.getArray(key);

      if (!Array.isArray(items) || index < 0 || index >= items.length) {
        return items;
      }

      return await this.deleteItemById(key, items[index].id);
    },

    setBulkHydrateFiles
  };

  
  window.SeavAPI = SeavAPI;
})();
