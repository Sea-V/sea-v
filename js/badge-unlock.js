// /js/badge-unlock.js
(function () {
  "use strict";

  const STORAGE_KEY = "seav_celebrated_badge_codes";
  const OPEN_DELAY_MS = 550;
  const CLOSE_ANIM_MS = 550;

  const queue = [];
  const shownThisSession = new Set();
  let showing = false;
  let overlayEl = null;
  let openTimer = null;
  let currentItem = null;

  function storageKey() {
    const userId = window.SeavAuth?.getUserId?.();
    return userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
  }

  function getCelebratedCodes() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function markCelebrated(code) {
    if (!code) return;
    const codes = getCelebratedCodes();
    if (codes.includes(code)) return;
    codes.push(code);
    localStorage.setItem(storageKey(), JSON.stringify(codes));
  }

  function formatTier(tier) {
    const value = String(tier || "default").trim();
    if (!value || value === "default") return "Milestone";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function buildPayload(achievement) {
    const definition = window.SeavBadges?.getAchievementWithBadge?.(achievement?.code);
    const badge = definition?.badge || {};

    return {
      code: achievement?.code || definition?.code || "",
      title: achievement?.title || definition?.title || badge.label || "New badge",
      tier: achievement?.badgeTier || badge.tier || "default",
      category: achievement?.category || definition?.category || "",
      description:
        achievement?.description ||
        definition?.description ||
        "You reached a new milestone in your SEA-V career.",
      image:
        window.SeavBadges?.resolveItemBadgeImage?.({
          ...achievement,
          status: "Verified"
        }) ||
        badge.image ||
        window.SeavBadges?.resolveBadgeImage?.(
          achievement?.badgeKey || definition?.badgeKey,
          true
        ) ||
        window.SeavBadges?.DEFAULT_IMAGE ||
        ""
    };
  }

  // 2026-08-05, per Jack: reworked to match the site's new minimal
  // approach — everything (badge, title, tier, description) shows at once
  // on open, no artificial "wait, then click to reveal why you earned
  // this, then wait again for a Continue button" staging. One entrance
  // animation, one close, done. Also dropped the pulsing glow ring/blob —
  // Jack's site-wide no-glow rule.
  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.className = "badge-unlock-overlay";
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.innerHTML = `
      <div class="badge-unlock-backdrop" data-badge-unlock-action="dismiss" aria-hidden="true"></div>
      <div
        class="badge-unlock-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badgeUnlockTitle"
        tabindex="-1"
      >
        <button type="button" class="modal-x badge-unlock-close" data-badge-unlock-action="dismiss" aria-label="Close">&times;</button>

        <p class="badge-unlock-kicker">Milestone unlocked</p>

        <div class="badge-unlock-badge-stage">
          <div class="badge-unlock-badge-ring" aria-hidden="true"></div>
          <img
            class="badge-unlock-badge-image"
            alt=""
            width="80"
            height="80"
            decoding="async"
          />
        </div>

        <h2 class="badge-unlock-heading" id="badgeUnlockTitle"></h2>
        <span class="badge-unlock-tier-pill"></span>
        <p class="badge-unlock-desc"></p>

        <div class="badge-unlock-actions">
          <button
            type="button"
            class="badge-unlock-share-btn"
            data-badge-unlock-action="share"
          >
            Share this badge
          </button>
          <button
            type="button"
            class="badge-unlock-cta badge-unlock-cta--primary"
            data-badge-unlock-action="dismiss"
          >
            Continue
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-badge-unlock-action]");
      if (!actionBtn) return;

      const action = actionBtn.getAttribute("data-badge-unlock-action");

      if (action === "share") {
        shareCurrent(actionBtn);
        return;
      }

      if (action === "dismiss") {
        closeCurrent();
      }
    });

    return overlayEl;
  }

  async function shareCurrent(button) {
    if (!currentItem || !window.SeavShare) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing image…";

    try {
      await window.SeavShare.shareBadge(currentItem);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function renderModal(item) {
    currentItem = item;

    const overlay = ensureOverlay();
    const card = overlay.querySelector(".badge-unlock-card");
    if (!card) return;

    const tierClass = String(item.tier || "default")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");

    card.className = `badge-unlock-card is-entering tier-${tierClass}`;
    card.dataset.tier = item.tier || "default";
    card.dataset.unlockCode = item.code;

    const imageEl = card.querySelector(".badge-unlock-badge-image");
    const headingEl = card.querySelector(".badge-unlock-heading");
    const tierEl = card.querySelector(".badge-unlock-tier-pill");
    const descEl = card.querySelector(".badge-unlock-desc");

    if (imageEl) {
      imageEl.src = item.image;
      imageEl.alt = item.title;
    }
    if (headingEl) headingEl.textContent = item.title;
    if (tierEl) tierEl.textContent = formatTier(item.tier);
    if (descEl) descEl.textContent = item.description;

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("badge-unlock-open");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        card.classList.add("is-visible");
      });
    });

    const dismissBtn = card.querySelector('[data-badge-unlock-action="dismiss"]:not(.badge-unlock-close)');
    window.setTimeout(() => dismissBtn?.focus(), 700);
  }

  function closeCurrent() {
    const overlay = ensureOverlay();
    const card = overlay.querySelector(".badge-unlock-card");
    const code = card?.dataset.unlockCode || "";

    card?.classList.add("is-closing");
    card?.classList.remove("is-visible");

    window.setTimeout(() => {
      markCelebrated(code);
      if (code) shownThisSession.add(code);

      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("badge-unlock-open");

      card?.classList.remove("is-closing", "is-entering");
      showing = false;
      showNext();
    }, CLOSE_ANIM_MS);
  }

  function showNext() {
    if (showing || !queue.length) return;
    showing = true;
    renderModal(queue.shift());
  }

  function celebrate(achievements) {
    if (!Array.isArray(achievements) || !achievements.length) return;

    const celebrated = new Set(getCelebratedCodes());
    const payloads = achievements
      .filter((item) => item?.code && String(item.status || "") === "Verified")
      .filter((item) => !celebrated.has(item.code))
      .filter((item) => !shownThisSession.has(item.code))
      .map(buildPayload)
      .filter((item) => item.code);

    if (!payloads.length) return;

    const queuedCodes = new Set(queue.map((item) => item.code));
    payloads.forEach((payload) => {
      if (!queuedCodes.has(payload.code)) {
        queue.push(payload);
        queuedCodes.add(payload.code);
      }
    });

    if (!showing && !openTimer) {
      openTimer = window.setTimeout(() => {
        openTimer = null;
        showNext();
      }, OPEN_DELAY_MS);
    }
  }

  window.SeavBadgeUnlock = {
    celebrate,
    markCelebrated,
    getCelebratedCodes
  };
})();
