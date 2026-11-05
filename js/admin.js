// /js/admin.js — admin.html only. Lists crew bug_reports for admin_users
// members (checked via the is_admin() RPC — RLS already blocks non-admins
// from reading bug_reports at all, this is just a friendlier gate than a
// silently-empty list). Not part of the crew-facing app shell: no sidebar,
// no SeavState/SeavData — just a direct Supabase read/update against
// bug_reports, plus a lightweight profile lookup for reporter context.
(function () {
  "use strict";

  const CATEGORY_LABELS = {
    bug: "Something's broken",
    missing: "Something's missing",
    suggestion: "Suggestion / idea"
  };

  const CATEGORY_PILL_CLASS = {
    bug: "pill-expired",
    missing: "pill-warning",
    suggestion: "pill-pending"
  };

  const STATUS_LABELS = {
    new: "New",
    reviewing: "Reviewing",
    done: "Done"
  };

  const STATUS_PILL_CLASS = {
    new: "pill-pending",
    reviewing: "pill-warning",
    done: "pill-valid"
  };

  let allReports = [];
  let profilesById = new Map();

  function esc(str) {
    return window.Seav?.escapeHtml ? window.Seav.escapeHtml(str) : String(str ?? "");
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function getClient() {
    return window.SeavSupabase || null;
  }

  function showGateMessage(html) {
    const gate = document.getElementById("adminGate");
    const content = document.getElementById("adminContent");
    if (gate) {
      gate.hidden = false;
      gate.innerHTML = html;
    }
    if (content) content.hidden = true;
  }

  function showContent() {
    const gate = document.getElementById("adminGate");
    const content = document.getElementById("adminContent");
    if (gate) gate.hidden = true;
    if (content) content.hidden = false;
  }

  async function checkIsAdmin(client) {
    const { data, error } = await client.rpc("is_admin");
    if (error) {
      console.warn("[SEA-V Admin] is_admin() check failed:", error);
      return false;
    }
    return data === true;
  }

  async function fetchReports(client) {
    const { data, error } = await client
      .from("bug_reports")
      .select("id, user_id, category, message, page_url, app_version, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function fetchProfiles(client, userIds) {
    if (!userIds.length) return new Map();
    const { data, error } = await client
      .from("profile")
      .select("id, name, email")
      .in("id", userIds);

    if (error) {
      console.warn("[SEA-V Admin] Reporter profile lookup failed:", error);
      return new Map();
    }
    return new Map((data || []).map((row) => [row.id, row]));
  }

  function renderKpis(reports) {
    const mount = document.getElementById("adminKpiRow");
    if (!mount) return;

    const total = reports.length;
    const counts = { new: 0, reviewing: 0, done: 0 };
    reports.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    });

    mount.innerHTML = `
      <div class="admin-kpi-box">
        <span class="kpi-num">${total}</span>
        <span class="kpi-label">Total reports</span>
      </div>
      <div class="admin-kpi-box">
        <span class="kpi-num">${counts.new}</span>
        <span class="kpi-label">New</span>
      </div>
      <div class="admin-kpi-box">
        <span class="kpi-num">${counts.reviewing}</span>
        <span class="kpi-label">Reviewing</span>
      </div>
      <div class="admin-kpi-box">
        <span class="kpi-num">${counts.done}</span>
        <span class="kpi-label">Done</span>
      </div>
    `;
  }

  function reportRowHtml(report) {
    const profile = profilesById.get(report.user_id);
    const reporterName = profile?.name?.trim() || profile?.email?.trim() || "Unknown crew member";

    const categoryLabel = CATEGORY_LABELS[report.category] || report.category;
    const categoryPill = CATEGORY_PILL_CLASS[report.category] || "pill-neutral";

    const statusOptions = Object.keys(STATUS_LABELS)
      .map(
        (value) =>
          `<option value="${value}" ${value === report.status ? "selected" : ""}>${STATUS_LABELS[value]}</option>`
      )
      .join("");

    return `
      <article class="admin-report-row" data-report-id="${esc(report.id)}">
        <div class="admin-report-top">
          <span class="admin-report-reporter">${esc(reporterName)}</span>
          <span class="pill ${categoryPill}">${esc(categoryLabel)}</span>
          <span class="pill ${STATUS_PILL_CLASS[report.status] || "pill-neutral"}">${esc(STATUS_LABELS[report.status] || report.status)}</span>
          <span class="admin-report-date">${esc(formatDate(report.created_at))}</span>
        </div>

        <p class="admin-report-message">${esc(report.message)}</p>

        <div class="admin-report-meta">
          <span>Page: <code>${esc(report.page_url || "unknown")}</code></span>
          <span>Version: <code>v${esc(report.app_version ?? "?")}</code></span>
          <select class="admin-report-status-select" data-report-id="${esc(report.id)}">
            ${statusOptions}
          </select>
        </div>
      </article>
    `;
  }

  function applyFiltersAndRender() {
    const statusFilter = document.getElementById("adminStatusFilter")?.value || "";
    const categoryFilter = document.getElementById("adminCategoryFilter")?.value || "";

    const filtered = allReports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      return true;
    });

    const list = document.getElementById("adminReportList");
    const emptyMsg = document.getElementById("adminEmptyMsg");
    if (!list) return;

    if (!filtered.length) {
      list.innerHTML = "";
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }

    if (emptyMsg) emptyMsg.hidden = true;
    list.innerHTML = filtered.map(reportRowHtml).join("");

    list.querySelectorAll(".admin-report-status-select").forEach((select) => {
      select.addEventListener("change", handleStatusChange);
    });
  }

  async function handleStatusChange(event) {
    const select = event.currentTarget;
    const reportId = select.dataset.reportId;
    const newStatus = select.value;
    const client = getClient();
    if (!client || !reportId) return;

    select.disabled = true;
    try {
      const { error } = await client
        .from("bug_reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      if (error) throw error;

      const report = allReports.find((r) => r.id === reportId);
      if (report) report.status = newStatus;

      renderKpis(allReports);

      const row = select.closest(".admin-report-row");
      const statusPill = row?.querySelector(".admin-report-top .pill:nth-child(3)");
      if (statusPill) {
        statusPill.className = `pill ${STATUS_PILL_CLASS[newStatus] || "pill-neutral"}`;
        statusPill.textContent = STATUS_LABELS[newStatus] || newStatus;
      }

      window.SeavFeedback?.success?.("Updated", "Report status saved.");
    } catch (err) {
      console.error("[SEA-V Admin] Status update failed:", err);
      window.SeavFeedback?.error?.(
        "Couldn't update status",
        window.SeavFeedback?.formatActionError?.(err) || "Something went wrong. Please try again."
      );
    } finally {
      select.disabled = false;
    }
  }

  async function loadReports() {
    const client = getClient();
    const list = document.getElementById("adminReportList");
    if (list) list.innerHTML = `<p class="admin-loading">Loading reports…</p>`;

    try {
      const reports = await fetchReports(client);
      const userIds = [...new Set(reports.map((r) => r.user_id).filter(Boolean))];
      profilesById = await fetchProfiles(client, userIds);
      allReports = reports;

      renderKpis(allReports);
      applyFiltersAndRender();
    } catch (err) {
      console.error("[SEA-V Admin] Loading bug reports failed:", err);
      if (list) {
        list.innerHTML = `<p class="admin-loading">Couldn't load reports. Refresh to try again.</p>`;
      }
    }
  }

  /* ---------- v609 yacht directory review ---------- */
  const DIRECTORY_FIELD_LABELS = {
    name: "Name",
    imo: "IMO",
    mmsi: "MMSI",
    official_number: "Official number",
    flag: "Flag",
    gt: "Gross tonnage",
    vessel_length: "Length"
  };

  async function loadDirectoryFlags() {
    const client = getClient();
    const section = document.getElementById("adminDirectory");
    const list = document.getElementById("adminDirectoryList");
    if (!client || !section || !list) return;

    const { data, error } = await client
      .from("vessel_directory_flags")
      .select("id, directory_id, user_id, field, directory_value, submitted_value, created_at, vessel_directory(name, imo)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[SEA-V Admin] Loading directory flags failed:", error);
      section.hidden = true;
      return;
    }

    const flags = data || [];
    section.hidden = !flags.length;
    const people = await fetchProfiles(client, [...new Set(flags.map((f) => f.user_id).filter(Boolean))]);
    list.innerHTML = flags.map((flag) => `
      <article class="admin-report-row" data-flag-id="${esc(flag.id)}">
        <div class="admin-report-top">
          <strong>${esc(flag.vessel_directory?.name || "Yacht")}</strong>
          <small>${flag.vessel_directory?.imo ? `IMO ${esc(flag.vessel_directory.imo)} · ` : ""}${esc(DIRECTORY_FIELD_LABELS[flag.field] || flag.field)}</small>
        </div>
        <p class="admin-directory-values">Directory: <strong>${esc(flag.directory_value || "—")}</strong> · ${esc(people.get(flag.user_id)?.name || "A crew member")}: <strong>${esc(flag.submitted_value || "—")}</strong></p>
        <div class="admin-directory-actions">
          <button type="button" class="btn-ghost2" data-flag-use="${esc(flag.id)}">Use their value</button>
          <button type="button" class="btn-ghost2" data-flag-dismiss="${esc(flag.id)}">Keep the directory</button>
        </div>
      </article>`).join("");
    list.__flags = flags;
  }

  async function handleDirectoryAction(event) {
    const useId = event.target.closest("[data-flag-use]")?.getAttribute("data-flag-use");
    const dismissId = event.target.closest("[data-flag-dismiss]")?.getAttribute("data-flag-dismiss");
    const flagId = useId || dismissId;
    if (!flagId) return;
    const client = getClient();
    const list = document.getElementById("adminDirectoryList");
    const flag = (list.__flags || []).find((f) => f.id === flagId);
    if (!client || !flag) return;

    try {
      if (useId) {
        const { error } = await client
          .from("vessel_directory")
          .update({ [flag.field]: flag.submitted_value, updated_at: new Date().toISOString() })
          .eq("id", flag.directory_id);
        if (error) throw error;
      }
      const { error } = await client.from("vessel_directory_flags").delete().eq("id", flagId);
      if (error) throw error;
      window.SeavFeedback?.success?.("Updated", useId ? "The directory now uses that value." : "The directory stays as it is.");
      await loadDirectoryFlags();
    } catch (err) {
      console.error("[SEA-V Admin] Directory review failed:", err);
      window.SeavFeedback?.error?.("Couldn't update", err?.message || "That value may not be valid for this field.");
    }
  }

  function wireLogout() {
    const btn = document.getElementById("adminLogoutBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await window.SeavAuth?.logout?.();
      } catch (err) {
        console.warn("[SEA-V Admin] Logout failed:", err);
      }
      window.location.href = "index.html";
    });
  }

  async function init() {
    wireLogout();

    document.getElementById("adminStatusFilter")?.addEventListener("change", applyFiltersAndRender);
    document.getElementById("adminCategoryFilter")?.addEventListener("change", applyFiltersAndRender);
    document.getElementById("adminRefreshBtn")?.addEventListener("click", loadReports);

    await window.SeavAuth?.whenReady?.();

    if (!window.SeavAuth?.isAuthenticated?.()) {
      // auth.js's PROTECTED_PAGES redirect should already have fired before
      // this runs, but bail out cleanly if it hasn't yet.
      return;
    }

    const client = getClient();
    if (!client) {
      showGateMessage(`<p class="admin-loading">Connection isn't ready. Refresh the page.</p>`);
      return;
    }

    const isAdmin = await checkIsAdmin(client);
    if (!isAdmin) {
      showGateMessage(`
        <p class="admin-loading">
          This account isn't set up as a SEA-V admin.
          <a href="dashboard.html">Back to your dashboard</a>
        </p>
      `);
      return;
    }

    showContent();
    await loadReports();
    await loadDirectoryFlags();
    document.getElementById("adminDirectoryList")?.addEventListener("click", handleDirectoryAction);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();
