// /js/api-core.js — storage, keys, hydration
(function () {
  "use strict";

  const C = window.SeavConfig || {};
  const SIGNED_URL_DEFAULT = C.SIGNED_URL_DEFAULT_SEC ?? 86400;
  const SIGNED_URL_SENSITIVE = C.SIGNED_URL_SENSITIVE_SEC ?? 3600;

  function signedUrlExpiry(bucket) {
    const sensitive =
      C.SENSITIVE_BUCKETS ||
      new Set([
        "payslip-files",
        "certificate-files",
        "reference-files",
        "seatime-files",
        "vessel-documents"
      ]);
    return sensitive.has(bucket) ? SIGNED_URL_SENSITIVE : SIGNED_URL_DEFAULT;
  }

  const SIGNED_URL_CACHE_PREFIX = "seav_signed_url_v1:";

  function signedUrlCacheKey(bucket, path) {
    return `${bucket}:${path}`;
  }

  function readSignedUrlCache(bucket, path) {
    try {
      const raw = sessionStorage.getItem(SIGNED_URL_CACHE_PREFIX + signedUrlCacheKey(bucket, path));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.url || !parsed?.expiresAt) return null;
      if (Date.now() >= parsed.expiresAt - 60_000) return null;
      return parsed.url;
    } catch {
      return null;
    }
  }

  function writeSignedUrlCache(bucket, path, url, expiresInSec) {
    try {
      sessionStorage.setItem(
        SIGNED_URL_CACHE_PREFIX + signedUrlCacheKey(bucket, path),
        JSON.stringify({
          url,
          expiresAt: Date.now() + Number(expiresInSec || 0) * 1000
        })
      );
    } catch {
      // sessionStorage full or unavailable
    }
  }

  function vesselKey() {
    return window.SeavData?.KEYS?.VESSELS || "seav_vessels";
  }

  function seatimeKey() {
    return window.SeavData?.KEYS?.SEATIMES || "seav_seatimes";
  }

  function certKey() {
    return window.SeavData?.KEYS?.CERTS || "seav_certs";
  }

  function refKey() {
    return window.SeavData?.KEYS?.REFS || "seav_refs";
  }

  function isVesselKey(key) {
    return key === vesselKey();
  }

  function isSeatimeKey(key) {
    return key === seatimeKey();
  }

  function isCertKey(key) {
    return key === certKey();
  }

  function isRefKey(key) {
    return key === refKey();
  }

  function profileKey() {
  return window.SeavData?.KEYS?.PROFILE || "seav_profile";
}

function getAuthUserId() {
  return window.SeavAuth?.getUserId?.() || null;
}

async function resolveAuthUserId() {
  const cached = getAuthUserId();
  if (cached) return cached;

  if (!window.SeavSupabase) return null;

  try {
    const { data, error } = await window.SeavSupabase.auth.getSession();
    if (error) {
      console.warn("[SEA-V] Could not resolve auth session:", error);
      return null;
    }
    return data.session?.user?.id || null;
  } catch (err) {
    console.warn("[SEA-V] Session resolve failed:", err);
    return null;
  }
}

const STORAGE_BUCKETS = {
  PROFILE_PHOTOS: "profile-photos",
  VESSEL_PHOTOS: "vessel-photos",
  VESSEL_DOCUMENTS: "vessel-documents",
  CERTIFICATE_FILES: "certificate-files",
  REFERENCE_FILES: "reference-files",
  SEATIME_FILES: "seatime-files",
  ACHIEVEMENT_FILES: "achievement-files",
  TENDER_PHOTOS: "tender-photos",
  ONBOARD_EXPERIENCE_FILES: "onboard-experience-files",
  HOBBIES_INTEREST_PHOTOS: "hobbies-interest-photos",
  SPECIALIST_QUALIFICATION_FILES: "specialist-qualification-files",
  PAYSLIP_FILES: "payslip-files"
};

const ENTITY_FILE_FIELDS = {
  vessels: [
    { field: "photo", bucket: STORAGE_BUCKETS.VESSEL_PHOTOS },
    { field: "sea_attachment", bucket: STORAGE_BUCKETS.VESSEL_DOCUMENTS }
  ],
  seatimes: [{ field: "attachment", bucket: STORAGE_BUCKETS.SEATIME_FILES }],
  certificates: [{ field: "attachment", bucket: STORAGE_BUCKETS.CERTIFICATE_FILES }],
  sea_references: [{ field: "attachment", bucket: STORAGE_BUCKETS.REFERENCE_FILES }],
  tenders: [{ field: "photo", bucket: STORAGE_BUCKETS.TENDER_PHOTOS }],
  achievements: [{ field: "attachment", bucket: STORAGE_BUCKETS.ACHIEVEMENT_FILES }],
  onboard_experiences: [{ field: "attachment", bucket: STORAGE_BUCKETS.ONBOARD_EXPERIENCE_FILES }],
  hobbies_interests: [
    { field: "photos", bucket: STORAGE_BUCKETS.HOBBIES_INTEREST_PHOTOS, isArray: true }
  ],
  specialist_qualifications: [
    { field: "attachment", bucket: STORAGE_BUCKETS.SPECIALIST_QUALIFICATION_FILES }
  ],
  payslips: [{ field: "attachment", bucket: STORAGE_BUCKETS.PAYSLIP_FILES }]
};

async function resolveStorageFileUrl(fileMeta, bucket, expiresIn, clientOverride = null) {
  if (expiresIn == null) expiresIn = signedUrlExpiry(bucket);
  if (!fileMeta) return "";
  if (typeof fileMeta === "string") return fileMeta.trim();
  if (fileMeta.dataUrl) return fileMeta.dataUrl;
  if (fileMeta.url && !fileMeta.path) return fileMeta.url;
  const storageBucket = fileMeta.bucket || bucket;
  const client = clientOverride || window.SeavSupabase;
  if (fileMeta.path && client && storageBucket) {
    const cachedUrl = readSignedUrlCache(storageBucket, fileMeta.path);
    if (cachedUrl) return cachedUrl;

    const { data, error } = await client.storage
      .from(storageBucket)
      .createSignedUrl(fileMeta.path, expiresIn);
    if (!error && data?.signedUrl) {
      writeSignedUrlCache(storageBucket, fileMeta.path, data.signedUrl, expiresIn);
      return data.signedUrl;
    }
    return "";
  }
  return fileMeta.url || fileMeta.publicUrl || "";
}

function hasStoredFile(fileMeta) {
  if (!fileMeta) return false;
  if (typeof fileMeta === "string") return !!fileMeta.trim();
  return !!(fileMeta.url || fileMeta.dataUrl || fileMeta.path);
}

/** Sync display URL — uses session signed-url cache when state only has path metadata. */
function getStoredFileDisplayUrl(fileMeta, bucket = null) {
  if (!fileMeta) return "";
  if (typeof fileMeta === "string") return fileMeta.trim();
  if (fileMeta.dataUrl) return fileMeta.dataUrl;
  const storageBucket = fileMeta.bucket || bucket;
  if (fileMeta.path && storageBucket) {
    const cachedUrl = readSignedUrlCache(storageBucket, fileMeta.path);
    if (cachedUrl) return cachedUrl;
    // Path-only metadata: never reuse embedded url (often an expired signed URL).
    return "";
  }
  return fileMeta.url || fileMeta.publicUrl || "";
}

/** True when a fresh signed URL should be fetched (path present, cache miss/expired). */
function storedFileNeedsHydration(fileMeta, bucket = null) {
  if (!fileMeta) return false;
  if (typeof fileMeta === "string") return false;
  if (fileMeta.dataUrl) return false;
  if (!fileMeta.path) return false;
  const storageBucket = fileMeta.bucket || bucket;
  if (!storageBucket) return !fileMeta.url;
  if (readSignedUrlCache(storageBucket, fileMeta.path)) return false;
  return true;
}

function sanitizeFileForStorage(fileMeta, defaultBucket = null) {
  if (!fileMeta) return null;
  if (fileMeta.path) {
    return {
      path: fileMeta.path,
      bucket: fileMeta.bucket || defaultBucket,
      filename: fileMeta.filename || null,
      mime: fileMeta.mime || null,
      size: fileMeta.size || null,
      uploadedAt: fileMeta.uploadedAt || null
    };
  }
  return fileMeta;
}

function sanitizeFileArrayForStorage(files, defaultBucket = null) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => sanitizeFileForStorage(file, defaultBucket)).filter(Boolean);
}

