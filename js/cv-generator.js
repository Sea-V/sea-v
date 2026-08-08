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

  // Swatch colours for the visual template picker — one per CV_TEMPLATES id
  // (js/cv-engine-model.js), matching each colour scheme's own accent-2
  // value already defined in css/pages/cv-generator.css (.cv-color-*
  // .cv-seav-sidebar --cv-sidebar-accent-2). Presentational lookup only —
  // the actual template/colour-scheme logic lives entirely in the CV engine
  // files and is untouched here.
  const CV_TEMPLATE_SWATCHES = {
    seav: "#5bbcff",
    "ocean-blue": "#38b2ac",
    "simple-green": "#5c8a4d",
    "pearl-grey": "#3d4854",
    "night-watch": "#6f93b8"
  };

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

  // Mirrors js/profile.js's renderProfilePublicQr -- qrcodejs needs a
  // live DOM node to mount into, so the QR canvas can't be part of the
  // plain HTML string renderCvHtml() returns. Retries briefly if the
  // (deferred) library hasn't finished loading yet rather than leaving the
  // footer's mount div silently blank.
  function renderCvQrCode(url) {
    const host = document.getElementById("cvQrCode");
    if (!host || !url) return;

    if (typeof window.QRCode !== "function") {
      window.setTimeout(() => renderCvQrCode(url), 200);
      return;
    }

    host.innerHTML = "";
    new window.QRCode(host, {
      text: url,
      width: 132,
      height: 132,
      colorDark: "#0b1c2e",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }

  function updateQrHint(source) {
    const hint = document.getElementById("cvQrHint");
    if (!hint) return;
    const eligible = !!(source.profile?.username && source.profile?.publicEnabled);
    hint.textContent = eligible
      ? ""
      : "Needs your public profile enabled with a username (Dashboard → Public profile) to appear.";
  }

  function renderPreview() {
    const preview = document.getElementById("cvPreview");
    if (!preview || !draft) return;

    const source = getSource();
    const documentModel = window.SeavCvEngine.buildCvDocument(source, draft);
    // Single layout now — the colour scheme class lives on the inner
    // .cv-seav wrapper (added by renderSeav itself), not this outer one.
    preview.className = "cv-document cv-document--seav";
    preview.innerHTML = window.SeavCvEngine.renderCvHtml(documentModel);
    renderCvQrCode(documentModel.qrUrl);
    updateQrHint(source);
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
        const entry = draft.vessels[vessel.id] || { included: true, includeText: true, experienceText: "" };
        const role = window.SeavCvEngine.getVesselRole(vessel);
        const label = `${vessel.name || "Yacht"} · ${role || "Crew"}`;
        const includeText = entry.includeText !== false;
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
                class="cv-vessel-text-include"
                data-vessel-id="${Seav.escapeHtml(vessel.id)}"
                ${includeText ? "checked" : ""}
              />
              <span>Show experience notes on this CV</span>
            </label>
            <label class="cvgen-vessel-bullets-label">
              Vessel experience — tailor this for the employer you're sending this CV to
              <textarea
                class="cv-vessel-experience"
                data-vessel-id="${Seav.escapeHtml(vessel.id)}"
                rows="5"
                placeholder="Describe your role and responsibilities aboard this vessel."
              >${Seav.escapeHtml(entry.experienceText || "")}</textarea>
            </label>
            <button type="button" class="cvgen-reset-vessel btn-ghost2" data-vessel-id="${Seav.escapeHtml(
              vessel.id
            )}">
              Reset from SEA-V vessel record
            </button>
          </article>
        `;
      })
      .join("");
  }

  // Visual, colour-swatch proxy for the hidden native <select id="cvTemplateSelect">.
  // Built once from window.SeavCvEngine.CV_TEMPLATES (never redefines the
  // template list itself) and drives selection purely by setting the real
  // select's value + dispatching "change" -- the existing change listener
  // above (which owns draft.template, scheduleSave, renderPreview) is the
  // only thing that ever reacts to a template switch.
  function renderTemplatePicker() {
    const picker = document.getElementById("cvTemplatePicker");
    const templateSelect = document.getElementById("cvTemplateSelect");
    if (!picker || !templateSelect) return;

    picker.innerHTML = (window.SeavCvEngine.CV_TEMPLATES || [])
      .map((t) => {
        const swatch = CV_TEMPLATE_SWATCHES[t.id] || "#5bbcff";
        return `
          <button
            type="button"
            class="cvgen-template-option"
            role="radio"
            aria-checked="false"
            data-template-id="${Seav.escapeHtml(t.id)}"
            style="--tpl-color: ${swatch};"
          >
            <span class="cvgen-template-swatch" aria-hidden="true"></span>
            <span class="cvgen-template-option-label">${Seav.escapeHtml(t.label)}</span>
          </button>
        `;
      })
      .join("");

    picker.addEventListener("click", (event) => {
      const btn = event.target.closest(".cvgen-template-option");
      if (!btn || !picker.contains(btn)) return;
      const id = btn.getAttribute("data-template-id");
      if (!id || templateSelect.value === id) return;
      templateSelect.value = id;
      templateSelect.dispatchEvent(new Event("change"));
    });
  }

  function syncTemplatePicker() {
    const picker = document.getElementById("cvTemplatePicker");
    const templateSelect = document.getElementById("cvTemplateSelect");
    if (!picker || !templateSelect) return;
    const current = templateSelect.value;
    picker.querySelectorAll(".cvgen-template-option").forEach((btn) => {
      const isSelected = btn.getAttribute("data-template-id") === current;
      btn.classList.toggle("is-selected", isSelected);
      btn.setAttribute("aria-checked", isSelected ? "true" : "false");
    });
  }

  function syncEditorFields() {
    const summaryInput = document.getElementById("cvSummaryInput");
    const headlineInput = document.getElementById("cvHeadlineInput");
    const templateSelect = document.getElementById("cvTemplateSelect");

    if (summaryInput) summaryInput.value = draft.summary || "";
    if (headlineInput) headlineInput.value = draft.headline || "";
    if (templateSelect) templateSelect.value = draft.template || window.SeavCvEngine.CV_TEMPLATE;
    syncTemplatePicker();

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
    const templateSelect = document.getElementById("cvTemplateSelect");
    const resetBtn = document.getElementById("btnResetCvDraft");
    const printBtn = document.getElementById("btnPrintCv");
    const docxBtn = document.getElementById("btnExportCvDocx");
    const list = document.getElementById("cvVesselEditor");

    if (templateSelect) {
      templateSelect.innerHTML = (window.SeavCvEngine.CV_TEMPLATES || [])
        .map((t) => `<option value="${Seav.escapeHtml(t.id)}">${Seav.escapeHtml(t.label)}</option>`)
        .join("");
      templateSelect.addEventListener("change", () => {
        draft.template = templateSelect.value;
        scheduleSave();
        renderPreview();
        syncTemplatePicker();
      });
      renderTemplatePicker();
    }

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
        draft = window.SeavCvEngine.resetDraftFromSource(getSource(), draft?.template);
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

    if (docxBtn) {
      docxBtn.addEventListener("click", async () => {
        if (!window.SeavCvExportDocx) {
          Seav.notify("error", "Export unavailable", "Word export failed to load. Refresh the page and try again.");
          return;
        }
        docxBtn.disabled = true;
        const originalLabel = docxBtn.textContent;
        docxBtn.textContent = "Exporting…";
        try {
          draft = window.SeavCvEngine.saveDraft(draft);
          const source = getSource();
          const documentModel = window.SeavCvEngine.buildCvDocument(source, draft);
          await window.SeavCvExportDocx.exportCvAsDocx(documentModel);
          Seav.notify("success", "CV exported", "Word document downloaded.");
        } catch (err) {
          console.warn("[SEA-V] CV Word export failed:", err);
          Seav.notify("error", "Export failed", err?.message || "Could not create the Word document.");
        } finally {
          docxBtn.disabled = false;
          docxBtn.textContent = originalLabel;
        }
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

        if (target.classList.contains("cv-vessel-text-include")) {
          draft.vessels[id] = draft.vessels[id] || {};
          draft.vessels[id].includeText = target.checked;
          scheduleSave();
          renderPreview();
        }
      });

      list.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        if (!target.classList.contains("cv-vessel-experience")) return;
        const id = target.getAttribute("data-vessel-id");
        if (!id) return;
        draft.vessels[id] = draft.vessels[id] || {};
        draft.vessels[id].experienceText = target.value;
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
        draft.vessels[id].experienceText =
          window.SeavCvEngine.getVesselExperience(vessel) ||
          window.SeavCvEngine.buildAutoExperienceText(vessel, source.onboard);
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
