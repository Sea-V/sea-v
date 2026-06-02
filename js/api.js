// /js/api.js
(function () {
  "use strict";

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

async function resolveStorageFileUrl(fileMeta, bucket, expiresIn = 86400) {
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

function readPublicEnabledFromRow(p) {
  if (!p || typeof p !== "object") return false;

  const value = p.public_enabled ?? p.is_public ?? p.publicEnabled;

  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;

  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "t" || text === "yes" || text === "1";
}

function mapProfileFromSupabase(p) {
  return {
    id: p.id,
    name: p.name || "",
    rank: p.rank || "",
    qualification: p.qualification || "",
    nationality: p.nationality || "",
    dob: p.dob || "",
    location: p.location || "",
    email: p.email || "",
    phone: p.phone || "",
    passportsHeld: p.passports_held || "",
    visasHeld: p.visas_held || "",
    salary: p.salary || "",
    availability: p.availability || "",
    bio: p.bio || "",
    photo: p.photo || null,
    publicEnabled: readPublicEnabledFromRow(p),
    createdAt: p.created_at || "",
    updatedAt: p.updated_at || ""
  };
}

function mapProfileToSupabase(item) {
  const userId = getAuthUserId() || item.id;
  return {
    id: userId || item.id || "default-profile",
    user_id: userId || item.user_id || item.id || null,
    name: item.name || "",
    rank: item.rank || "",
    qualification: item.qualification || "",
    nationality: item.nationality || "",
    dob: item.dob || "",
    location: item.location || "",
    email: item.email || "",
    phone: item.phone || "",
    passports_held: item.passportsHeld || "",
    visas_held: item.visasHeld || "",
    salary: item.salary || "",
    availability: item.availability || "",
    bio: item.bio || "",
    photo: sanitizePhotoForStorage(item.photo),
    public_enabled: !!item.publicEnabled,
    updated_at: new Date().toISOString()
  };
}

  function mapVesselFromSupabase(v) {
  return {
    id: v.id,
    name: v.name || "",
    flag: v.flag || "",
    gt: v.gt || "",

    vessel_length: v.vessel_length || "",
    builder: v.builder || "",

    vessel_role: v.vessel_role || "",
    vessel_type: v.vessel_type || "",

    program: v.program || "",

    experience_onboard: v.experience_onboard || "",

    from: v.date_from || "",
    to: v.date_to || "",

    photo: v.photo || null,

    sea_attachment: v.sea_attachment || null,

    createdAt: v.created_at || "",
    updatedAt: v.updated_at || ""
  };
}

function mapVesselToSupabase(item) {
  return {
    id: item.id,
    name: item.name || "",
    flag: item.flag || "",
    gt: item.gt || "",
    vessel_length: item.vessel_length || item.length || "",
    builder: item.builder || "",
    vessel_role: item.vessel_role || item.role || "",
    vessel_type: item.vessel_type || item.type || "",
    program: item.program || "",
    experience_onboard: item.experience_onboard || item.desc || "",
    date_from: item.from || item.date_from || "",
    date_to: item.to || item.date_to || "",
    photo: sanitizeFileForStorage(item.photo, STORAGE_BUCKETS.VESSEL_PHOTOS),
    sea_attachment: sanitizeFileForStorage(
      item.sea_attachment || item.seaAttachment,
      STORAGE_BUCKETS.VESSEL_DOCUMENTS
    ),
    updated_at: new Date().toISOString()
  };
}

  function mapSeatimeFromSupabase(s) {
    return {
      id: s.id,
      vesselId: s.vessel_id || "",
      flag: s.flag || "",
      gt: s.gt || "",
      imoOfficialNumber: s.imo_official_number || "",
      capacityServed: s.capacity_served || "",
      dateJoined: s.date_joined || "",
      dateLeft: s.date_left || "",
      actualSeaServiceDays: Number(s.actual_sea_service_days || 0),
      standbyServiceDays: Number(s.standby_service_days || 0),
      yardServiceDays: Number(s.yard_service_days || 0),
      watchkeepingDays: Number(s.watchkeeping_days || 0),
      verificationStatus: s.verification_status || "Logged",
      notes: s.notes || "",
      attachment: s.attachment || null,
      createdAt: s.created_at || "",
      updatedAt: s.updated_at || ""
    };
  }

  function mapSeatimeToSupabase(item) {
    return {
      id: item.id,
      vessel_id: item.vesselId || null,
      flag: item.flag || "",
      gt: item.gt || "",
      imo_official_number: item.imoOfficialNumber || "",
      capacity_served: item.capacityServed || "",
      date_joined: item.dateJoined || "",
      date_left: item.dateLeft || "",
      actual_sea_service_days: Number(item.actualSeaServiceDays || 0),
      standby_service_days: Number(item.standbyServiceDays || 0),
      yard_service_days: Number(item.yardServiceDays || 0),
      watchkeeping_days: Number(item.watchkeepingDays || 0),
      verification_status: item.verificationStatus || "Logged",
      notes: item.notes || "",
      attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.SEATIME_FILES),
      updated_at: new Date().toISOString()
    };
  }

  function mapCertFromSupabase(c) {
    return {
      id: c.id,
      code: c.code || "",
      name: c.name || "",
      expiry: c.expiry_date || "",
      status: c.status || "",
      attachment: c.attachment || null,
      isMandatory: !!c.is_mandatory,
      isTemplate: !!c.is_template,
      createdAt: c.created_at || "",
      updatedAt: c.updated_at || ""
    };
  }

  function mapCertToSupabase(item) {
    return {
      id: item.id,
      code: item.code || "",
      name: item.name || "",
      expiry_date: item.expiry || "",
      status: item.status || "",
      attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.CERTIFICATE_FILES),
      is_mandatory: !!item.isMandatory,
      is_template: !!item.isTemplate,
      updated_at: new Date().toISOString()
    };
  }

  function mapRefFromSupabase(r) {
    return {
      id: r.id,
      name: r.name || "",
      title: r.title || "",
      email: r.email || "",
      vesselId: r.vessel_id || "",
      role: r.role || "",
      period: r.period || "",
      text: r.reference_text || "",
      date: r.reference_date || "",
      status: r.status || "Draft",
      attachment: r.attachment || null,
      verification: r.verification || null,
      createdAt: r.created_at || "",
      updatedAt: r.updated_at || ""
    };
  }

  function mapRefToSupabase(item) {
    return {
      id: item.id,
      name: item.name || "",
      title: item.title || "",
      email: item.email || "",
      vessel_id: item.vesselId || null,
      role: item.role || "",
      period: item.period || "",
      reference_text: item.text || "",
      reference_date: item.date || "",
      status: item.status || "Draft",
      attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.REFERENCE_FILES),
      verification: item.verification || null,
      updated_at: new Date().toISOString()
    };
  }

  function mapTenderFromSupabase(t) {
  return {
    id: t.id,
    name: t.name || "",
    vesselId: t.vessel_id || "",
    type: t.type || "",
    model: t.model || "",
    length: t.length || "",
    engine: t.engine || "",
    capacity: t.capacity || "",
    reg: t.reg || "",
    desc: t.description || "",
    photo: t.photo || null,
    createdAt: t.created_at || "",
    updatedAt: t.updated_at || ""
  };
}