function buildUploadedFileMeta(bucket, filePath, file) {
  return {
    bucket,
    path: filePath,
    filename: file.name,
    mime: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString()
  };
}

async function hydrateFileMeta(fileMeta, bucket, clientOverride = null) {
  if (!fileMeta) return fileMeta;
  const url = await resolveStorageFileUrl(fileMeta, bucket, null, clientOverride);
  if (!url) return fileMeta;
  return { ...fileMeta, url };
}

async function hydrateEntityFiles(item, table, options = {}) {
  if (!item) return item;
  const fields = ENTITY_FILE_FIELDS[table];
  if (!fields?.length) return item;

  const next = { ...item };
  for (const cfg of fields) {
    if (cfg.isArray) {
      const files = Array.isArray(next[cfg.field]) ? next[cfg.field] : [];
      next[cfg.field] = await Promise.all(
        files.map((file) => hydrateFileMeta(file, cfg.bucket, options.client))
      );
    } else if (next[cfg.field]) {
      next[cfg.field] = await hydrateFileMeta(next[cfg.field], cfg.bucket, options.client);
    }
  }
  return next;
}

async function hydrateArrayFiles(items, table, options = {}) {
  if (!Array.isArray(items) || !items.length) return items || [];
  if (options.skipFiles) return items;
  return Promise.all(items.map((item) => hydrateEntityFiles(item, table, options)));
}

