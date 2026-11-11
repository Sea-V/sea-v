// /js/seav-guide.js
// The getting-started guide for new crew (v602, Jack 2026-11-05: a guide for green
// crew that "you can skip" and it "just takes you to the dashboard"). Three short
// steps on the dashboard page. It opens by itself once for an account with nothing
// in it; the menu's "New here?" link (dashboard.html?guide=1) reopens it any time.
// All crew-typed text goes through Seav.escapeHtml.
(function () {
  "use strict";

  // Per account: a second person on this device should still be offered the guide.
  const skippedKey = () => `seav_guide_skipped:${window.SeavAuth?.getUserId?.() || "unknown"}`;
  const CERT_CODES = ["STCW BST", "ENG1"];
  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));
  const el = (id) => document.getElementById(id);
  const has = (value) => value !== undefined && value !== null && String(value).trim() !== "";

  // path: "yacht" or "green" (v637: "Have you worked on a yacht before?").
  const GUIDE_START = {
    step: 1, first: "", last: "", rank: "", path: "", choice: "", saved: "",
    yacht: "", directory: null, yachtRole: "", from: "", to: "", current: true,
    certCode: "", issued: "", expiry: "",
    landRole: "", landEmployer: "", landFrom: "", landTo: "", landCurrent: false, landQualities: [],
    skillTitle: "", skillCategory: "", skillIssuer: ""
  };
  const guide = { ...GUIDE_START };
  // The site's year / month / day selects, by the guide field each one fills.
  const DATE_FIELDS = { gd_from: "from", gd_to: "to", gd_issued: "issued", gd_expiry: "expiry", gd_land_from: "landFrom", gd_land_to: "landTo" };
  // Copied onto the crew member's record once, as the vessel form does.
  const DIRECTORY_FACTS = ["flag", "gt", "builder", "imo", "mmsi", "official_number", "call_sign", "vessel_type"];
  let active = false;
  let wired = false;
  let checked = false;

  function readSkipped() {
    try {
      return localStorage.getItem(skippedKey()) === "1";
    } catch {
      return false;
    }
  }

  function rememberSkipped() {
    try {
      localStorage.setItem(skippedKey(), "1");
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
    // After a save the choice resets to "none", so the CV reads what was saved too.
    const shown = guide.choice === "none" ? guide.saved : guide.choice;
    const cert = shown === "cert" && guide.certCode ? window.SeavData.findCertificateCatalogItem?.(guide.certCode) : null;
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
          ${guide.path === "green"
            ? `<strong class="guide-cv-heading">Experience ashore</strong>
               ${shown === "land" && guide.landRole ? line(guide.landRole, guide.landEmployer) : empty("Jobs ashore will show here")}
               <strong class="guide-cv-heading">Skills &amp; courses</strong>
               ${shown === "skill" && guide.skillTitle ? line(guide.skillTitle, guide.skillIssuer) : empty("Your skills will show here")}`
            : `<strong class="guide-cv-heading">Yachting experience</strong>
               ${shown === "yacht" && guide.yacht ? line(guide.yacht, guide.yachtRole || guide.rank) : empty("Your vessels will show here")}`}
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
        <fieldset class="guide-question">
          <legend>Have you worked on a vessel before?</legend>
          <div class="guide-stack">
            <button type="button" class="guide-choice" data-path="yacht" aria-pressed="${guide.path === "yacht"}"><strong>Yes</strong><small>Add your vessel, then your sea time and certificates.</small></button>
            <button type="button" class="guide-choice" data-path="green" aria-pressed="${guide.path === "green"}"><strong>Not yet</strong><small>We'll help you show what you bring from ashore, and what to get before your first job.</small></button>
          </div>
        </fieldset>
        <p class="guide-error" id="guideError" role="alert" hidden></p>
        <div class="guide-actions"><button type="submit" class="btn-blue">Continue</button>${skipButton}</div>
      </form>`;
  }

  function directoryNote() {
    const entry = guide.directory;
    if (!entry) return "";
    const facts = [entry.vessel_length ? `${entry.vessel_length} m` : "", entry.gt ? `${entry.gt} GT` : "", entry.flag].filter(Boolean).join(" · ");
    return `Found in the SEA-V vessel directory${facts ? `: ${facts}` : ""}. You can check the details later.`;
  }

  function certOptionsHtml() {
    const option = (cert) => `<option value="${esc(cert.code)}" ${cert.code === guide.certCode ? "selected" : ""}>${esc(cert.name)}</option>`;
    const common = CERT_CODES.map((code) => window.SeavData.findCertificateCatalogItem?.(code)).filter(Boolean);
    const groups = (window.SeavData.getCertificateCatalogGroups?.() || [])
      .map((group) => {
        const certs = (group.certs || []).filter((cert) => !CERT_CODES.includes(cert.code));
        return certs.length ? `<optgroup label="${esc(group.label)}">${certs.map(option).join("")}</optgroup>` : "";
      })
      .join("");
    return `<option value="">Choose a certificate</option><optgroup label="Most new crew hold these">${common.map(option).join("")}</optgroup>${groups}`;
  }

  function step2Html() {
    const option = (id, title, sub) => `<button type="button" class="guide-choice" data-choice="${id}" aria-pressed="${guide.choice === id}"><strong>${title}</strong><small>${sub}</small></button>`;
    const roles = window.SeavData.getPositionOptionsHtml?.(guide.yachtRole || guide.rank, { placeholder: "Choose a role" }) || "";
    const extra = guide.choice === "yacht"
      ? `<div class="vessel-finder">
           <label>Vessel name
             <input id="guideYachtName" data-f="yacht" value="${esc(guide.yacht)}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="guideYachtList" />
           </label>
           <ul class="vessel-finder-list" id="guideYachtList" role="listbox" aria-label="Vessels found" hidden></ul>
           <div class="vessel-finder-linked" id="guideYachtLinked" ${guide.directory ? "" : "hidden"}>
             <small id="guideYachtNote">${esc(directoryNote())}</small>
             <button type="button" class="vessel-finder-unlink" data-guide-unlink>Not this vessel</button>
           </div>
           <small class="guide-note">Start typing and pick your vessel if it is listed, or just type its name.</small>
         </div>
         <label>Your role<select data-f="yachtRole">${roles}</select></label>
         <div data-date-field="gd_from" data-date-label="When you joined"></div>
         <label class="guide-check"><input type="checkbox" data-guide-current ${guide.current ? "checked" : ""} /><span>I still work on this vessel</span></label>
         ${guide.current ? "" : `<div data-date-field="gd_to" data-date-label="When you left"></div>`}`
      : guide.choice === "cert"
        ? `<label>Certificate<select data-f="certCode">${certOptionsHtml()}</select></label>
           <div data-date-field="gd_issued" data-date-label="Date issued" data-date-optional></div>
           <div data-date-field="gd_expiry" data-date-label="Expiry date, if it has one" data-date-optional></div>`
        : "";
    return `<form class="guide-form" novalidate>
        <div class="guide-stack">
          ${option("yacht", "A vessel I have worked on", "Name, role and when you joined")}
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

  // v637 "Not yet": start from what they already have ashore.
  function greenStep2Html() {
    const option = (id, title, sub) => `<button type="button" class="guide-choice" data-choice="${id}" aria-pressed="${guide.choice === id}"><strong>${title}</strong><small>${sub}</small></button>`;
    const categories = (window.SeavData.SPECIALIST_QUALIFICATION_CATEGORIES || [])
      .map((cat) => `<option value="${esc(cat.value)}" ${cat.value === guide.skillCategory ? "selected" : ""}>${esc(cat.label)}</option>`)
      .join("");
    const extra = guide.choice === "land"
      ? `<label>Your role<input data-f="landRole" value="${esc(guide.landRole)}" placeholder="Head bartender" /></label>
         <label>Where<input data-f="landEmployer" value="${esc(guide.landEmployer)}" placeholder="The business and town" /></label>
         <div data-date-field="gd_land_from" data-date-label="When you started" data-date-optional></div>
         <label class="guide-check"><input type="checkbox" data-guide-land-current ${guide.landCurrent ? "checked" : ""} /><span>I still work here</span></label>
         ${guide.landCurrent ? "" : `<div data-date-field="gd_land_to" data-date-label="When you left" data-date-optional></div>`}
         <div class="guide-qualities">
           <strong class="guide-qualities-label">What it says about you <small>(pick up to 4)</small></strong>
           <div id="guideQualities"></div>
         </div>`
      : guide.choice === "skill"
        ? `<label>Skill or qualification<input data-f="skillTitle" value="${esc(guide.skillTitle)}" placeholder="PADI Open Water, First aid at work…" /></label>
           <label>Kind<select data-f="skillCategory"><option value="">Choose one</option>${categories}</select></label>
           <label>Issued by <small class="guide-note">(optional)</small><input data-f="skillIssuer" value="${esc(guide.skillIssuer)}" placeholder="PADI, St John Ambulance…" /></label>`
        : guide.choice === "cert"
          ? `<label>Certificate<select data-f="certCode">${certOptionsHtml()}</select></label>
             <div data-date-field="gd_issued" data-date-label="Date issued" data-date-optional></div>
             <div data-date-field="gd_expiry" data-date-label="Expiry date, if it has one" data-date-optional></div>`
          : "";
    return `<form class="guide-form" novalidate>
        <div class="guide-stack">
          ${option("land", "A job ashore", "Bar, restaurant, hotel, building site, a ski season… anything with long hours and a team.")}
          ${option("skill", "A skill or qualification", "Diving, first aid, a chef or barista course, hairdressing, a trade.")}
          ${option("cert", "A yachting certificate", "STCW Basic Safety, ENG1 medical, Powerboat Level 2.")}
          ${option("none", "Nothing yet", "That's fine. Your first steps are on the next page.")}
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

  // The same seven steps as the dashboard's "Your first yacht" card.
  function greenStep3Html() {
    const state = window.SeavState || {};
    const ready = window.SeavData.computeFirstYachtReadiness?.({
      profile: state.profile || {},
      certs: (state.certs || []).filter((cert) => window.SeavData.isSavedCert?.(cert) ?? !!cert?.name),
      landExperiences: state.landExperiences || [],
      specialistQualifications: state.specialistQualifications || [],
      hobbiesInterests: state.hobbiesInterests || []
    }) || { rows: [] };
    const rows = ready.rows
      .map((row) => `<li class="guide-path-row${row.done ? " is-done" : ""}"><span class="guide-path-mark" aria-hidden="true">${row.done ? "✓" : ""}</span><span><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></span>${row.done ? `<span class="dash-sr-only">Done</span>` : ""}</li>`)
      .join("");
    return `<ul class="guide-list guide-path">${rows}</ul>
      <p class="guide-text">Every step is on your dashboard, and ticks itself off as you add things. Crew 101 in the menu explains each certificate.</p>
      <div class="guide-actions"><button type="button" class="btn-blue" data-guide-done>Go to my dashboard</button></div>`;
  }

  function step3Html() {
    return `<strong class="guide-card-title">What to do next</strong>
      <ul class="guide-list">
        <li><strong>Add your certificates and vessels</strong><small>The + Add button at the top opens each form.</small></li>
        <li><strong>Log your sea time</strong><small>It is what your next certificate is built on. + Add opens this too.</small></li>
        <li><strong>Read Crew 101</strong><small>What to bring, knots, etiquette and the rules. It is in the menu.</small></li>
        <li><strong>Build your CV</strong><small>It fills itself in from what you add. Find it under your photo, top right.</small></li>
      </ul>
      <p class="guide-text">Your public profile stays off until you switch it on.</p>
      <div class="guide-actions"><button type="button" class="btn-blue" data-guide-done>Go to my dashboard</button></div>`;
  }

  function render() {
    const green = guide.path === "green";
    const heads = {
      1: ["Let's start your CV", "It takes a couple of minutes, and you can change anything later."],
      2: green
        ? ["Start with what you already have", "Captains hire people. Jobs, skills and courses from ashore all count."]
        : ["What can you add first?", "Just one thing for now. The rest can wait."],
      3: green
        ? ["Your path to a first vessel", `${guide.first || "Great"}, here is what gets you hired.`]
        : [`${guide.first || "Great"}, your CV has started`, "It will keep filling in as you add things."]
    };
    const [title, sub] = heads[guide.step];
    el("guideHead").innerHTML = `
      <div class="guide-steps" role="img" aria-label="Step ${guide.step} of 3">${[1, 2, 3].map((i) => `<i class="${i <= guide.step ? "is-on" : ""}"></i>`).join("")}</div>
      <h2>${esc(title)}</h2><p>${esc(sub)}</p>`;
    el("guideBody").innerHTML = (green
      ? { 1: step1Html, 2: greenStep2Html, 3: greenStep3Html }
      : { 1: step1Html, 2: step2Html, 3: step3Html })[guide.step]();
    window.Seav.mountDateFields(el("guideBody"));
    const picker = el("guideQualities");
    if (picker) window.SeavQualities?.mountPicker(picker, guide.landQualities);
    Object.entries(DATE_FIELDS).forEach(([prefix, field]) => window.Seav.fillDateTriplet(prefix, guide[field]));
    refreshCv();
    if (guide.step === 1) el("guideBody").querySelector("input")?.focus();
    wireYachtSearch();
  }

  function refreshDirectoryNote() {
    const row = el("guideYachtLinked");
    if (!row) return;
    row.hidden = !guide.directory;
    el("guideYachtNote").textContent = directoryNote();
  }

  function wireYachtSearch() {
    const input = el("guideYachtName");
    if (!input) return;
    window.SeavVesselFinder?.attachYachtSearch({
      input,
      list: el("guideYachtList"),
      emptyMessage: "Not in the directory yet. Just type your vessel's name.",
      onChoose: (entry) => {
        guide.yacht = entry.name;
        guide.directory = entry;
        input.value = entry.name;
        refreshDirectoryNote();
        refreshCv();
      }
    });
  }

  // Keeps what was picked when the form redraws. A half-finished date stays as "".
  function keepDates() {
    Object.entries(DATE_FIELDS).forEach(([prefix, field]) => {
      if (el(`${prefix}_year`)) guide[field] = window.Seav.readDateTriplet(prefix);
    });
  }

  // The year starts on this year, so only a month or day shows someone began a
  // date. Without this a half-finished date would silently save as nothing, and
  // 31 February would save as written.
  function dateProblem(prefix, label) {
    const month = el(`${prefix}_month`)?.value;
    const day = el(`${prefix}_day`)?.value;
    if (!month && !day) return "";
    const iso = window.Seav.readDateTriplet(prefix);
    const parsed = iso ? new Date(`${iso}T00:00:00Z`) : null;
    if (!iso) return `Finish ${label}: pick the year, month and day.`;
    return parsed.toISOString().slice(0, 10) === iso ? "" : `${label} isn't a real date. Check the day.`;
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
      const entry = guide.directory;
      const facts = entry
        ? {
            ...Object.fromEntries(DIRECTORY_FACTS.map((field) => [field, entry[field] || ""])),
            vessel_length: Number.isNaN(Number(entry.vessel_length)) ? "" : entry.vessel_length || "",
            year_built: Number.isNaN(Number(entry.year_built)) ? "" : entry.year_built || "",
            directory_id: entry.id
          }
        : {};
      await window.SeavAPI.addItem(KEYS.VESSELS, {
        ...facts,
        id: createId("vessel"),
        name: guide.yacht,
        vessel_role: guide.yachtRole || guide.rank,
        from: guide.from,
        to: guide.current ? "" : guide.to
      });
    } else if (guide.choice === "cert") {
      const item = findCertificateCatalogItem(guide.certCode);
      await window.SeavAPI.addItem(KEYS.CERTS, {
        id: createId("cert"),
        code: item.code,
        name: item.name,
        issued: guide.issued,
        expiry: guide.expiry,
        isMandatory: !!item.isMandatory,
        isTemplate: false,
        showOnCv: true
      });
    } else if (guide.choice === "land") {
      await window.SeavAPI.addItem(KEYS.LAND_EXPERIENCES, {
        id: createId("land"),
        role: guide.landRole,
        employer: guide.landEmployer,
        dateFrom: guide.landFrom,
        dateTo: guide.landCurrent ? "" : guide.landTo,
        isCurrent: guide.landCurrent,
        qualities: guide.landQualities
      });
    } else if (guide.choice === "skill") {
      await window.SeavAPI.addItem(KEYS.SPECIALIST_QUALIFICATIONS, {
        id: createId("specialist"),
        title: guide.skillTitle,
        category: guide.skillCategory || "other",
        issuingBody: guide.skillIssuer,
        status: "Self-declared"
      });
    } else {
      return;
    }
    // A saved record must not be saved again if they go back and continue.
    guide.saved = guide.choice;
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
      if (!guide.path) {
        showError("Say whether you have worked on a vessel before.");
        return;
      }
      guide.first = guide.first.trim();
      guide.last = guide.last.trim();
      await saveProfile();
      guide.step = 2;
    } else if (guide.step === 2) {
      if (guide.choice === "yacht" && !guide.yacht.trim()) {
        showError("Add the vessel's name, or choose Nothing yet.");
        return;
      }
      if (guide.choice === "cert" && !guide.certCode) {
        showError("Choose a certificate, or choose Nothing yet.");
        return;
      }
      if (guide.choice === "land" && !guide.landRole.trim()) {
        showError("Add your role, or choose Nothing yet.");
        return;
      }
      if (guide.choice === "skill" && !guide.skillTitle.trim()) {
        showError("Add the skill or qualification, or choose Nothing yet.");
        return;
      }
      guide.landRole = guide.landRole.trim();
      guide.landEmployer = guide.landEmployer.trim();
      guide.skillTitle = guide.skillTitle.trim();
      guide.skillIssuer = guide.skillIssuer.trim();
      guide.yacht = guide.yacht.trim();
      const problem =
        guide.choice === "yacht"
          ? dateProblem("gd_from", "When you joined") || dateProblem("gd_to", "When you left")
          : guide.choice === "cert"
            ? dateProblem("gd_issued", "Date issued") || dateProblem("gd_expiry", "Expiry date")
            : guide.choice === "land"
              ? dateProblem("gd_land_from", "When you started") || dateProblem("gd_land_to", "When you left")
              : "";
      if (problem) {
        showError(problem);
        return;
      }
      keepDates();
      if (guide.choice === "yacht" && !guide.from) {
        showError("Add the month and day you joined, or choose Nothing yet.");
        return;
      }
      if (guide.choice === "yacht" && !guide.current && (!guide.to || guide.to < guide.from)) {
        showError(guide.to ? "When you left must be after you joined." : "Add when you left, or tick I still work on this vessel.");
        return;
      }
      if (guide.choice === "land" && !guide.landCurrent && guide.landFrom && guide.landTo && guide.landTo < guide.landFrom) {
        showError("When you left must be after you started.");
        return;
      }
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
      if (event.target.id === "guideQualities") {
        guide.landQualities = window.SeavQualities?.readPicker(event.target) || [];
        return;
      }
      const key = event.target.getAttribute?.("data-f");
      if (key) {
        guide[key] = event.target.value;
        // A changed name is no longer the yacht they picked from the directory.
        if (key === "yacht" && guide.directory) {
          guide.directory = null;
          refreshDirectoryNote();
        }
        refreshCv();
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches?.("[data-guide-current]")) {
        keepDates();
        guide.current = event.target.checked;
        render();
      } else if (event.target.matches?.("[data-guide-land-current]")) {
        keepDates();
        guide.landCurrent = event.target.checked;
        render();
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
      const path = event.target.closest("[data-path]");
      if (path) {
        guide.path = path.getAttribute("data-path");
        // A choice made on the other path does not carry over.
        guide.choice = "";
        root.querySelectorAll("[data-path]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn === path)));
        refreshCv();
        return;
      }
      const choice = event.target.closest("[data-choice]");
      if (choice) {
        keepDates();
        guide.choice = choice.getAttribute("data-choice");
        render();
      } else if (event.target.closest("[data-guide-unlink]")) {
        guide.directory = null;
        refreshDirectoryNote();
      } else if (event.target.closest("[data-guide-back]")) {
        keepDates();
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
    Object.assign(guide, GUIDE_START, {
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
