// /js/cv-generator.js
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData || !window.SeavState || !window.SeavCvEngine) {
    console.warn("[SEA-V] CV generator dependencies missing.");
    return;
  }

  let draft = null;
  let saveTimer = null;
  let controlsBound = false;

  function getSource() {
    return window.SeavCvEngine.buildCvSource(window.SeavState);
  }

  function ensureDraft() {
    const source = getSource();
    const stored = window.SeavCvEngine.loadDraft();
    draft = stored
      ? window.SeavCvEngine.syncDraftWithSource(stored, source)
      : window.SeavCvEngine.createDefaultDraft(source);
    window.SeavCvEngine.saveDraft(draft);
    return draft;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      draft = window.SeavCvEngine.saveDraft(draft);
      updateSaveStatus();
    }, 350);
  }

  function updateSaveStatus() {
    const el = document.getElementById("cvSaveStatus");
    if (!el || !draft?.updatedAt) return;
    const when = new Date(draft.updatedAt);
    el.textContent = Number.isNaN(when.getTime())
      ? "Draft saved locally"
      : `Draft saved · ${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function updateHint(source) {
    const hint = document.getElementById("cvDataHint");
    if (!hint) return;

    const parts = [];
    if (source.profile.name) parts.push("profile");
    if (source.vessels.length) {
      parts.push(`${source.vessels.length} vessel${source.vessels.length === 1 ? "" : "s"}`);
    }
    if (source.certs.length) {
      parts.push(`${source.certs.length} cert${source.certs.length === 1 ? "" : "s"}`);
    }

    hint.textContent = parts.length
      ? `SEA-V records loaded (${parts.join(", ")}). Edit below without changing your source data.`
      : "Add profile and career data in SEA-V, then polish your CV here.";
  }

  function renderPreview() {
    const preview = document.getElementById("cvPreview");
    if (!preview || !draft) return;

    const source = getSource();
    const documentModel = window.SeavCvEngine.buildCvDocument(source, draft);
    preview.className = "cv-document cv-document--seav";
    preview.innerHTML = window.SeavCvEngine.renderCvHtml(documentModel);
  }

  function renderVesselEditor(source) {
    const list = document.getElementById("cvVesselEditor");
    if (!list) return;

    const ordered = draft.vesselOrder?.length
      ? draft.vesselOrder
      : source.vessels.map((v) => v.id);
    const map = new Map(source.vessels.map((v) => [v.id, v]));

    if (!source.vessels.length) {
      list.innerHTML = `<p class="cvgen-editor-empty">Add vessels in SEA-V to build experience entries.</p>`;
      return;
    }

    list.innerHTML = ordered
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((vessel) => {
        const entry = draft.vessels[vessel.id] || { included: true, includeBio: true, bullets: "" };
        const role = window.SeavCvEngine.getVesselRole(vessel);
        const label = `${vessel.name || "Yacht"} · ${role || "Crew"}`;
        const experienceText = window.SeavCvEngine.getVesselExperience(vessel);
        const includeBio = entry.includeBio !== false;
        return `
          <article class="cvgen-vessel-card" data-vessel-id="${Seav.escapeHtml(vessel.id)}">
            <label class="cvgen-vessel-head">
              <input type="checkbox" class="cv-vessel-include" data-vessel-id="${Seav.escapeHtml(vessel.id)}" ${
                entry.included !== false ? "checked" : ""
              } />
              <span>${Seav.escapeHtml(label)}</span>
            </label>
            <p class="cvgen-vessel-meta">${Seav.escapeHtml(
              window.SeavCvEngine.formatCvDateRange(vessel.from, vessel.to)
            )}</p>
            <label class="cvgen-check cvgen-vessel-bio-toggle">
              <input
                type="checkbox"
                class="cv-vessel-bio"
                data-vessel-id="${Seav.escapeHtml(vessel.id)}"
                ${includeBio ? "checked" : ""}
                ${experienceText ? "" : "disabled"}
              />
              <span>Include vessel experience notes${
                experienceText ? "" : " (none saved on vessel)"
              }</span>
            </label>
            <label class="cvgen-vessel-bullets-label">
              CV highlights
              <textarea
                class="cv-vessel-bullets"
                data-vessel-id="${Seav.escapeHtml(vessel.id)}"
                rows="4"
                placeholder="One bullet per line — written for employers, not your vessel log."
              >${Seav.escapeHtml(entry.bullets || "")}</textarea>
            </label>
            <button type="button" class="cvgen-reset-vessel btn-ghost2" data-vessel-id="${Seav.escapeHtml(
              vessel.id
            )}">
              Reset bullets from SEA-V
            </button>
          </article>
        `;
      })
      .join("");
  }

  function syncEditorFields() {
    const summaryInput = document.getElementById("cvSummaryInput");
    const headlineInput = document.getElementById("cvHeadlineInput");

    if (summaryInput) summaryInput.value = draft.summary || "";
    if (headlineInput) headlineInput.value = draft.headline || "";

    document.querySelectorAll("[data-cv-section]").forEach((input) => {
      const key = input.getAttribute("data-cv-section");
      if (key) input.checked = draft.sections?.[key] !== false;
    });
  }

  function bindControlsOnce() {
    if (controlsBound) return;
    controlsBound = true;

    const summaryInput = document.getElementById("cvSummaryInput");
    const headlineInput = document.getElementById("cvHeadlineInput");
    const resetBtn = document.getElementById("btnResetCvDraft");
    const printBtn = document.getElementById("btnPrintCv");
    const list = document.getElementById("cvVesselEditor");

    if (summaryInput) {
      summaryInput.addEventListener("input", () => {
        draft.summary = summaryInput.value;
        scheduleSave();
        renderPreview();
      });
    }

    if (headlineInput) {
      headlineInput.addEventListener("input", () => {
        draft.headline = headlineInput.value;
        scheduleSave();
        renderPreview();
      });
    }

    document.querySelectorAll("[data-cv-section]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-cv-section");
        if (!key) return;
        draft.sections = draft.sections || window.SeavCvEngine.getDefaultSections();
        draft.sections[key] = input.checked;
        scheduleSave();
        renderPreview();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const ok = window.confirm(
          "Reset the CV draft from your latest SEA-V records?\n\nYour vessel logs and profile will not change — only this CV draft."
        );
        if (!ok) return;
        draft = window.SeavCvEngine.resetDraftFromSource(getSource());
        refreshUi();
        Seav.notify("success", "CV refreshed", "Draft rebuilt from your SEA-V records.");
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        draft = window.SeavCvEngine.saveDraft(draft);
        document.body.classList.add("cvgen-printing");
        window.print();
        window.setTimeout(() => document.body.classList.remove("cvgen-printing"), 500);
      });
    }

    if (list) {
      list.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        const id = target.getAttribute("data-vessel-id");
        if (!id) return;

        if (target.classList.contains("cv-vessel-include")) {
          draft.vessels[id] = draft.vessels[id] || {};
          draft.vessels[id].included = target.checked;
          scheduleSave();
          renderPreview();
          return;
        }

        if (target.classList.contains("cv-vessel-bio")) {
          draft.vessels[id] = draft.vessels[id] || {};
          draft.vessels[id].includeBio = target.checked;
          scheduleSave();
          renderPreview();
        }
      });

      list.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        if (!target.classList.contains("cv-vessel-bullets")) return;
        const id = target.getAttribute("data-vessel-id");
        if (!id) return;
        draft.vessels[id] = draft.vessels[id] || {};
        draft.vessels[id].bullets = target.value;
        scheduleSave();
        renderPreview();
      });

      list.addEventListener("click", (event) => {
        const btn = event.target.closest(".cvgen-reset-vessel");
        if (!btn) return;
        const id = btn.getAttribute("data-vessel-id");
        if (!id) return;
        const source = getSource();
        const vessel = source.vessels.find((v) => v.id === id);
        if (!vessel) return;
        draft.vessels[id] = draft.vessels[id] || {};
        draft.vessels[id].bullets = window.SeavCvEngine.buildAutoBullets(
          vessel,
          source.onboard
        ).join("\n");
        scheduleSave();
        renderVesselEditor(source);
        renderPreview();
      });
    }
  }

  function refreshUi() {
    const source = getSource();
    bindControlsOnce();
    updateHint(source);
    syncEditorFields();
    renderVesselEditor(source);
    renderPreview();
    updateSaveStatus();
  }

  function initCvGenerator() {
    ensureDraft();
    refreshUi();

    document.addEventListener("seav:data-updated", () => {
      draft = window.SeavCvEngine.syncDraftWithSource(draft, getSource());
      scheduleSave();
      refreshUi();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.SeavState?.ready) {
      initCvGenerator();
    } else {
      document.addEventListener("seav:state-ready", initCvGenerator, { once: true });
    }
  });
})();
