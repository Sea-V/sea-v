// /js/api-mappers.js — Supabase row mappers
(function () {
  "use strict";

  const {
    STORAGE_BUCKETS, getAuthUserId, sanitizeFileForStorage, sanitizeFileArrayForStorage,
    sanitizePhotoForStorage
  } = window.SeavApiCore;

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
    userId: p.user_id || p.userId || null,
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

  function parseJsonField(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function mapCertFromSupabase(c) {
    return {
      id: c.id,
      code: c.code || "",
      name: c.name || "",
      expiry: c.expiry_date || "",
      status: c.status || "",
      attachment: parseJsonField(c.attachment),
      isMandatory: !!c.is_mandatory,
      isTemplate: !!c.is_template,
      noExpiry: !c.expiry_date,
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
    proficiencyLevel: t.proficiency_level || "",
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
    proficiency_level: item.proficiencyLevel || "",
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
    date_from: item.dateFrom || null,
    date_to: item.dateTo || null,
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


  window.SeavApiMappers = {
    readPublicEnabledFromRow,
    mapProfileFromSupabase, mapProfileToSupabase,
    mapVesselFromSupabase, mapVesselToSupabase,
    mapSeatimeFromSupabase, mapSeatimeToSupabase,
    mapCertFromSupabase, mapCertToSupabase,
    mapRefFromSupabase, mapRefToSupabase,
    mapTenderFromSupabase, mapTenderToSupabase,
    mapAchievementFromSupabase, mapAchievementToSupabase,
    mapNavigationAreaFromSupabase, mapNavigationAreaToSupabase, normalizeWaypoints,
    mapSignoffFromSupabase, mapSignoffToSupabase,
    mapOnboardExperienceFromSupabase, mapOnboardExperienceToSupabase,
    mapHobbyInterestFromSupabase, mapHobbyInterestToSupabase,
    mapSpecialistQualificationFromSupabase, mapSpecialistQualificationToSupabase,
    mapPayslipFromSupabase, mapPayslipToSupabase
  };
})();