function mapTenderToSupabase(item) {
  return {
    id: item.id,
    name: item.name || "",
    vessel_id: item.vesselId || null,
    type: item.type || "",
    model: item.model || "",
    length: item.length || "",
    engine: item.engine || "",
    capacity: item.capacity || "",
    reg: item.reg || "",
    description: item.desc || "",
    photo: sanitizeFileForStorage(item.photo, STORAGE_BUCKETS.TENDER_PHOTOS),
    updated_at: new Date().toISOString()
  };
}

function mapAchievementFromSupabase(a) {
  return {
    id: a.id,
    code: a.code || "",
    title: a.title || "",
    category: a.category || "",
    dashboardSection: a.dashboard_section || "",
    badgeKey: a.badge_key || "",
    badgeFileName: a.badge_file_name || "",
    badgeTier: a.badge_tier || "",
    badgeLabel: a.badge_label || "",
    badgeImage: a.badge_image || "",
    badgeLockedImage: a.badge_locked_image || "",
    vesselId: a.vessel_id || "",
    vessel: a.vessel || "",
    date: a.achievement_date || "",
    status: a.status || "Draft",
    witnessName: a.witness_name || "",
    witnessPosition: a.witness_position || "",
    witnessEmail: a.witness_email || "",
    witnessCocNumber: a.witness_coc_number || "",
    description: a.description || "",
    attachment: a.attachment || null,
    autoAwarded: !!a.auto_awarded,
    createdAt: a.created_at || "",
    updatedAt: a.updated_at || ""
  };
}

