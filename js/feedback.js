// /js/feedback.js
(function () {
  "use strict";

  const ICONS = {
    success: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 12.5l3.5 3.5L18 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    error: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 3.5 4.5 19h15L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `,
    info: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 7.5v.01M11 11h1.5v6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,
    loader: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 18c1.2-.9 2.4-.9 3.6 0 1.2.9 2.4.9 3.6 0 1.2-.9 2.4-.9 3.6 0 1.2.9 2.4.9 3.6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M8 14.5h8l-1.4-3.5H9.4L8 14.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `
  };

  const WAVE_PATH =
    "M0 24 C120 8 240 32 360 16 C480 0 600 24 720 12 V48 H0 Z";

  let toastStack = null;
  let pageLoader = null;
  let loaderCount = 0;

  function ensureToastStack() {
    if (toastStack) return toastStack;

    toastStack = document.createElement("div");
    toastStack.className = "seav-toast-stack";
    toastStack.setAttribute("aria-live", "polite");
    toastStack.setAttribute("aria-atomic", "false");
    document.body.appendChild(toastStack);
    return toastStack;
  }

  function ensurePageLoader() {
    if (pageLoader) return pageLoader;

    pageLoader = document.createElement("div");
    pageLoader.className = "seav-page-loader";
    pageLoader.hidden = true;
    pageLoader.innerHTML = `
      <div class="seav-page-loader-card" role="status" aria-live="polite">
        <div class="seav-page-loader-mark">${ICONS.loader}</div>
        <p class="seav-page-loader-text">Setting sail…</p>
        <p class="seav-page-loader-sub">Loading your SEA-V profile</p>
        <div class="seav-loader-ocean" aria-hidden="true">
          <svg class="seav-wave-a" viewBox="0 0 720 48" preserveAspectRatio="none">
            <path d="${WAVE_PATH}" fill="rgba(91,188,255,0.35)"/>
          </svg>
          <svg class="seav-wave-b" viewBox="0 0 720 48" preserveAspectRatio="none">
            <path d="${WAVE_PATH}" fill="rgba(114,228,255,0.55)"/>
          </svg>
        </div>
      </div>
    `;
    document.body.appendChild(pageLoader);
    return pageLoader;
  }

  function toast(options = {}) {
    const {
      type = "info",
      title = "SEA-V",
      message = "",
      duration = 4200
    } = options;

    ensureToastStack();

    const el = document.createElement("div");
    el.className = `seav-toast seav-toast--${type}`;
    el.innerHTML = `
      <div class="seav-toast-icon">${ICONS[type] || ICONS.info}</div>
      <p class="seav-toast-title">${escapeHtml(title)}</p>
      ${message ? `<p class="seav-toast-message">${escapeHtml(message)}</p>` : ""}
      <div class="seav-toast-wave" aria-hidden="true"><span></span></div>
    `;

    toastStack.appendChild(el);

    const dismiss = () => {
      if (!el.isConnected) return;
      el.classList.add("is-leaving");
      window.setTimeout(() => el.remove(), 280);
    };

    const timer = window.setTimeout(dismiss, duration);
    el.addEventListener("click", () => {
      window.clearTimeout(timer);
      dismiss();
    });

    return dismiss;
  }

  function success(title, message) {
    return toast({ type: "success", title, message });
  }

  function error(title, message) {
    return toast({ type: "error", title, message, duration: 5200 });
  }

  function info(title, message) {
    return toast({ type: "info", title, message });
  }

  function showPageLoader(message, submessage) {
    ensurePageLoader();
    loaderCount += 1;

    const textEl = pageLoader.querySelector(".seav-page-loader-text");
    const subEl = pageLoader.querySelector(".seav-page-loader-sub");

    if (textEl) textEl.textContent = message || "Setting sail…";
    if (subEl) subEl.textContent = submessage || "Loading your SEA-V profile";

    pageLoader.hidden = false;
    pageLoader.classList.add("is-visible");
    document.body.classList.add("seav-is-loading");
  }

  function hidePageLoader() {
    if (!pageLoader) return;

    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount > 0) return;

    pageLoader.classList.remove("is-visible");
    document.body.classList.remove("seav-is-loading");

    window.setTimeout(() => {
      if (loaderCount === 0 && pageLoader) {
        pageLoader.hidden = true;
      }
    }, 280);
  }

  function showSaving(message, submessage) {
    showPageLoader(message || "Saving…", submessage || "Updating your SEA-V records");
  }

  function hideSaving() {
    hidePageLoader();
  }

  function formatActionError(err, fallback = "Something went wrong. Check the browser console (F12).") {
    if (!err) return fallback;
    if (typeof err === "string") return err;
    const message = String(err.message || "").trim();
    if (message) return message;
    return fallback;
  }

  async function withSaving(task, options = {}) {
    if (typeof task !== "function") {
      throw new TypeError("withSaving requires an async function");
    }

    showSaving(options.title, options.sub);
    try {
      return await task();
    } catch (err) {
      console.error("[SEA-V] Save failed:", err);
      error(
        options.errorTitle || "Save failed",
        options.errorMessage || formatActionError(err)
      );
      if (options.rethrow) throw err;
      return undefined;
    } finally {
      hideSaving();
    }
  }

  function escapeHtml(str) {
    if (window.Seav?.escapeHtml) return window.Seav.escapeHtml(str);
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initFeedback() {
    ensureToastStack();
    ensurePageLoader();
  }

  window.SeavFeedback = {
    toast,
    success,
    error,
    info,
    showPageLoader,
    hidePageLoader,
    showSaving,
    hideSaving,
    withSaving,
    formatActionError,
    init: initFeedback
  };

  document.addEventListener("DOMContentLoaded", initFeedback);
})();
