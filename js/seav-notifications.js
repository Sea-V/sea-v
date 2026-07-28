// /js/seav-notifications.js — topbar notification bell.
//
// Scope for now: certificate expiry warnings only (mirrors the same 90-day
// threshold used on the Certificates page and Dashboard widget — see
// SeavData.isCertExpiringOrExpired / getCertExpiryInfo).
//
// Built as a list of small "producer" functions rather than one block of
// logic so more event types (badge unlocks, reference verified/declined,
// etc.) can be added later by just adding another producer to PRODUCERS —
// nothing else about the bell needs to change.
//
// There's no backend push/event log in SEA-V (no cron, no Supabase Realtime
// subscriptions anywhere in this codebase) — every producer recomputes its
// items from whatever's already in window.SeavState each time the bell
// renders, the same way the rest of the app derives "current status" from
// data on every page load. "Unread" is tracked client-side only (a set of
// seen notification ids in localStorage, scoped per user) since there's no
// server-side record of a notification ever being created in the first
// place — only of the certificate row it's computed from.
(function () {
  "use strict";

  if (!window.Seav || !window.SeavState || !window.SeavData) return;

  const Seav = window.Seav;
  const SEEN_KEY_PREFIX = "seav_notif_seen_v1_";

  function getUserId() {
    return window.SeavAuth?.getUserId?.() || window.SeavState?.profile?.id || "";
  }

  function seenStorageKey() {
    const userId = getUserId();
    return userId ? `${SEEN_KEY_PREFIX}${userId}` : null;
  }

  function readSeenIds() {
    const key = seenStorageKey();
    if (!key) return new Set();
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  function writeSeenIds(ids) {
    const key = seenStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {
      // Storage full/unavailable — read state just won't persist, not fatal.
    }
  }

  // --- Producers ---------------------------------------------------------
  // Each producer returns { id, severity, title, message, link }[].
  // `id` must be stable but change if the underlying fact changes (here:
  // includes the expiry date) so an edited record counts as "new" again.

  function certExpiryProducer() {
    const D = window.SeavData;
    const certs = (window.SeavState?.certs || []).filter(
      (c) => D.isSavedCert?.(c) ?? !!c?.name
    );

    return certs
      .filter((cert) => {
        if (D.isCertNoExpiry?.(cert) || !cert.expiry) return false;
        return D.isCertExpiringOrExpired?.(cert) ?? false;
      })
      .map((cert) => {
        const info = D.getCertExpiryInfo(cert.expiry);
        const expired = String(info.statusClass || "").includes("expired");
        return {
          id: `cert-expiry:${cert.id}:${cert.expiry}`,
          severity: expired ? "critical" : "warning",
          title: cert.name || "Certificate",
          message: info.label || info.badge || "",
          link: "certificates.html"
        };
      });
  }

  const PRODUCERS = [certExpiryProducer];

  function getAllNotifications() {
    return PRODUCERS.flatMap((fn) => {
      try {
        return fn() || [];
      } catch (err) {
        console.error("[SEA-V] Notification producer failed:", err);
        return [];
      }
    });
  }

  // --- Rendering -----------------------------------------------------

  let lastItems = [];

  function render() {
    const btn = document.getElementById("notifBellBtn");
    const countEl = document.getElementById("notifBellCount");
    const panel = document.getElementById("notifBellPanel");
    const list = document.getElementById("notifBellPanelList");
    if (!btn || !panel || !list) return;

    const items = getAllNotifications();
    lastItems = items;

    const seen = readSeenIds();
    const unread = items.filter((item) => !seen.has(item.id));

    if (countEl) {
      countEl.hidden = unread.length === 0;
      countEl.textContent = unread.length > 9 ? "9+" : String(unread.length);
    }
    btn.classList.toggle("has-unread", unread.length > 0);

    list.innerHTML = items.length
      ? items
          .map((item) => {
            const pillClass = item.severity === "critical" ? "pill-expired" : "pill-warning";
            return `
        <a class="notif-item" href="${Seav.escapeHtml(item.link)}">
          <span class="notif-item-title">${Seav.escapeHtml(item.title)}</span>
          <span class="pill ${pillClass}">${Seav.escapeHtml(item.message)}</span>
        </a>
      `;
          })
          .join("")
      : `<p class="notif-empty">No notifications right now.</p>`;
  }

  function markAllSeen() {
    const seen = readSeenIds();
    lastItems.forEach((item) => seen.add(item.id));
    writeSeenIds(seen);
    render();
  }

  function togglePanel(forceOpen) {
    const panel = document.getElementById("notifBellPanel");
    const btn = document.getElementById("notifBellBtn");
    if (!panel || !btn) return;

    const willOpen = forceOpen ?? panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (willOpen) {
      // Slight delay so the unread count/highlight is visible for a beat
      // before it clears, rather than vanishing the instant you open it.
      window.setTimeout(markAllSeen, 500);
    }
  }

  function init() {
    const btn = document.getElementById("notifBellBtn");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    document.addEventListener("click", (e) => {
      const panel = document.getElementById("notifBellPanel");
      if (!panel || panel.hidden) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      togglePanel(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") togglePanel(false);
    });

    Seav.bindStateRefresh(render, { label: "Notifications" });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