function mapAchievementToSupabase(item) {
  return {
    id: item.id,
    code: item.code || "",
    title: item.title || "",
    category: item.category || "",
    dashboard_section: item.dashboardSection || "",
    badge_key: item.badgeKey || "",
    badge_file_name: item.badgeFileName || "",
    badge_tier: item.badgeTier || "",
    badge_label: item.badgeLabel || "",
    badge_image: item.badgeImage || "",
    badge_locked_image: item.badgeLockedImage || "",
    vessel_id: item.vesselId || null,
    vessel: item.vessel || "",
    achievement_date: item.date || "",
    status: item.status || "Draft",
    witness_name: item.witnessName || "",
    witness_position: item.witnessPosition || "",
    witness_email: item.witnessEmail || "",
    witness_coc_number: item.witnessCocNumber || "",
    description: item.description || "",
    attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.ACHIEVEMENT_FILES),
    auto_awarded: !!item.autoAwarded,
    updated_at: new Date().toISOString()
  };
}

function mapNavigationAreaFromSupabase(n) {
  const toCountry = n.to_country || n.country || "";
  const toPort = n.to_port || n.port || "";
  const toLat = Number(n.to_lat ?? n.lat ?? 0);
  const toLng = Number(n.to_lng ?? n.lng ?? 0);

  return {
    id: n.id,
    country: toCountry,
    port: toPort,
    fromCountry: n.from_country || "",
    fromPort: n.from_port || "",
    fromLat: Number(n.from_lat || 0),
    fromLng: Number(n.from_lng || 0),
    toCountry,
    toPort,
    toLat,
    toLng,
    vesselId: n.vessel_id || "",
    seatimeId: n.seatime_id || "",
    operationType: n.operation_type || "",
    passageName: n.passage_name || "",
    visitedDate: n.visited_date || "",
    departureDate: n.departure_date || n.visited_date || "",
    arrivalDate: n.arrival_date || "",
    lat: toLat,
    lng: toLng,
    waypoints: normalizeWaypoints(n.waypoints),
    note: n.note || "",
    createdAt: n.created_at || "",
    updatedAt: n.updated_at || ""
  };
}

