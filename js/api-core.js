// /js/api-core.js — storage, keys, hydration
(function () {
  "use strict";

  const C = window.SeavConfig || {};
  const SIGNED_URL_DEFAULT = C.SIGNED_URL_DEFAULT_SEC ?? 86400;
  const SIGNED_URL_SENSITIVE = C.SIGNED_URL_SENSITIVE_SEC ?? 3600;

  function signedUrlExpiry(bucket) {
    const sensitive = C.SENSITIVE_BUCKETS || new Set(["payslip-files", "certificate-files", "reference-files"]);
    return sensitive.has(bucket) ? SIGNED_URL_SENSITIVE : SIGNED_URL_DEFAULT;
  }

const storage = window.localStorage;

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

async function resolveStorageFileUrl(fileMeta, bucket, expiresIn) {
  if (expiresIn == null) expiresIn = signedUrlExpiry(bucket);
  if (!fileMeta) return "";
  if (typeof fileMeta === "string") return fileMeta.trim();
  if (fileMeta.dataUrl) return fileMeta.dataUrl;
  const storageBucket = fileMeta.bucket || bucket;
  if (fileMeta.path && window.SeavSupabase && storageBucket) {
    const { data, error } = await window.SeavSupabase.storage
      .from(storageBucket)
      .createSignedUrl(fileMeta.path, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return fileMeta.url || fileMeta.publicUrl || "";
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

async function hydrateFileMeta(fileMeta, bucket) {
  if (!fileMeta) return fileMeta;
  const url = await resolveStorageFileUrl(fileMeta, bucket);
  if (!url) return fileMeta;
  return { ...fileMeta, url };
}

async function hydrateEntityFiles(item, table) {
  if (!item) return item;
  const fields = ENTITY_FILE_FIELDS[table];
  if (!fields?.length) return item;

  const next = { ...item };
  for (const cfg of fields) {
    if (cfg.isArray) {
      const files = Array.isArray(next[cfg.field]) ? next[cfg.field] : [];
      next[cfg.field] = await Promise.all(files.map((file) => hydrateFileMeta(file, cfg.bucket)));
    } else if (next[cfg.field]) {
      next[cfg.field] = await hydrateFileMeta(next[cfg.field], cfg.bucket);
    }
  }
  return next;
}

async function hydrateArrayFiles(items, table) {
  if (!Array.isArray(items) || !items.length) return items || [];
  return Promise.all(items.map((item) => hydrateEntityFiles(item, table)));
}

async function hydrateProfilePhoto(profile) {
  if (!profile?.photo) return profile;
  const photo = await hydrateFileMeta(profile.photo, STORAGE_BUCKETS.PROFILE_PHOTOS);
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
    getAuthUserId,
    vesselKey, seatimeKey, certKey, refKey, profileKey,
    tenderKey, achievementKey, navigationAreaKey, onboardExperienceKey,
    hobbyInterestKey, specialistQualificationKey, payslipKey,
    isVesselKey, isSeatimeKey, isCertKey, isRefKey, isProfileKey,
    isTenderKey, isAchievementKey, isNavigationAreaKey, isOnboardExperienceKey,
    isHobbyInterestKey, isSpecialistQualificationKey, isPayslipKey,
    resolveStorageFileUrl, sanitizeFileForStorage, sanitizeFileArrayForStorage,
    buildUploadedFileMeta, hydrateFileMeta, hydrateEntityFiles, hydrateArrayFiles,
    hydrateProfilePhoto, sanitizePhotoForStorage, withUserId, findIndexById,
    signedUrlExpiry
  };
})();
