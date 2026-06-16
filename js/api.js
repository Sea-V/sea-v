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
    profileKey, vesselKey, seatimeKey, certKey, refKey,
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

  async function fetchSupabaseArray(table, mapper, orderColumn, userId) {
    if (!window.SeavSupabase) return [];

    let query = window.SeavSupabase.from(table).select("*");

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[SEA-V] Supabase fetch failed for ${table}:`, error);
      document.dispatchEvent(
        new CustomEvent("seav:fetch-error", {
          detail: { table, message: error.message || String(error) }
        })
      );
      return [];
    }

    const mapped = (data || []).map(mapper);
    if (!bulkHydrateFiles) return mapped;
    return hydrateArrayFiles(mapped, table);
  }

  async function fetchArrayByKey(key, userId) {
    if (isVesselKey(key)) {
      return await fetchSupabaseArray("vessels", mapVesselFromSupabase, "date_from", userId);
    }

    if (isSeatimeKey(key)) {
      return await fetchSupabaseArray("seatimes", mapSeatimeFromSupabase, "date_joined", userId);
    }

    if (isCertKey(key)) {
      return await fetchSupabaseArray("certificates", mapCertFromSupabase, null, userId);
    }

    if (isRefKey(key)) {
      return await fetchSupabaseArray("sea_references", mapRefFromSupabase, null, userId);
    }

    if (isTenderKey(key)) {
      return await fetchSupabaseArray("tenders", mapTenderFromSupabase, "created_at", userId);
    }

    if (isAchievementKey(key)) {
      return await fetchSupabaseArray("achievements", mapAchievementFromSupabase, "achievement_date", userId);
    }

    if (isNavigationAreaKey(key)) {
      return await fetchSupabaseArray("navigation_areas", mapNavigationAreaFromSupabase, "visited_date", userId);
    }

    if (isOnboardExperienceKey(key)) {
      return await fetchSupabaseArray("onboard_experiences", mapOnboardExperienceFromSupabase, "date_from", userId);
    }

    if (isHobbyInterestKey(key)) {
      return await fetchSupabaseArray("hobbies_interests", mapHobbyInterestFromSupabase, "date_from", userId);
    }

    if (isSpecialistQualificationKey(key)) {
      return await fetchSupabaseArray(
        "specialist_qualifications",
        mapSpecialistQualificationFromSupabase,
        "date_obtained",
        userId
      );
    }

    if (isPayslipKey(key)) {
      return await fetchSupabaseArray("payslips", mapPayslipFromSupabase, "payment_date", userId);
    }

    return [];
  }

  async function upsertSupabaseItem(table, item) {
    if (!window.SeavSupabase) {
      throw new Error("Supabase is not available.");
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

    const { error } = await window.SeavSupabase
      .from(table)
      .update(withUserId(item))
      .eq("id", id);

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

    const { data, error } = await window.SeavSupabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

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

    const { error } = await window.SeavSupabase
      .from(table)
      .delete()
      .eq("id", id);

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

const PUBLIC_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "name",
  "rank",
  "qualification",
  "nationality",
  "dob",
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

  let result = await window.SeavSupabase
    .from("profile")
    .select(OWNER_PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (!result.error && result.data) return result;

  if (result.error) {
    console.warn("[SEA-V] Profile fetch by id failed, retrying safe columns:", result.error.message);
    result = await window.SeavSupabase
      .from("profile")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    if (!result.error && result.data) return result;
  }

  const byUserId = await window.SeavSupabase
    .from("profile")
    .select(OWNER_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (!byUserId.error && byUserId.data) return byUserId;

  if (!byUserId.error && !byUserId.data) {
    const byUserSafe = await window.SeavSupabase
      .from("profile")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (!byUserSafe.error && byUserSafe.data) return byUserSafe;
  }

  return result.error ? result : byUserId;
}

const SeavAPI = {
  async getPublicProfile(profileId) {
    if (!window.SeavSupabase || !profileId) return null;

    const baseQuery = () =>
      window.SeavSupabase
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
    return profile ? hydrateProfilePhoto(profile) : null;
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

    async getArrayForUser(key, userId) {
      return fetchArrayByKey(key, userId);
    },

    async getItemById(key, id) {
      const items = await this.getArray(key);
      const index = findIndexById(items, id);
      return index === -1 ? null : items[index];
    },

    async upsertItemById(key, item) {
      if (!item || !item.id) {
        throw new Error("[SEA-V] upsertItemById requires an item with an id.");
      }

      if (isVesselKey(key)) {
        await upsertSupabaseItem("vessels", mapVesselToSupabase(item));
        return await this.getArray(key);
      }

      if (isSeatimeKey(key)) {
        await upsertSupabaseItem("seatimes", mapSeatimeToSupabase(item));
        return await this.getArray(key);
      }

      if (isCertKey(key)) {
        await upsertSupabaseItem("certificates", mapCertToSupabase(item));
        return await this.getArray(key);
      }

      if (isRefKey(key)) {
        await upsertSupabaseItem("sea_references", mapRefToSupabase(item));
        return await this.getArray(key);
      }

      if (isTenderKey(key)) {
        await upsertSupabaseItem("tenders", mapTenderToSupabase(item));
        return await this.getArray(key);
      }

      if (isAchievementKey(key)) {
        await upsertSupabaseItem("achievements", mapAchievementToSupabase(item));
        return await this.getArray(key);
      }

      if (isNavigationAreaKey(key)) {
        await upsertSupabaseItem("navigation_areas", mapNavigationAreaToSupabase(item));
        return await this.getArray(key);
      }

      if (isOnboardExperienceKey(key)) {
        await upsertSupabaseItem("onboard_experiences", mapOnboardExperienceToSupabase(item));
        return await this.getArray(key);
      }

      if (isHobbyInterestKey(key)) {
        await upsertSupabaseItem("hobbies_interests", mapHobbyInterestToSupabase(item));
        return await this.getArray(key);
      }

      if (isSpecialistQualificationKey(key)) {
        await upsertSupabaseItem(
          "specialist_qualifications",
          mapSpecialistQualificationToSupabase(item)
        );
        return await this.getArray(key);
      }

      if (isPayslipKey(key)) {
        await upsertSupabaseItem("payslips", mapPayslipToSupabase(item));
        return await this.getArray(key);
      }

      return [];
    },

    async updateItemById(key, id, updatedItem) {
      if (isVesselKey(key)) {
        await updateSupabaseItem("vessels", id, mapVesselToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isSeatimeKey(key)) {
        await updateSupabaseItem("seatimes", id, mapSeatimeToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isCertKey(key)) {
        await updateSupabaseItem("certificates", id, mapCertToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isRefKey(key)) {
        await updateSupabaseItem("sea_references", id, mapRefToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isTenderKey(key)) {
        await updateSupabaseItem("tenders", id, mapTenderToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isAchievementKey(key)) {
        await updateSupabaseItem("achievements", id, mapAchievementToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isNavigationAreaKey(key)) {
        await updateSupabaseItem("navigation_areas", id, mapNavigationAreaToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      if (isOnboardExperienceKey(key)) {
        await updateSupabaseItem(
          "onboard_experiences",
          id,
          mapOnboardExperienceToSupabase({ ...updatedItem, id })
        );
        return await this.getArray(key);
      }

      if (isHobbyInterestKey(key)) {
        await updateSupabaseItem(
          "hobbies_interests",
          id,
          mapHobbyInterestToSupabase({ ...updatedItem, id })
        );
        return await this.getArray(key);
      }

      if (isSpecialistQualificationKey(key)) {
        await updateSupabaseItem(
          "specialist_qualifications",
          id,
          mapSpecialistQualificationToSupabase({ ...updatedItem, id })
        );
        return await this.getArray(key);
      }

      if (isPayslipKey(key)) {
        await updateSupabaseItem("payslips", id, mapPayslipToSupabase({ ...updatedItem, id }));
        return await this.getArray(key);
      }

      return [];
    },

    async deleteItemById(key, id) {
      try {
        if (isVesselKey(key)) {
          await deleteSupabaseItem("vessels", id);
          return await this.getArray(key);
        }

        if (isSeatimeKey(key)) {
          await deleteSupabaseItem("seatimes", id);
          return await this.getArray(key);
        }

        if (isCertKey(key)) {
          await deleteSupabaseItem("certificates", id);
          return await this.getArray(key);
        }

        if (isRefKey(key)) {
          await deleteSupabaseItem("sea_references", id);
          return await this.getArray(key);
        }

        if (isTenderKey(key)) {
          await deleteSupabaseItem("tenders", id);
          return await this.getArray(key);
        }

        if (isAchievementKey(key)) {
          await deleteSupabaseItem("achievements", id);
          return await this.getArray(key);
        }

        if (isNavigationAreaKey(key)) {
          await deleteSupabaseItem("navigation_areas", id);
          return await this.getArray(key);
        }

        if (isOnboardExperienceKey(key)) {
          await deleteSupabaseItem("onboard_experiences", id);
          return await this.getArray(key);
        }

        if (isHobbyInterestKey(key)) {
          await deleteSupabaseItem("hobbies_interests", id);
          return await this.getArray(key);
        }

        if (isSpecialistQualificationKey(key)) {
          await deleteSupabaseItem("specialist_qualifications", id);
          return await this.getArray(key);
        }

        if (isPayslipKey(key)) {
          await deleteSupabaseItem("payslips", id);
          return await this.getArray(key);
        }

        return [];
      } catch (err) {
        notifyDeleteFailure(err);
        return await this.getArray(key);
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
