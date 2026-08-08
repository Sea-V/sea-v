// /js/bug-reports.js — "Report an issue" topbar modal, shared across every
// app page via renderSharedModals()/renderAppTopbar() in core.js. One form,
// one insert-only table (bug_reports) — no email, no reply thread. See
// docs/schema-bug-reports.sql for the table + RLS.
(function () {
  "use strict";

  function getSupabase() {
    return window.SeavSupabase || null;
  }

  async function resolveUserId() {
    if (window.SeavAuth?.getUserId?.()) return window.SeavAuth.getUserId();
    const client = getSupabase();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  function createId() {
    if (window.SeavData?.createId) return window.SeavData.createId("bugreport");
    return `bugreport_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function closeModal() {
    document.getElementById("modalOverlay")?.setAttribute("hidden", "");
    document.getElementById("reportIssueModal")?.setAttribute("hidden", "");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const categoryEl = document.getElementById("ri_category");
    const messageEl = document.getElementById("ri_message");
    const category = categoryEl?.value || "bug";
    const message = (messageEl?.value || "").trim();

    if (!message) {
      messageEl?.focus();
      return;
    }

    const client = getSupabase();
    if (!client) {
      window.SeavFeedback?.error?.(
        "Couldn't send report",
        "Connection isn't ready yet — try again in a moment."
      );
      return;
    }

    const userId = await resolveUserId();
    if (!userId) {
      window.SeavFeedback?.error?.(
        "Sign in required",
        "Please sign in before sending a report."
      );
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { error } = await client.from("bug_reports").insert([
        {
          id: createId(),
          user_id: userId,
          category,
          message,
          page_url: window.location.pathname.replace(/^\//, ""),
          app_version: window.SeavConfig?.ASSET_VERSION || null,
          status: "new"
        }
      ]);

      if (error) throw error;

      form.reset();
      closeModal();
      window.SeavFeedback?.success?.(
        "Report sent",
        "Thanks — this goes straight to the SEA-V team."
      );
    } catch (err) {
      console.error("[SEA-V] Bug report insert failed:", err);
      window.SeavFeedback?.error?.(
        "Couldn't send report",
        window.SeavFeedback?.formatActionError?.(err) || "Something went wrong. Please try again."
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function init() {
    const form = document.getElementById("reportIssueForm");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", handleSubmit);
  }

  // renderSharedModals() injects the form's HTML asynchronously into
  // #sharedModalsMount after DOMContentLoaded (see core.js mountSharedLayout),
  // so the element isn't guaranteed to exist yet on first paint. A short
  // poll is simpler and more robust here than coupling this file to core.js's
  // internal render-order — the same approach seav-notifications.js would
  // need if it didn't already depend on Seav being fully initialized.
  function initWhenReady(attemptsLeft = 40) {
    if (document.getElementById("reportIssueForm")) {
      init();
      return;
    }
    if (attemptsLeft <= 0) return;
    window.setTimeout(() => initWhenReady(attemptsLeft - 1), 100);
  }

  document.addEventListener("DOMContentLoaded", () => initWhenReady());
})();