function normalizeWaypoints(value) {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (error) {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((wp) => ({
      lat: Number(wp?.lat),
      lng: Number(wp?.lng),
      label: wp?.label ? String(wp.label) : ""
    }))
    .filter((wp) => Number.isFinite(wp.lat) && Number.isFinite(wp.lng));
}

function mapNavigationAreaToSupabase(item) {
  const toCountry = item.toCountry || item.country || "";
  const toPort = item.toPort || item.port || "";
  const toLat = Number(item.toLat ?? item.lat ?? 0);
  const toLng = Number(item.toLng ?? item.lng ?? 0);

  const payload = {
    id: item.id,
    country: toCountry,
    port: toPort,
    from_country: item.fromCountry || "",
    from_port: item.fromPort || "",
    from_lat: Number(item.fromLat || 0),
    from_lng: Number(item.fromLng || 0),
    to_country: toCountry,
    to_port: toPort,
    to_lat: toLat,
    to_lng: toLng,
    vessel_id: item.vesselId || null,
    operation_type: item.operationType || "",
    passage_name: item.passageName || "",
    visited_date: item.visitedDate || item.departureDate || item.arrivalDate || null,
    departure_date: item.departureDate || null,
    arrival_date: item.arrivalDate || null,
    lat: toLat,
    lng: toLng,
    waypoints: normalizeWaypoints(item.waypoints),
    note: item.note || "",
    updated_at: new Date().toISOString()
  };

  if (item.seatimeId) {
    payload.seatime_id = item.seatimeId;
  }

  return payload;
}

function mapSignoffFromSupabase(signoff) {
  const s = signoff || {};
  return {
    confirmed: !!s.confirmed,
    note: s.note || "",
    signatoryName: s.signatory_name || s.signatoryName || "",
    signatoryRank: s.signatory_rank || s.signatoryRank || "",
    signatoryEmail: s.signatory_email || s.signatoryEmail || "",
    cocNumber: s.coc_number || s.cocNumber || "",
    signatureName: s.signature_name || s.signatureName || "",
    signedAt: s.signed_at || s.signedAt || ""
  };
}

function mapSignoffToSupabase(signoff) {
  const s = signoff || {};
  return {
    confirmed: !!s.confirmed,
    note: s.note || "",
    signatory_name: s.signatoryName || "",
    signatory_rank: s.signatoryRank || "",
    signatory_email: s.signatoryEmail || "",
    coc_number: s.cocNumber || "",
    signature_name: s.signatureName || "",
    signed_at: s.signedAt || ""
  };
}

function mapOnboardExperienceFromSupabase(row) {
  return {
    id: row.id,
    vesselId: row.vessel_id || "",
    category: row.category || "",
    title: row.title || "",
    description: row.description || "",
    locationOnboard: row.location_onboard || "",
    dateFrom: row.date_from || "",
    dateTo: row.date_to || "",
    hours: Number(row.hours || 0),
    isFamiliarisation: !!row.is_familiarisation,
    status: row.status || "Draft",
    signoff: mapSignoffFromSupabase(row.signoff),
    attachment: row.attachment || null,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapOnboardExperienceToSupabase(item) {
  return {
    id: item.id,
    vessel_id: item.vesselId || null,
    category: item.category || "",
    title: item.title || "",
    description: item.description || "",
    location_onboard: item.locationOnboard || "",
    date_from: item.dateFrom || "",
    date_to: item.dateTo || "",
    hours: Number(item.hours || 0),
    is_familiarisation: !!item.isFamiliarisation,
    status: item.status || "Draft",
    signoff: mapSignoffToSupabase(item.signoff),
    attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.ONBOARD_EXPERIENCE_FILES),
    updated_at: new Date().toISOString()
  };
}

function mapHobbyInterestFromSupabase(row) {
  return {
    id: row.id,
    category: row.category || "",
    title: row.title || "",
    description: row.description || "",
    dateFrom: row.date_from || "",
    dateTo: row.date_to || "",
    status: row.status || "Published",
    photos: Array.isArray(row.photos) ? row.photos : [],
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapHobbyInterestToSupabase(item) {
  return {
    id: item.id,
    category: item.category || "",
    title: item.title || "",
    description: item.description || "",
    date_from: item.dateFrom || null,
    date_to: item.dateTo || null,
    status: item.status || "Published",
    photos: sanitizeFileArrayForStorage(item.photos, STORAGE_BUCKETS.HOBBIES_INTEREST_PHOTOS),
    updated_at: new Date().toISOString()
  };
}

function mapSpecialistQualificationFromSupabase(row) {
  return {
    id: row.id,
    category: row.category || "",
    title: row.title || "",
    issuingBody: row.issuing_body || "",
    dateObtained: row.date_obtained || "",
    expiry: row.expiry || "",
    status: row.status || "Self-declared",
    notes: row.notes || "",
    attachment: row.attachment || null,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapSpecialistQualificationToSupabase(item) {
  return {
    id: item.id,
    category: item.category || "",
    title: item.title || "",
    issuing_body: item.issuingBody || "",
    date_obtained: item.dateObtained || null,
    expiry: item.expiry || null,
    status: item.status || "Self-declared",
    notes: item.notes || "",
    attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.SPECIALIST_QUALIFICATION_FILES),
    updated_at: new Date().toISOString()
  };
}

function mapPayslipFromSupabase(row) {
  return {
    id: row.id,
    taxYear: row.tax_year || "",
    payPeriod: row.pay_period || "",
    paymentDate: row.payment_date || "",
    employer: row.employer || "",
    vesselId: row.vessel_id || "",
    grossAmount: row.gross_amount ?? "",
    netAmount: row.net_amount ?? "",
    currency: row.currency || "GBP",
    notes: row.notes || "",
    attachment: row.attachment || null,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapPayslipToSupabase(item) {
  return {
    id: item.id,
    tax_year: item.taxYear || "",
    pay_period: item.payPeriod || "",
    payment_date: item.paymentDate || null,
    employer: item.employer || "",
    vessel_id: item.vesselId || null,
    gross_amount:
      item.grossAmount === "" || item.grossAmount == null
        ? null
        : Number(item.grossAmount),
    net_amount:
      item.netAmount === "" || item.netAmount == null ? null : Number(item.netAmount),
    currency: item.currency || "GBP",
    notes: item.notes || "",
    attachment: sanitizeFileForStorage(item.attachment, STORAGE_BUCKETS.PAYSLIP_FILES),
    updated_at: new Date().toISOString()
  };
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
      return [];
    }

    return hydrateArrayFiles((data || []).map(mapper), table);
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

const SeavAPI = {
  async getPublicProfile(profileId) {
    if (!window.SeavSupabase || !profileId) return null;

    const { data, error } = await window.SeavSupabase
      .from("profile")
      .select("*")
      .eq("id", profileId)
      .eq("public_enabled", true)
      .maybeSingle();

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
  async get(key, fallback = null) {
    if (isProfileKey(key)) {
      if (!window.SeavSupabase) return fallback;

      const userId = getAuthUserId();
      if (!userId) return fallback;

      const { data, error } = await window.SeavSupabase
        .from("profile")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[SEA-V] Supabase profile fetch failed:", error);
        return fallback;
      }

      const profile = data ? mapProfileFromSupabase(data) : fallback;
      return profile ? hydrateProfilePhoto(profile) : fallback;
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
      return fetchArrayByKey(key);
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
    }
  };

  window.SeavAPI = SeavAPI;
})();