/** Hydrate one file field on in-memory items before rendering (photos, attachments). */
async function hydrateItemsFileField(items, field, bucket, options = {}) {
  if (!Array.isArray(items) || !items.length) return items;
  const client = options.client || window.SeavSupabase;

  await Promise.all(
    items.map(async (item) => {
      if (!item) return;
      const file = item[field];
      if (!file || file.dataUrl || typeof file === "string") return;
      if (!file.path) return;

      const hasDisplayUrl = !!getStoredFileDisplayUrl(file, bucket);
      if (!storedFileNeedsHydration(file, bucket) && hasDisplayUrl) return;

      item[field] = await hydrateFileMeta(file, bucket, client);
    })
  );

  return items;
}

async function hydrateProfilePhoto(profile, options = {}) {
  if (!profile?.photo) return profile;
  const photo = await hydrateFileMeta(profile.photo, STORAGE_BUCKETS.PROFILE_PHOTOS, options.client);
  return { ...profile, photo };
}

function sanitizePhotoForStorage(photo) {
  return sanitizeFileForStorage(photo, STORAGE_BUCKETS.PROFILE_PHOTOS);
}

function withUserId(row) {
  const userId = getAuthUserId();
  if (!userId || !row || typeof row !== "object") return row;
  return { ...row, user_id: userId };
}

function isProfileKey(key) {
  return key === profileKey();
}

  function findIndexById(items, id) {
    if (!Array.isArray(items) || !id) return -1;
    return items.findIndex((item) => item && item.id === id);
  }

  function tenderKey() {
  return window.SeavData?.KEYS?.TENDERS || "seav_tenders";
}

function isTenderKey(key) {
  return key === tenderKey();
}

function achievementKey() {
  return window.SeavData?.KEYS?.ACHIEVEMENTS || "seav_achievements";
}

function isAchievementKey(key) {
  return key === achievementKey();
}

function navigationAreaKey() {

  return window.SeavData?.KEYS?.NAVIGATION_AREAS || "seav_navigation_areas";

}

function isNavigationAreaKey(key) {

  return key === navigationAreaKey();

}

function onboardExperienceKey() {
  return window.SeavData?.KEYS?.ONBOARD_EXPERIENCES || "seav_onboard_experiences";
}

function isOnboardExperienceKey(key) {
  return key === onboardExperienceKey();
}

function hobbyInterestKey() {
  return window.SeavData?.KEYS?.HOBBIES_INTERESTS || "seav_hobbies_interests";
}

function isHobbyInterestKey(key) {
  return key === hobbyInterestKey();
}

function specialistQualificationKey() {
  return window.SeavData?.KEYS?.SPECIALIST_QUALIFICATIONS || "seav_specialist_qualifications";
}

function payslipKey() {
  return window.SeavData?.KEYS?.PAYSLIPS || "seav_payslips";
}

function isSpecialistQualificationKey(key) {
  return key === specialistQualificationKey();
}

function isPayslipKey(key) {
  return key === payslipKey();
}


  window.SeavApiCore = {
    STORAGE_BUCKETS,
    ENTITY_FILE_FIELDS,
    getAuthUserId, resolveAuthUserId,
    vesselKey, seatimeKey, certKey, refKey, profileKey,
    tenderKey, achievementKey, navigationAreaKey, onboardExperienceKey,
    hobbyInterestKey, specialistQualificationKey, payslipKey,
    isVesselKey, isSeatimeKey, isCertKey, isRefKey, isProfileKey,
    isTenderKey, isAchievementKey, isNavigationAreaKey, isOnboardExperienceKey,
    isHobbyInterestKey, isSpecialistQualificationKey, isPayslipKey,
    resolveStorageFileUrl, getStoredFileDisplayUrl, storedFileNeedsHydration,
    hasStoredFile, sanitizeFileForStorage, sanitizeFileArrayForStorage,
    buildUploadedFileMeta, hydrateFileMeta, hydrateEntityFiles, hydrateArrayFiles,
    hydrateItemsFileField,
    hydrateProfilePhoto, sanitizePhotoForStorage, withUserId, findIndexById,
    signedUrlExpiry
  };
})();
