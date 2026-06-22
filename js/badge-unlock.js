// /js/badge-unlock.js
(function () {
  "use strict";

  const STORAGE_KEY = "seav_celebrated_badge_codes";
  const INTRO_DELAY_MS = 1800;
  const OPEN_DELAY_MS = 550;
  const CLOSE_ANIM_MS = 750;

  const queue = [];
  const shownThisSession = new Set();
  let showing = false;
  let overlayEl = null;
  let introTimer = null;
  let openTimer = null;

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
    if (!value || value === "default") return "Achievement";
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
          status: "Approved"
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

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.className = "badge-unlock-overlay";
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.innerHTML = `
      <div class="badge-unlock-backdrop" aria-hidden="true"></div>
      <div
        class="badge-unlock-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badgeUnlockTitle"
        tabindex="-1"
      >
        <div class="badge-unlock-glow" aria-hidden="true"></div>

        <p class="badge-unlock-kicker">Achievement unlocked</p>
        <h2 class="badge-unlock-heading" id="badgeUnlockTitle">Congratulations</h2>
        <p class="badge-unlock-subheading">You earned a new career badge</p>

        <div class="badge-unlock-badge-stage">
          <div class="badge-unlock-badge-ring" aria-hidden="true"></div>
          <img
            class="badge-unlock-badge-image"
            alt=""
            width="72"
            height="72"
            decoding="async"
          />
        </div>

        <p class="badge-unlock-badge-name"></p>
        <span class="badge-unlock-tier-pill"></span>

        <div class="badge-unlock-reason" hidden>
          <p class="badge-unlock-reason-label">Why you earned this</p>
          <p class="badge-unlock-reason-text"></p>
          <p class="badge-unlock-reason-meta"></p>
        </div>

        <button
          type="button"
          class="badge-unlock-cta"
          data-badge-unlock-action="reveal"
          disabled
        >
          Preparing your achievement…
        </button>
        <button
          type="button"
          class="badge-unlock-cta badge-unlock-cta--primary"
          data-badge-unlock-action="dismiss"
          hidden
        >
          Continue
        </button>
      </div>
    `;

    document.body.appendChild(overlayEl);

    overlayEl.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-badge-unlock-action]");
      if (!actionBtn || actionBtn.disabled) return;

      const card = overlayEl.querySelector(".badge-unlock-card");
      const action = actionBtn.getAttribute("data-badge-unlock-action");

      if (action === "reveal") {
        revealReason(card);
        return;
      }

      if (action === "dismiss") {
        closeCurrent();
      }
    });

    return overlayEl;
  }

  function clearTimers() {
    if (introTimer) {
      window.clearTimeout(introTimer);
      introTimer = null;
    }
    if (openTimer) {
      window.clearTimeout(openTimer);
      openTimer = null;
    }
  }

  function revealReason(card) {
    if (!card || card.classList.contains("is-revealed")) return;

    card.classList.add("is-revealed");

    const reason = card.querySelector(".badge-unlock-reason");
    const revealBtn = card.querySelector('[data-badge-unlock-action="reveal"]');
    const dismissBtn = card.querySelector('[data-badge-unlock-action="dismiss"]');

    if (reason) reason.hidden = false;
    if (revealBtn) revealBtn.hidden = true;

    window.setTimeout(() => {
      if (dismissBtn) {
        dismissBtn.hidden = false;
        dismissBtn.focus();
      }
    }, 650);
  }

  function renderModal(item) {
    clearTimers();

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
    const nameEl = card.querySelector(".badge-unlock-badge-name");
    const tierEl = card.querySelector(".badge-unlock-tier-pill");
    const reasonEl = card.querySelector(".badge-unlock-reason");
    const reasonTextEl = card.querySelector(".badge-unlock-reason-text");
    const reasonMetaEl = card.querySelector(".badge-unlock-reason-meta");
    const revealBtn = card.querySelector('[data-badge-unlock-action="reveal"]');
    const dismissBtn = card.querySelector('[data-badge-unlock-action="dismiss"]');

    if (imageEl) {
      imageEl.src = item.image;
      imageEl.alt = item.title;
    }
    if (nameEl) nameEl.textContent = item.title;
    if (tierEl) tierEl.textContent = formatTier(item.tier);
    if (reasonTextEl) reasonTextEl.textContent = item.description;
    if (reasonMetaEl) reasonMetaEl.textContent = item.category || "Career milestone";

    if (reasonEl) reasonEl.hidden = true;
    if (dismissBtn) dismissBtn.hidden = true;

    if (revealBtn) {
      revealBtn.hidden = false;
      revealBtn.disabled = true;
      revealBtn.textContent = "Preparing your achievement…";
      revealBtn.classList.remove("is-ready");
    }

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("badge-unlock-open");

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        card.classList.add("is-visible");
      });
    });

    introTimer = window.setTimeout(() => {
      if (!revealBtn) return;
      revealBtn.disabled = false;
      revealBtn.textContent = "See why you earned this";
      revealBtn.classList.add("is-ready");
      revealBtn.focus();
    }, INTRO_DELAY_MS);
  }

  function closeCurrent() {
    clearTimers();

    const overlay = ensureOverlay();
    const card = overlay.querySelector(".badge-unlock-card");
    const code = card?.dataset.unlockCode || "";

    card?.classList.add("is-closing");
    card?.classList.remove("is-visible", "is-revealed");

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
      .filter((item) => item?.code && String(item.status || "") === "Approved")
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
