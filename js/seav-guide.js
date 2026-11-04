// /js/seav-guide.js
// The getting-started guide for new crew (v602, Jack 2026-11-05: a guide for green
// crew that "you can skip" and it "just takes you to the dashboard"). Three short
// steps on the dashboard page. It opens by itself once for an account with nothing
// in it; the menu's "New here?" link (dashboard.html?guide=1) reopens it any time.
// All crew-typed text goes through Seav.escapeHtml.
(function () {
  "use strict";

  const SKIPPED_KEY = "seav_guide_skipped";
  const CERT_CODES = ["STCW BST", "ENG1"];
  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));
  const el = (id) => document.getElementById(id);
  const has = (value) => value !== undefined && value !== null && String(value).trim() !== "";

  const guide = { step: 1, first: "", last: "", rank: "", choice: "", yacht: "", yachtRole: "", from: "", certCode: "", expiry: "", saved: null };
  let active = false;
  let wired = false;
  let checked = false;

  function readSkipped() {
    try {
      return localStorage.getItem(SKIPPED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function rememberSkipped() {
    try {
      localStorage.setItem(SKIPPED_KEY, "1");
    } catch {
      // Private window: the guide may offer itself again next time.
    }
  }

  function isEmptyAccount() {
    const state = window.SeavState || {};
    const isSaved = window.SeavData?.isSavedCert || ((cert) => has(cert?.name));
    return !has(state.profile?.rank) &&
      !(state.vessels || []).length &&
      !(state.seatimes || []).length &&
      !(state.certs || []).filter(isSaved).length;
  }

  /* ---------- The CV beside the form: fills in as they type ---------- */
  function cvHtml() {
    const cert = guide.choice === "cert" && guide.certCode ? window.SeavData.findCertificateCatalogItem?.(guide.certCode) : null;
    const line = (title, sub) => `<strong class="guide-cv-line">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</strong>`;
    const empty = (text) => `<small class="guide-cv-empty">${esc(text)}</small>`;
    return `
      <div class="guide-cv" aria-label="Your CV so far">
        <div class="guide-cv-top">
          <div class="guide-cv-photo"><small>Add photo</small></div>
          <div class="guide-cv-who">
            <strong class="guide-cv-name">${esc([guide.first, guide.last].filter(Boolean).join(" ") || "Your name")}</strong>
            <small class="guide-cv-role">${esc(guide.rank || "Your role")}</small>
          </div>
        </div>
        <div class="guide-cv-body">
          <strong class="guide-cv-heading">Yachting experience</strong>
          ${guide.choice === "yacht" && guide.yacht ? line(guide.yacht, guide.yachtRole || guide.rank) : empty("Your yachts will show here")}
          <strong class="guide-cv-heading">Certificates</strong>
          ${cert ? line(cert.name) : empty("Your certificates will show here")}
          <strong class="guide-cv-heading">About me</strong>
          ${empty("A line or two about you")}
        </div>
      </div>`;
  }

  function refreshCv() {
    const slot = el("guideCv");
    if (slot) slot.innerHTML = cvHtml();
  }

  /* ---------- Steps ---------- */
  const skipButton = `<button type="button" class="guide-skip" data-guide-skip>Skip and go to my dashboard</button>`;

  function step1Html() {
    const options = window.SeavData.getPositionOptionsHtml?.(guide.rank, { placeholder: "Choose a role" }) || "";
    return `<form class="guide-form" novalidate>
        <div class="guide-two">
          <label>First name<input data-f="first" value="${esc(guide.first)}" autocomplete="given-name" /></label>
          <label>Last name<input data-f="last" value="${esc(guide.last)}" autocomplete="family-name" /></label>
        </div>
        <label>Your role on board, or the one you are after
          <select data-f="rank">${options}</select></label>
        <p class="guide-error" id="guideError" role="alert" hidden></p>
        <div class="guide-actions"><button type="submit" class="btn-blue">Continue</button>${skipButton}</div>
      </form>`;
  }

  function step2Html() {
    const option = (id, title, sub) => `<button type="button" class="guide-choice" data-choice="${id}" aria-pressed="${guide.choice === id}"><strong>${title}</strong><small>${sub}</small></button>`;
    const certs = CERT_CODES.map((code) => window.SeavData.findCertificateCatalogItem?.(code)).filter(Boolean);
    const extra = guide.choice === "yacht"
      ? `<div class="guide-two">
           <label>Yacht name<input data-f="yacht" value="${esc(guide.yacht)}" autocomplete="off" /></label>
           <label>Your role<input data-f="yachtRole" value="${esc(guide.yachtRole || guide.rank)}" autocomplete="off" /></label>
         </div>
         <label>When you joined<input type="date" data-f="from" value="${esc(guide.from)}" /></label>`
      : guide.choice === "cert"
        ? `<label>Certificate<select data-f="certCode"><option value="">Choose a certificate</option>
             ${certs.map((c) => `<option value="${esc(c.code)}" ${c.code === guide.certCode ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
           </select></label>
           <label>Expiry date, if it has one<input type="date" data-f="expiry" value="${esc(guide.expiry)}" /></label>
           <small class="guide-note">Got a different one? You can add any certificate from your dashboard.</small>`
        : "";
    return `<form class="guide-form" novalidate>
        <div class="guide-stack">
          ${option("yacht", "A yacht I have worked on", "Name, role and when you joined")}
          ${option("cert", "A certificate I hold", "Such as STCW Basic Safety or an ENG1")}
          ${option("none", "Nothing yet", "No problem. Your first course is usually STCW Basic Safety, and you will need an ENG1 medical.")}
        </div>
        ${extra}
        <p class="guide-error" id="guideError" role="alert" hidden></p>
        <div class="guide-actions">
          <button type="submit" class="btn-blue">Continue</button>
          <button type="button" class="btn-ghost2" data-guide-back>Back</button>
          ${skipButton}
        </div>
      </form>`;
  }

  function step3Html() {
    return `<strong class="guide-card-title">What to do next</strong>
      <ul class="guide-list">
        <li><strong>Add your certificates and yachts</strong><small>The buttons at the top of your dashboard open each form.</small></li>
        <li><strong>Log your sea time</strong><small>It is what your next certificate is built on.</small></li>
        <li><strong>Build your CV</strong><small>It fills itself in from what you add, ready to download or share.</small></li>
      </ul>
      <p class="guide-text">Your public profile stays off until you switch it on.</p>
      <div class="guide-actions"><button type="button" class="btn-blue" data-guide-done>Go to my dashboard</button></div>`;
  }

  function render() {
    const heads = {
      1: ["Let's start your yacht CV", "It takes a couple of minutes, and you can change anything later."],
      2: ["What can you add first?", "Just one thing for now. The rest can wait."],
      3: [`${guide.first || "Great"}, your CV has started`, "It will keep filling in as you add things."]
    };
    const [title, sub] = heads[guide.step];
    el("guideHead").innerHTML = `
      <div class="guide-steps" role="img" aria-label="Step ${guide.step} of 3">${[1, 2, 3].map((i) => `<i class="${i <= guide.step ? "is-on" : ""}"></i>`).join("")}</div>
      <h2>${esc(title)}</h2><p>${esc(sub)}</p>`;
    el("guideBody").innerHTML = { 1: step1Html, 2: step2Html, 3: step3Html }[guide.step]();
    refreshCv();
    if (guide.step === 1) el("guideBody").querySelector("input")?.focus();
  }

  function showError(message) {
    const box = el("guideError");
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  /* ---------- Saving ---------- */
  // Merged onto a FRESH read of the row, never on what the page happens to hold:
  // the profile save writes every column (the 2026-08-07 blank-form data loss).
  async function saveProfile() {
    const { KEYS } = window.SeavData;
    const fresh = await window.SeavAPI.get(KEYS.PROFILE, null);
    if (!fresh) throw new Error("Your profile could not be loaded. Refresh and try again.");
    const profile = {
      ...fresh,
      firstName: guide.first,
      lastName: guide.last,
      name: [guide.first, guide.last].filter(Boolean).join(" "),
      rank: guide.rank
    };
    await window.SeavAPI.save(KEYS.PROFILE, profile);
    window.SeavState?.updateProfile?.(profile);
  }

  async function saveRecord() {
    const { KEYS, createId, findCertificateCatalogItem } = window.SeavData;
    if (guide.choice === "yacht") {
      await window.SeavAPI.addItem(KEYS.VESSELS, {
        id: createId("vessel"),
        name: guide.yacht,
        vessel_role: guide.yachtRole || guide.rank,
        from: guide.from,
        to: ""
      });
    } else if (guide.choice === "cert") {
      const item = findCertificateCatalogItem(guide.certCode);
      await window.SeavAPI.addItem(KEYS.CERTS, {
        id: createId("cert"),
        code: item.code,
        name: item.name,
        expiry: guide.expiry,
        isMandatory: !!item.isMandatory,
        isTemplate: false,
        showOnCv: true
      });
    } else {
      return;
    }
    // A saved record must not be saved again if they go back and continue.
    guide.choice = "none";
    document.dispatchEvent(new CustomEvent("seav:data-updated"));
  }

  async function submit() {
    showError("");
    if (guide.step === 1) {
      if (!guide.first.trim() || !guide.rank) {
        showError("Add your first name and choose a role, or skip for now.");
        return;
      }
      guide.first = guide.first.trim();
      guide.last = guide.last.trim();
      await saveProfile();
      guide.step = 2;
    } else if (guide.step === 2) {
      if (guide.choice === "yacht" && !guide.yacht.trim()) {
        showError("Add the yacht's name, or choose Nothing yet.");
        return;
      }
      if (guide.choice === "cert" && !guide.certCode) {
        showError("Choose a certificate, or choose Nothing yet.");
        return;
      }
      guide.yacht = guide.yacht.trim();
      await saveRecord();
      guide.step = 3;
    }
    render();
  }

  /* ---------- Open and close ---------- */
  function show(open) {
    active = open;
    document.body.classList.toggle("seav-guide-open", open);
    el("guideShell").hidden = !open;
    el("dashboardShell").hidden = open;
  }

  function close() {
    rememberSkipped();
    show(false);
    window.scrollTo(0, 0);
  }

  function wire() {
    if (wired) return;
    wired = true;
    const root = el("guideShell");
    root.addEventListener("input", (event) => {
      const key = event.target.getAttribute?.("data-f");
      if (key) {
        guide[key] = event.target.value;
        refreshCv();
      }
    });
    root.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.target.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      try {
        await submit();
      } catch (err) {
        console.error("[SEA-V] Guide save failed:", err);
        showError(err?.message || "That didn't save. Check your connection and try again.");
      }
      if (button) button.disabled = false;
    });
    root.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-choice]");
      if (choice) {
        guide.choice = choice.getAttribute("data-choice");
        render();
      } else if (event.target.closest("[data-guide-back]")) {
        guide.step = 1;
        render();
      } else if (event.target.closest("[data-guide-skip], [data-guide-done]")) {
        close();
      }
    });
  }

  async function open() {
    let fresh = null;
    try {
      fresh = await window.SeavAPI.get(window.SeavData.KEYS.PROFILE, null);
    } catch (err) {
      console.warn("[SEA-V] Guide could not read the profile:", err);
    }
    if (!fresh) return;
    const parts = String(fresh.name || "").trim().split(/\s+/);
    Object.assign(guide, {
      step: 1,
      first: fresh.firstName || parts[0] || "",
      last: fresh.lastName || parts.slice(1).join(" ") || "",
      rank: fresh.rank || ""
    });
    wire();
    show(true);
    render();
  }

  // Called on every dashboard refresh. A failed load also looks empty, so a fresh
  // read of the profile must agree before the guide offers itself.
  async function check() {
    if (active || !el("guideShell")) return;

    const params = new URLSearchParams(window.location.search);
    if (params.has("guide")) {
      params.delete("guide");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
      await open();
      return;
    }

    if (checked || readSkipped() || !isEmptyAccount()) return;
    checked = true;
    const fresh = await window.SeavAPI.get(window.SeavData.KEYS.PROFILE, null).catch(() => null);
    if (!fresh || has(fresh.rank) || !isEmptyAccount()) return;
    await open();
  }


  window.SeavGuide = { check };
})();
