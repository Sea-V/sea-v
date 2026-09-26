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

    const templates = window.SeavCvEngine.CV_TEMPLATES || [];
    const swatchFor = (id) => CV_TEMPLATE_SWATCHES[id] || "#5bbcff";

    // 2026-09-26, per Jack: a dropdown instead of five stacked rows. A
    // native <option> cannot draw the colour circle, so this is a small
    // WAI-ARIA listbox: a button that opens a list, focus stays on the
    // list (aria-activedescendant) while arrow keys move the highlight.
    picker.innerHTML = `
      <button type="button" class="cvgen-template-trigger" id="cvTemplateTrigger"
              aria-haspopup="listbox" aria-expanded="false"
              aria-controls="cvTemplateMenu" aria-labelledby="cvTemplateLabel cvTemplateTrigger">
        <span class="cvgen-template-swatch" aria-hidden="true"></span>
        <span class="cvgen-template-trigger-label"></span>
      </button>
      <ul class="cvgen-template-menu" id="cvTemplateMenu" role="listbox"
          tabindex="-1" aria-labelledby="cvTemplateLabel" hidden>
        ${templates
          .map(
            (t) => `
          <li class="cvgen-template-option" role="option" aria-selected="false"
              id="cvTemplateOption-${Seav.escapeHtml(t.id)}"
              data-template-id="${Seav.escapeHtml(t.id)}"
              style="--tpl-color: ${swatchFor(t.id)};">
            <span class="cvgen-template-swatch" aria-hidden="true"></span>
            <span class="cvgen-template-option-label">${Seav.escapeHtml(t.label)}</span>
            <svg class="cvgen-template-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </li>`
          )
          .join("")}
      </ul>
    `;

    const trigger = picker.querySelector(".cvgen-template-trigger");
    const menu = picker.querySelector(".cvgen-template-menu");
    const options = () => Array.from(menu.querySelectorAll(".cvgen-template-option"));

    const setActive = (option) => {
      options().forEach((o) => o.classList.toggle("is-active", o === option));
      if (option) {
        menu.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      } else {
        menu.removeAttribute("aria-activedescendant");
      }
    };

    const isOpen = () => !menu.hidden;

    const open = () => {
      if (isOpen()) return;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      setActive(options().find((o) => o.dataset.templateId === templateSelect.value) || options()[0]);
      menu.focus();
    };

    const close = ({ restoreFocus = true } = {}) => {
      if (!isOpen()) return;
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      setActive(null);
      if (restoreFocus) trigger.focus();
    };

    const choose = (option) => {
      const id = option?.dataset.templateId;
      close();
      if (!id || templateSelect.value === id) return;
      templateSelect.value = id;
      templateSelect.dispatchEvent(new Event("change"));
    };

    const move = (step) => {
      const list = options();
      const current = list.findIndex((o) => o.classList.contains("is-active"));
      const next = Math.min(list.length - 1, Math.max(0, current + step));
      setActive(list[next]);
    };

    // Safari does not focus a button on click, so without this a click on
    // the trigger while open would blur the list (closing it via focusout)
    // and then reopen it on click. open() moves focus to the list anyway.
    trigger.addEventListener("mousedown", (event) => event.preventDefault());
    trigger.addEventListener("click", () => (isOpen() ? close() : open()));
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        open();
      }
    });

    menu.addEventListener("keydown", (event) => {
      const list = options();
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          move(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          move(-1);
          break;
        case "Home":
          event.preventDefault();
          setActive(list[0]);
          break;
        case "End":
          event.preventDefault();
          setActive(list[list.length - 1]);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          choose(list.find((o) => o.classList.contains("is-active")));
          break;
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "Tab":
          close({ restoreFocus: false });
          break;
        default:
          break;
      }
    });

    menu.addEventListener("mousemove", (event) => {
      const option = event.target.closest(".cvgen-template-option");
      if (option && !option.classList.contains("is-active")) setActive(option);
    });
    // mousedown, not click: keeps focus from leaving the list (which would
    // fire the focusout close below before the click lands).
    menu.addEventListener("mousedown", (event) => {
      const option = event.target.closest(".cvgen-template-option");
      if (!option) return;
      event.preventDefault();
      choose(option);
    });

    picker.addEventListener("focusout", (event) => {
      if (!picker.contains(event.relatedTarget)) close({ restoreFocus: false });
    });
    document.addEventListener("mousedown", (event) => {
      if (isOpen() && !picker.contains(event.target)) close({ restoreFocus: false });
    });
  }

  function syncTemplatePicker() {
    const picker = document.getElementById("cvTemplatePicker");
    const templateSelect = document.getElementById("cvTemplateSelect");
    if (!picker || !templateSelect) return;

    const current = templateSelect.value;
    const template = (window.SeavCvEngine.CV_TEMPLATES || []).find((t) => t.id === current);
    const trigger = picker.querySelector(".cvgen-template-trigger");
    if (trigger) {
      trigger.style.setProperty("--tpl-color", CV_TEMPLATE_SWATCHES[current] || "#5bbcff");
      const label = trigger.querySelector(".cvgen-template-trigger-label");
      if (label) label.textContent = template?.label || "";
    }

    picker.querySelectorAll(".cvgen-template-option").forEach((option) => {
      option.setAttribute(
        "aria-selected",
        option.getAttribute("data-template-id") === current ? "true" : "false"
      );
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

  // Collapsible settings panel + fit-to-width preview (2026-09-26, per
  // Jack). Pure layout: nothing here touches the draft, the CV model or
  // the export paths. See the matching block in css/pages/cv-generator.css.
  const EDITOR_COLLAPSED_KEY = "seav_cvgen_editor_collapsed";
  // .cv-document is `width: 210mm`; CSS fixes 1in = 96px = 25.4mm.
  const A4_WIDTH_PX = (210 * 96) / 25.4;
  // Below 0.6 the text is unreadable, so the frame's existing horizontal
  // scroll takes over; above 1.6 a wide monitor just gets a comically big page.
  const PREVIEW_ZOOM_MIN = 0.6;
  const PREVIEW_ZOOM_MAX = 1.6;
  // Matches the stylesheet: <=1100px the workspace stacks (no collapse),
  // <=900px the CV document is already fluid (width: 100%, no zoom needed).
  const STACKED_QUERY = window.matchMedia("(max-width: 1100px)");
  const FLUID_QUERY = window.matchMedia("(max-width: 900px)");
  const ZOOM_SUPPORTED = !!(window.CSS?.supports && window.CSS.supports("zoom", "2"));

  function readEditorCollapsedPref() {
    try {
      return window.localStorage.getItem(EDITOR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeEditorCollapsedPref(collapsed) {
    try {
      window.localStorage.setItem(EDITOR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage blocked (private window etc.) -- the toggle still works for this visit.
    }
  }

  function setEditorCollapsed(collapsed) {
    const workspace = document.querySelector(".cvgen-workspace");
    const toggle = document.getElementById("btnToggleCvEditor");
    if (!workspace || !toggle) return;

    workspace.classList.toggle("is-editor-collapsed", collapsed);
    const label = collapsed ? "Show CV settings" : "Hide CV settings";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    const text = toggle.querySelector(".cvgen-editor-toggle-label");
    if (text) text.textContent = collapsed ? "Show settings" : "Hide settings";
  }

  function fitPreviewToFrame() {
    const frame = document.querySelector(".cvgen-preview-frame");
    const preview = document.getElementById("cvPreview");
    if (!frame || !preview) return;

    if (!ZOOM_SUPPORTED || FLUID_QUERY.matches) {
      preview.style.removeProperty("--cv-preview-zoom");
      return;
    }

    const styles = window.getComputedStyle(frame);
    const available =
      frame.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    // Floor to 1% and keep a pixel spare so rounding can never tip the page
    // wider than the frame and flash a horizontal scrollbar (which would
    // narrow the frame and re-trigger the observer).
    const fit = Math.floor(((available - 1) / A4_WIDTH_PX) * 100) / 100;
    const zoom = Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, fit));
    preview.style.setProperty("--cv-preview-zoom", String(zoom));
  }

  function initWorkspaceLayout() {
    const toggle = document.getElementById("btnToggleCvEditor");
    const frame = document.querySelector(".cvgen-preview-frame");

    setEditorCollapsed(readEditorCollapsedPref());

    if (toggle) {
      toggle.addEventListener("click", () => {
        const collapsed = !document
          .querySelector(".cvgen-workspace")
          ?.classList.contains("is-editor-collapsed");
        setEditorCollapsed(collapsed);
        writeEditorCollapsedPref(collapsed);
        // Collapsing moves the toggle to the rail; keep focus on it so a
        // keyboard user can reopen the panel straight away.
        toggle.focus();
      });
    }

    if (frame && typeof window.ResizeObserver === "function") {
      let pending = 0;
      new window.ResizeObserver(() => {
        // Defer to the next frame: setting the zoom inside the callback
        // resizes the frame's height, which otherwise logs a benign
        // "ResizeObserver loop" warning on every change.
        window.cancelAnimationFrame(pending);
        pending = window.requestAnimationFrame(fitPreviewToFrame);
      }).observe(frame);
    } else {
      window.addEventListener("resize", fitPreviewToFrame);
    }

    // The stacked (<=1100px) layout ignores the collapsed class in CSS, so
    // only the fit needs recomputing when the breakpoints flip.
    STACKED_QUERY.addEventListener?.("change", fitPreviewToFrame);
    FLUID_QUERY.addEventListener?.("change", fitPreviewToFrame);
    fitPreviewToFrame();
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
    initWorkspaceLayout();
    if (window.SeavState?.ready) {
      initCvGenerator();
    } else {
      document.addEventListener("seav:state-ready", initCvGenerator, { once: true });
    }
  });
})();
