// /js/dashboard-public.js
// Public profile settings on the dashboard (v620, Jack 2026-11-06: "the entire thing
// moved to the dashboard page"). Username, colours, layout, link, QR and sharing.
// Opened from the title row, beside the switch in js/dashboard.js. The username saves
// the whole profile row, so it stays behind isPublicShareProfileReady().
(function () {
  "use strict";

  if (!window.Seav || !window.SeavAPI || !window.SeavData || !window.SeavState) {
    console.warn("[SEA-V] Public profile panel dependencies missing.");
    return;
  }

  const Seav = window.Seav;
  const SeavAPI = window.SeavAPI;
  const { KEYS, DEFAULT_PROFILE, slugifyUsername, isValidUsername } = window.SeavData;

  function loadPublicShareProfile() {
    return {
      ...DEFAULT_PROFILE,
      ...(window.SeavState?.profile || {}),
      id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
    };
  }

  // Same safety net as js/dashboard.js originally had (root cause: 2026-08-07
  // Mia Bailey data-loss incident). Both controls below save the ENTIRE
  // profile row (spread loadPublicShareProfile() + override one field) -- if
  // SeavState hasn't actually finished loading the real profile yet, that
  // silently returns DEFAULT_PROFILE, and saving would wipe every other
  // field back to blank. Block the save rather than risk it.
  function isPublicShareProfileReady() {
    return !!(window.SeavState?.ready && window.SeavState?.profile?.id);
  }

  function resolvePublicShareUrl() {
    const profile = loadPublicShareProfile();
    const path = Seav.buildPublicProfileUrl?.(profile) || "public-profile.html";
    return new URL(path, window.location.href).href;
  }

  async function copyPublicShareLink() {
    const url = resolvePublicShareUrl();

    try {
      await navigator.clipboard.writeText(url);
      Seav.notify("success", "Link copied", "Share your public profile with employers and recruiters.");
      return;
    } catch (err) {
      console.warn("[SEA-V] Public profile link clipboard copy failed:", err);
    }

    const urlEl = document.getElementById("ppLinkUrl");
    if (urlEl) {
      urlEl.focus();
      urlEl.select?.();
    }

    Seav.notify("info", "Copy manually", "Select the link and copy it.");
  }

  function syncPublicSharePanel(profile) {
    const currentProfile = profile || loadPublicShareProfile();
    const sharePanel = document.getElementById("ppShare");
    const statusEl = document.getElementById("ppStatus");
    const hintEl = document.getElementById("ppLinkHint");
    const linkWrap = document.getElementById("ppLinkWrap");
    const urlEl = document.getElementById("ppLinkUrl");
    const openEl = document.getElementById("ppLinkOpen");
    const usernameInput = document.getElementById("ppSlug");

    const enabled = !!currentProfile.publicEnabled;
    const url = resolvePublicShareUrl();

    if (sharePanel) {
      sharePanel.classList.toggle("is-live", enabled);
    }

    if (statusEl) {
      statusEl.textContent = enabled ? "Live" : "Private";
      statusEl.classList.toggle("is-live", enabled);
      statusEl.classList.toggle("is-private", !enabled);
    }

    if (hintEl) {
      hintEl.hidden = enabled;
    }

    if (linkWrap) {
      linkWrap.hidden = !enabled;
    }

    if (urlEl) {
      urlEl.value = url;
      urlEl.title = url;
    }

    if (openEl) {
      openEl.href = url;
    }

    // QR is grouped with the link row and always visible while the panel is
    // live (no separate toggle/expand step) — just keep it regenerated
    // against the current url on every sync, so a slug change never leaves
    // a stale code showing. No need to explicitly blank it when going
    // private: linkWrap.hidden above already hides the whole group, QR
    // included.
    if (enabled) {
      renderProfilePublicQr(url);
    }

    // Don't clobber the field mid-edit — only sync it in from the saved
    // profile when the user isn't actively typing in it.
    if (usernameInput && document.activeElement !== usernameInput) {
      usernameInput.value = currentProfile.username || "";
    }
  }

  function setPublicShareUsernameHint(message, isError) {
    const hintEl = document.getElementById("ppSlugHint");
    if (!hintEl) return;
    hintEl.textContent = message || "";
    hintEl.classList.toggle("is-error", !!isError);
  }

  function initPublicShareUsername() {
    const input = document.getElementById("ppSlug");
    const saveBtn = document.getElementById("ppSlugSave");
    if (!input || !saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      if (!isPublicShareProfileReady()) {
        setPublicShareUsernameHint("Still loading your profile — try again in a moment.", true);
        return;
      }

      const cleaned = slugifyUsername ? slugifyUsername(input.value) : input.value.trim().toLowerCase();
      input.value = cleaned;

      if (!cleaned) {
        setPublicShareUsernameHint("Enter a username first.", true);
        return;
      }

      if (isValidUsername && !isValidUsername(cleaned)) {
        setPublicShareUsernameHint("3-30 characters: lowercase letters, numbers, and hyphens only.", true);
        return;
      }

      const profile = loadPublicShareProfile();
      if (cleaned === (profile.username || "")) {
        setPublicShareUsernameHint("That's already your username.", false);
        return;
      }

      const updated = { ...profile, username: cleaned };

      try {
        await Seav.withSaving(async () => {
          await SeavAPI.save(KEYS.PROFILE, updated);
          if (window.SeavState?.refresh) {
            await window.SeavState.refresh();
          } else if (window.SeavState?.data) {
            window.SeavState.data.profile = updated;
          }
        }, { sub: "Updating your public link", rethrow: true });

        syncPublicSharePanel(updated);
        setPublicShareUsernameHint("Saved — your link is updated.", false);
        Seav.notify("success", "Username saved", `Your public link is now /u/${cleaned}.`);
      } catch (err) {
        console.error("[SEA-V] Username save failed:", err);
        const message =
          err?.code === "USERNAME_TAKEN"
            ? err.message
            : err?.message || "Could not save username. Try again.";
        setPublicShareUsernameHint(message, true);
        Seav.notify("error", "Could not save username", message);
      }
    });
  }

  // QR code for the public profile link -- lets a crew member hand their
  // profile to someone in person (a dock, a crew agency desk) by having
  // them scan it, instead of only being able to send a message. Generated
  // entirely client-side via qrcodejs (dashboard.html script tag): no
  // third-party "QR image API" is called, so the profile URL is never sent
  // anywhere just to render the code. Regenerated on every open (not
  // cached) so it always reflects the current username/slug.
  function renderProfilePublicQr(url) {
    const canvasHost = document.getElementById("ppQrCanvas");
    if (!canvasHost || !url) return;

    if (typeof window.QRCode !== "function") {
      // Library still loading (it's deferred) -- try again shortly rather
      // than silently leaving the panel blank.
      window.setTimeout(() => renderProfilePublicQr(url), 200);
      return;
    }

    // Generated at a higher pixel size than it's displayed (see
    // .profile-public-share-qr-canvas in css/pages/profile.css, which
    // renders it at ~76px) so a shared/saved copy still scans and prints
    // cleanly, not just a small on-screen preview.
    canvasHost.innerHTML = "";
    new window.QRCode(canvasHost, {
      text: url,
      width: 168,
      height: 168,
      colorDark: "#0b1c2e",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }

  // The QR is small and always visible now (grouped with the link row —
  // see dashboard.html), so there's no toggle/expand step left to wire.
  // Tapping the code itself shares (or downloads, as a fallback) the QR
  // image via js/seav-share.js's shareCanvasImage — the QR is already a
  // canvas, so this skips seav-share's off-screen-render/html2canvas
  // pipeline entirely and just shares the canvas that's already on screen.
  function initPublicShareQr() {
    const shareBtn = document.getElementById("ppQrShare");
    if (!shareBtn) return;

    shareBtn.addEventListener("click", async () => {
      if (shareBtn.disabled) return;
      const canvas = document.querySelector("#ppQrCanvas canvas");
      if (!canvas) {
        Seav.notify("error", "QR code not ready", "Give it a second and try again.");
        return;
      }

      shareBtn.disabled = true;
      try {
        const profile = loadPublicShareProfile();
        const url = resolvePublicShareUrl();
        await window.SeavShare?.shareCanvasImage?.(canvas, {
          filenameBase: `seav-profile-qr-${(profile.username || "career").toLowerCase()}`,
          shareText: `Scan to view my SEA-V career profile: ${url}`,
          linkUrl: url
        });
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  // Closed until wanted: a plain toggle, not a saved preference. The button is in
  // the title row, beside the switch.
  function setPanelOpen(open) {
    const toggleBtn = document.getElementById("ppShareToggle");
    const panel = document.getElementById("ppShare");
    if (!toggleBtn || !panel) return;
    toggleBtn.setAttribute("aria-expanded", String(open));
    toggleBtn.setAttribute("aria-label", open ? "Hide your public profile settings" : "Show your public profile settings");
    panel.hidden = !open;
  }

  function initPublicShareDetailsToggle() {
    const toggleBtn = document.getElementById("ppShareToggle");
    const panel = document.getElementById("ppShare");
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener("click", () => setPanelOpen(panel.hidden));

    // Links to the settings (the Private status, the Your records row).
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.('a[href="#ppShare"]')) return;
      event.preventDefault();
      setPanelOpen(true);
      panel.scrollIntoView({ block: "nearest" });
    });
  }

  function initPublicShareToggle() {
    const copyBtn = document.getElementById("ppLinkCopy");
    const shareImageBtn = document.getElementById("ppShareImage");

    syncPublicSharePanel();
    initPublicShareUsername();
    initPublicShareDetailsToggle();
    initPublicShareQr();

    copyBtn?.addEventListener("click", () => {
      copyPublicShareLink();
    });

    shareImageBtn?.addEventListener("click", async () => {
      if (shareImageBtn.disabled) return;
      shareImageBtn.disabled = true;
      try {
        await window.SeavShare?.shareProfile?.();
      } finally {
        shareImageBtn.disabled = false;
      }
    });
  }

  function initPublicProfilePanel() {
    if (!document.getElementById("ppShare")) return;
    initPublicShareToggle();
    initPublicTheme();
    initPublicLayout();
    Seav.bindStateRefresh(() => syncPublicSharePanel(), { label: "Public share refresh" });
  }

  document.addEventListener("DOMContentLoaded", initPublicProfilePanel);

  window.SeavPublicPanel = { open: () => setPanelOpen(true) };

  // v590 public profile palette. Outside #profileForm and saved on its own
  // (SeavAPI.savePublicTheme), so it never marks the profile form dirty.
  function initPublicTheme() {
    const picker = document.getElementById("ppThemePicker");
    if (!picker) return;
    const radios = [...picker.querySelectorAll('input[name="pp_theme"]')];
    const sync = () => {
      const current = window.SeavState?.profile?.publicTheme || "seav";
      radios.forEach((r) => {
        r.checked = r.value === current;
      });
    };
    window.SeavAuth?.whenReady?.().then(sync);
    document.addEventListener("seav:data-updated", sync);
    document.addEventListener("seav:state-ready", sync);
    picker.addEventListener("change", async (e) => {
      const radio = e.target.closest('input[name="pp_theme"]');
      if (!radio) return;
      const label = radio.closest("label")?.textContent.trim() || radio.value;
      try {
        await window.SeavAPI.savePublicTheme(radio.value);
        Seav.notify("success", "Public profile colours saved", label);
      } catch (err) {
        sync();
        console.error("[SEA-V] Could not save public profile colours:", err);
        Seav.notify("error", "Could not save", err?.message || "Try again.");
      }
    });
  }

  // v595 public profile layout. Same shape as initPublicTheme above.
  function initPublicLayout() {
    const picker = document.getElementById("ppLayoutPicker");
    if (!picker) return;
    const radios = [...picker.querySelectorAll('input[name="pp_layout"]')];
    const sync = () => {
      const current = window.SeavState?.profile?.publicLayout || "current";
      radios.forEach((r) => {
        r.checked = r.value === current;
      });
    };
    window.SeavAuth?.whenReady?.().then(sync);
    document.addEventListener("seav:data-updated", sync);
    document.addEventListener("seav:state-ready", sync);
    picker.addEventListener("change", async (e) => {
      const radio = e.target.closest('input[name="pp_layout"]');
      if (!radio) return;
      const label = radio.closest("label")?.textContent.trim() || radio.value;
      try {
        await window.SeavAPI.savePublicLayout(radio.value);
        Seav.notify("success", "Public profile layout saved", label);
      } catch (err) {
        sync();
        console.error("[SEA-V] Could not save public profile layout:", err);
        Seav.notify("error", "Could not save", err?.message || "Try again.");
      }
    });
  }
})();
