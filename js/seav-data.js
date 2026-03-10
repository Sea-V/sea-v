// /js/seav-data.js
(function () {
  "use strict";

  function toNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function totalQualifyingDays(entry) {
    return (
      toNumber(entry.actualSeaServiceDays) +
      toNumber(entry.standbyServiceDays) +
      toNumber(entry.yardServiceDays) +
      toNumber(entry.watchkeepingDays)
    );
  }

  function getSeatimeTotals(entries) {
    const totals = {
      sea: 0,
      standby: 0,
      yard: 0,
      watchkeeping: 0,
      total: 0
    };

    (entries || []).forEach((entry) => {
      totals.sea += toNumber(entry.actualSeaServiceDays);
      totals.standby += toNumber(entry.standbyServiceDays);
      totals.yard += toNumber(entry.yardServiceDays);
      totals.watchkeeping += toNumber(entry.watchkeepingDays);
    });

    totals.total =
      totals.sea +
      totals.standby +
      totals.yard +
      totals.watchkeeping;

    return totals;
  }

  function getCertExpiryInfo(expiry) {
    if (!expiry) {
      return {
        label: "No Expiry",
        badge: "No Expiry",
        sortValue: 999999,
        statusClass: "pill"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);

    const diffMs = exp - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: "Expired",
        badge: "Expired",
        sortValue: diffDays,
        statusClass: "pill"
      };
    }

    if (diffDays <= 60) {
      return {
        label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
        badge: "Expires Soon",
        sortValue: diffDays,
        statusClass: "pill"
      };
    }

    return {
      label: `Valid for ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      badge: "Valid",
      sortValue: diffDays,
      statusClass: "pill"
    };
  }

  function getCurrentVesselIndex(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return -1;

    let currentIndex = vessels.findIndex((v) => !v.to || !String(v.to).trim());

    if (currentIndex !== -1) return currentIndex;

    currentIndex = vessels.reduce((latestIdx, vessel, idx, arr) => {
      const currentDate = vessel.to ? new Date(vessel.to) : new Date(0);
      const latestDate = arr[latestIdx].to ? new Date(arr[latestIdx].to) : new Date(0);
      return currentDate > latestDate ? idx : latestIdx;
    }, 0);

    return currentIndex;
  }

  function getVesselHistory(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return [];

    const currentIndex = getCurrentVesselIndex(vessels);

    return vessels
      .map((v, idx) => ({ ...v, _originalIndex: idx }))
      .filter((_, idx) => idx !== currentIndex)
      .sort((a, b) => {
        const da = a.from ? new Date(a.from) : new Date(0);
        const db = b.from ? new Date(b.from) : new Date(0);
        return db - da;
      });
  }

  function getReferenceStatus(ref) {
    if (!ref) return "Draft";
    return ref.status || ref.verified || "Draft";
  }

  window.SeavData = {
    toNumber,
    totalQualifyingDays,
    getSeatimeTotals,
    getCertExpiryInfo,
    getCurrentVesselIndex,
    getVesselHistory,
    getReferenceStatus
  };
})();