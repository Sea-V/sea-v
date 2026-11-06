// /js/cv-upload.js — "Upload my CV" (v625, Jack 2026-11-06). Plan and test results:
// docs/product/cv-upload-plan-2026-11-05.md. Mockup he approved: design-concepts/cv-upload/.
// The edge function reads the file; this page shows what it found, and only what is
// ticked gets saved, through the same save code as the normal forms. Everything from
// the CV is untrusted text, so it is escaped, and role and certificate codes are
// checked against SEA-V's own lists.
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData) {
    console.error("[SEA-V] CV upload: core scripts missing.");
    return;
  }

  const esc = window.Seav.escapeHtml;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const HANDOFF_KEY = "seav_cv_handoff";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const READ_ERRORS = {
    not_set_up: "The CV reader isn't switched on yet. Nothing was saved.",
    not_open: "This isn't open yet. Nothing was saved.",
    limit: "You've used today's CV reads. Try again tomorrow. Nothing was saved.",
    too_big: "That file is too big. Try one under 10 MB. Nothing was saved.",
    not_a_cv: "That doesn't look like a CV. Nothing was saved.",
    signin: "Please sign in again, then try once more.",
    cannot_read: "We couldn't read that file. It may be password protected or a poor scan. Try another copy, or add your yachts by hand. Nothing was saved."
  };
  const ICON = (d) => `<span class="dash-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="${d}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  const ICONS = {
    yacht: "M3 17h18l-2 4H5l-2-4ZM12 3v11M12 4l6 8h-6",
    cert: "M6 3h9l4 4v14H6V3ZM14 3v5h5M9 13h7M9 17h7",
    me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0",
    heart: "M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z",
    out: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM6 6l12 12",
    file: "M6 3h9l4 4v14H6V3ZM14 3v5h5"
  };
  const head = (icon, title, extra = "") =>
    `<div class="dash-panel-head"><span class="dash-panel-heading">${ICON(icon)}<h3 class="dash-panel-title">${esc(title)}</h3></span>${extra}</div>`;

  const positionList = () => window.SeavData.SEAFARER_POSITIONS.flatMap((group) => group.roles.map((role) => role.label));
  const catalogList = () => window.SeavData.getCertificateCatalog().map((item) => ({ code: item.code, name: item.name }));

  let view = { step: "upload" };
  let check = null;
  let done = null;

  /* ---------- Reading the file ---------- */

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("cannot_read"));
      reader.readAsDataURL(file);
    });
  }

  // The words of a Word file, so only text is sent. Text boxes appear twice in the
  // file, once as a fallback for old software, which is dropped.
  async function wordText(file) {
    const JSZip = await window.SeavAuth.loadJsZip();
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file("word/document.xml");
    if (!entry) throw new Error("cannot_read");
    const xml = (await entry.async("string")).replace(/<mc:Fallback[\s\S]*?<\/mc:Fallback>/g, "");
    const decode = document.createElement("textarea");
    return xml
      .split(/<\/w:p>/)
      .map((para) =>
        para
          .replace(/<w:(br|cr)\b[^>]*\/>/g, "<w:t>\n</w:t>")
          .replace(/<w:tab\b[^>]*\/>/g, "<w:t> </w:t>")
          .match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)
          ?.map((run) => run.replace(/<[^>]+>/g, ""))
          .join("") || ""
      )
      .filter((line) => line.trim())
      .map((line) => {
        decode.innerHTML = line;
        return decode.value;
      })
      .join("\n");
  }

  async function readFile(file) {
    const isPdf = /\.pdf$/i.test(file.name);
    const isWord = /\.docx$/i.test(file.name);
    if (!isPdf && !isWord) return showError("Please use a PDF or a Word (.docx) file. Nothing was saved.");
    if (file.size > MAX_FILE_BYTES) return showError(READ_ERRORS.too_big);
    view = { step: "reading", fileName: file.name };
    render();
    try {
      const content = isPdf ? await toBase64(file) : await wordText(file);
      const result = await window.SeavAPI.readCv({
        kind: isPdf ? "pdf" : "word",
        file: content,
        positions: positionList(),
        catalog: catalogList()
      });
      check = await buildCheck(result);
      view = { step: "check" };
    } catch (err) {
      console.warn("[SEA-V] CV read failed:", err?.code || "unknown");
      return showError(READ_ERRORS[err?.code] || READ_ERRORS.cannot_read);
    }
    window.scrollTo(0, 0);
    render();
  }

  function showError(message) {
    view = { step: "upload", error: message };
    render();
  }

  /* ---------- Turning the result into something to check ---------- */

  const clean = (value) => String(value ?? "").trim();
  const yearMonth = (value) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(clean(value)) ? clean(value) : "");
  const prettyMonth = (value) => (value ? `${MONTHS[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : "Not given");
  const sameName = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
  const monthsApart = (from, to) =>
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));

  // A promotion with no gap is one record, with each role kept. Going elsewhere and
  // coming back is a new record: one vessel has one date range.
  function buildRecords(jobs) {
    const positions = new Set(positionList());
    const roles = (jobs || [])
      .filter((job) => clean(job?.yacht))
      .map((job) => ({
        yacht: clean(job.yacht),
        cv: clean(job.role_as_written),
        role: positions.has(job.role_match) ? job.role_match : "",
        from: yearMonth(job.from),
        to: job.is_present ? "" : yearMonth(job.to),
        present: !!job.is_present,
        length: clean(job.length_m),
        builder: clean(job.builder),
        year: clean(job.year_built),
        program: clean(job.program),
        duties: clean(job.duties)
      }))
      .sort((a, b) => a.from.localeCompare(b.from));

    const records = [];
    roles.forEach((job) => {
      const last = records[records.length - 1];
      const lastRole = last?.roles[last.roles.length - 1];
      if (last && sameName(last.name, job.yacht) && lastRole.to && job.from && monthsApart(lastRole.to, job.from) <= 1) {
        last.roles.push(job);
      } else {
        records.push({ id: `y${records.length}`, name: job.yacht, roles: [job] });
      }
    });
    return records.reverse();
  }

  async function findDirectoryMatches(records) {
    const names = [...new Set(records.map((record) => record.name.toLowerCase()))];
    const found = {};
    await Promise.all(names.map(async (name) => {
      try {
        const rows = await window.SeavAPI.searchVesselDirectory(name);
        const exact = rows.filter((row) => sameName(row.name, name));
        if (exact.length === 1) found[name] = exact[0];
      } catch (err) {
        console.warn("[SEA-V] Yacht directory search failed:", err);
      }
    }));
    return found;
  }

  async function buildCheck(result) {
    const state = window.SeavState || {};
    const { findCertificateCatalogItem, DEFAULT_PROFILE } = window.SeavData;
    const records = buildRecords(result.jobs);
    const matches = await findDirectoryMatches(records);
    const vessels = state.vessels || [];

    records.forEach((record) => {
      const newest = record.roles[record.roles.length - 1];
      const first = record.roles[0];
      const lengths = [...new Set(record.roles.map((role) => role.length).filter(Boolean))];
      record.name = newest.yacht;
      record.on = true;
      record.length = newest.length;
      record.lengths = lengths;
      record.builder = newest.builder;
      record.year = newest.year;
      record.program = newest.program;
      record.duties = record.roles.length > 1
        ? [...record.roles].reverse().map((role) => `${role.cv}, ${prettyMonth(role.from)} to ${role.present ? "present" : prettyMonth(role.to)}\n${role.duties}`).join("\n\n")
        : newest.duties;
      record.match = matches[record.name.toLowerCase()] || null;
      record.answer = "";
      record.chosen = null;
      record.already = vessels.find((vessel) => sameName(vessel.name, record.name) && String(vessel.from || "").slice(0, 7) === first.from);
      if (record.already) record.on = false;
      // No end date means "still there", so a gap here would make it the current yacht.
      record.noDates = !first.from || (!newest.present && !newest.to);
      if (record.noDates) record.on = false;
    });

    const certs = state.certs || [];
    const haveCode = (code) => certs.some((cert) => cert.code === code);
    const haveName = (name) => certs.some((cert) => sameName(cert.name, name));
    const certRows = (result.certificates || []).filter((row) => clean(row?.line)).map((row, index) => {
      const items = (row.codes || []).map((code) => findCertificateCatalogItem(code)).filter(Boolean);
      const already = items.length ? items.every((item) => haveCode(item.code)) : haveName(row.line);
      return {
        id: `c${index}`,
        line: clean(row.line),
        kind: row.kind,
        items,
        expiry: yearMonth(row.expiry),
        why: clean(row.why),
        already,
        on: row.kind !== "not_a_certificate" && !already,
        choice: ""
      };
    });
    // Questions first, so the quick ticks are not in the way.
    certRows.sort((a, b) => (a.kind === "unclear" ? 0 : 1) - (b.kind === "unclear" ? 0 : 1));

    const profile = state.profile || {};
    const loaded = profile.id && profile.id !== DEFAULT_PROFILE.id;
    const given = result.profile || {};
    const visas = (given.visas || []).filter((visa) => clean(visa?.country));
    const fields = [
      ["rank", "Rank", clean(given.rank)],
      ["location", "Location", clean(given.location)],
      ["nationality", "Nationality", clean(given.nationality)],
      ["passportsHeld", "Passports", (given.passports || []).map(clean).filter(Boolean).join(", ")],
      ["visasHeld", "Visas", visas.map((visa) => clean(visa.country)).join(", ")],
      ["bio", "Career overview", clean(given.overview)]
    ].filter(([, , value]) => value).map(([key, label, value]) => ({
      key,
      label,
      value,
      kept: !!clean(profile[key]) || !loaded,
      on: !clean(profile[key]) && loaded
    }));
    const expiredVisas = visas.filter((visa) => {
      const month = yearMonth(visa.expiry);
      return month && window.SeavData.parseDateOnly(`${month}-01`) < new Date();
    }).map((visa) => clean(visa.country));

    const existingInterests = state.hobbiesInterests || [];
    const interests = [...new Set((result.interests || []).map(clean).filter(Boolean))].map((title) => {
      const already = existingInterests.some((row) => sameName(row.title, title));
      return { title, already, on: !already };
    });

    return { records, certs: certRows, fields, expiredVisas, interests, referees: Number(result.referee_count) || 0, useFirst: false, tried: false };
  }

  /* ---------- Asking ---------- */

  const needsDay = (record) => record.on && record.roles.some((role) => (role.from && !role.fromDay) || (role.to && !role.toDay));
  const openRecord = (record) => record.open || record.roles.some((role) => !role.role) || (record.match && !record.answer) || record.lengths.length > 1;

  function questionsLeft() {
    let count = 0;
    if (!check.useFirst && check.records.some(needsDay)) count += 1;
    check.records.filter((record) => record.on).forEach((record) => {
      count += record.roles.filter((role) => !role.role).length;
      if (record.match && !record.answer) count += 1;
    });
    count += check.certs.filter((cert) => cert.on && cert.kind === "unclear" && !cert.choice).length;
    return count;
  }

  /* ---------- Saving ---------- */

  const pad = (n) => String(n).padStart(2, "0");
  const fullDate = (month, day, useFirst) => (month ? `${month}-${pad(day || (useFirst ? 1 : 0))}` : "");
  const NUMBER_ONLY = (value) => (value !== "" && !Number.isNaN(Number(value)) ? value : "");
  const DIRECTORY_FACTS = ["flag", "gt", "builder", "imo", "mmsi", "official_number", "call_sign", "vessel_type"];

  async function saveRecord(record) {
    const { KEYS, createId } = window.SeavData;
    const newest = record.roles[record.roles.length - 1];
    const entry = record.chosen || (record.answer === "yes" ? record.match : null);
    const facts = {};
    if (entry) {
      DIRECTORY_FACTS.forEach((field) => { facts[field] = entry[field] || ""; });
      facts.directory_id = entry.id;
      if (!record.length) facts.vessel_length = NUMBER_ONLY(entry.vessel_length || "");
      if (!record.year) facts.year_built = NUMBER_ONLY(entry.year_built || "");
    }
    await window.SeavAPI.addItem(KEYS.VESSELS, {
      ...facts,
      id: createId("vessel"),
      name: record.name,
      vessel_role: newest.role || newest.cv,
      vessel_length: facts.vessel_length || NUMBER_ONLY(record.length),
      builder: record.builder || facts.builder || "",
      year_built: facts.year_built || NUMBER_ONLY(record.year),
      program: record.program,
      experience_onboard: record.duties,
      from: fullDate(record.roles[0].from, record.roles[0].fromDay, check.useFirst),
      to: newest.present ? "" : fullDate(newest.to, newest.toDay, check.useFirst)
    });
  }

  // As the Certificates form builds the code for an entry of your own.
  const customCode = (name) => name.slice(0, 24).toUpperCase().replace(/\s+/g, "_");

  async function saveCert(cert) {
    const { KEYS, createId } = window.SeavData;
    const expiry = cert.expiry ? `${cert.expiry}-01` : "";
    const status = expiry ? window.SeavData.getCertExpiryInfo(expiry).badge || "Valid" : "Date to confirm";
    const rows = cert.kind === "unclear" && cert.choice && cert.choice !== "own"
      ? [window.SeavData.findCertificateCatalogItem(cert.choice)].filter(Boolean)
      : cert.kind === "unclear"
        ? []
        : cert.items;
    const list = rows.length
      ? rows.map((item) => ({ code: item.code, name: item.name, isMandatory: !!item.isMandatory }))
      : [{ code: customCode(cert.line), name: cert.line, isMandatory: false }];
    for (const row of list) {
      await window.SeavAPI.addItem(KEYS.CERTS, {
        ...row,
        id: createId("cert"),
        issued: "",
        expiry,
        status,
        isTemplate: false,
        showOnCv: true
      });
    }
    return list.length;
  }

  async function saveAll() {
    if (!check.useFirst && check.records.some(needsDay)) {
      check.tried = true;
      render();
      document.getElementById("cvuDaysBanner")?.scrollIntoView({ block: "center" });
      return;
    }
    const { KEYS, createId } = window.SeavData;
    view = { step: "saving" };
    render();
    const result = { yachts: 0, certs: 0, fields: 0, interests: 0, failed: 0, roles: [], records: [] };

    for (const record of check.records.filter((row) => row.on)) {
      try {
        await saveRecord(record);
        result.yachts += 1;
        result.records.push(record);
        record.roles.forEach((role) => result.roles.push({ name: record.name, role: role.role || role.cv, from: role.from, to: role.to, present: role.present }));
      } catch (err) {
        console.error("[SEA-V] CV upload: yacht save failed:", err);
        result.failed += 1;
      }
    }
    for (const cert of check.certs.filter((row) => row.on)) {
      try {
        result.certs += await saveCert(cert);
      } catch (err) {
        console.error("[SEA-V] CV upload: certificate save failed:", err);
        result.failed += 1;
      }
    }
    const values = Object.fromEntries(check.fields.filter((field) => field.on && !field.kept).map((field) => [field.key, field.value]));
    if (Object.keys(values).length) {
      try {
        result.fields = await window.SeavAPI.saveProfileBlanks(values);
      } catch (err) {
        console.error("[SEA-V] CV upload: profile save failed:", err);
        result.failed += 1;
      }
    }
    for (const interest of check.interests.filter((row) => row.on)) {
      try {
        await window.SeavAPI.addItem(KEYS.HOBBIES_INTERESTS, { id: createId("hobby"), category: "other", title: interest.title, status: "Published" });
        result.interests += 1;
      } catch (err) {
        console.error("[SEA-V] CV upload: interest save failed:", err);
        result.failed += 1;
      }
    }

    done = result;
    check = null;
    view = { step: "done" };
    await window.SeavState?.refresh?.();
    window.scrollTo(0, 0);
    render();
  }

  /* ---------- Screens ---------- */

  function viewUpload() {
    return `<div class="cvu-stack">
      ${view.error ? `<div class="cvu-alert" role="alert">${esc(view.error)}</div>` : ""}
      <article class="dash-panel">${head(ICONS.file, "Your CV")}
        <div class="cvu-body">
          <div class="cvu-drop" id="cvuDrop" data-seav-dropzone>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <label for="cvuFile"><strong>Choose your CV</strong></label>
            <input type="file" id="cvuFile" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            <small class="cvu-note">PDF or Word (.docx), up to 10 MB.</small>
          </div>
          <div class="cvu-points">
            <div><strong>You stay in charge</strong><small class="cvu-note">Nothing is added until you tick it and press Save.</small></div>
            <div><strong>What happens to the file</strong><small class="cvu-note">An AI service reads it once. We don't keep the file.</small></div>
            <div><strong>What we leave out</strong><small class="cvu-note">Referees' details, your date of birth and health notes.</small></div>
          </div>
        </div>
      </article>
    </div>`;
  }

  function viewBusy(title, line) {
    return `<div class="cvu-stack"><article class="dash-panel"><div class="cvu-busy" role="status">
      <strong>${esc(title)}</strong>
      <div class="cvu-bar"><i></i></div>
      <small class="cvu-note">${esc(line)}</small>
    </div></article></div>`;
  }

  function dateCell(label, role, field, dayField) {
    if (field === "to" && role.present) return `<div><small class="cvu-label">${label}</small><strong class="cvu-month">Present</strong></div>`;
    const month = role[field];
    if (!month) return `<div><small class="cvu-label">${label}</small><strong class="cvu-month">Not on your CV</strong></div>`;
    const placeholder = check.useFirst ? "1st" : "Day";
    const options = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${Number(role[dayField]) === i + 1 ? " selected" : ""}>${i + 1}</option>`).join("");
    return `<div><small class="cvu-label">${label}</small><div class="cvu-date"><select aria-label="${label} day" data-day="${dayField}"><option value="">${placeholder}</option>${options}</select><strong class="cvu-month">${esc(prettyMonth(month))}</strong></div></div>`;
  }

  function roleRow(record, role, index) {
    const positions = positionList();
    const options = positions.map((label) => `<option${role.role === label ? " selected" : ""}>${esc(label)}</option>`).join("");
    const same = role.cv === role.role;
    return `<div class="cvu-role" data-record="${record.id}" data-index="${index}">
      <div><small class="cvu-label">Role</small>
        <select data-role class="${role.role ? "" : "is-need"}" aria-label="Role on ${esc(record.name)}"><option value="">Choose a role</option>${options}</select>
        ${same || !role.cv ? "" : `<small class="cvu-note">Your CV says “${esc(role.cv)}”${role.role ? "" : ". If you leave this, we'll use your CV's wording."}</small>`}
      </div>
      ${dateCell("From", role, "from", "fromDay")}
      ${dateCell("To", role, "to", "toDay")}
    </div>`;
  }

  const directoryLabel = (entry) => [entry.name, entry.imo && `IMO ${entry.imo}`, entry.vessel_length && `${entry.vessel_length} m`, entry.gt && `${entry.gt} GT`, entry.flag, entry.builder].filter(Boolean).join(" · ");

  function directoryBlock(record) {
    if (record.chosen || record.answer === "yes") {
      const entry = record.chosen || record.match;
      return `<div class="cvu-info"><div><small class="cvu-label">Linked to the SEA-V yacht directory</small><strong>${esc(directoryLabel(entry))}</strong></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn" data-dir-clear="${record.id}">Change</button></div></div>`;
    }
    if (record.match && !record.answer) {
      const differs = record.length && record.match.vessel_length && Number(record.length) !== Number(record.match.vessel_length);
      return `<div class="cvu-info is-need"><div><small class="cvu-label">Is this the same yacht?</small><strong>${esc(directoryLabel(record.match))}</strong>
        ${differs ? `<small class="cvu-note">Your CV says ${esc(record.length)} m, the directory says ${esc(record.match.vessel_length)} m.</small>` : ""}
        <small class="cvu-note">Yes fills the flag, tonnage and numbers for you.</small></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn is-main" data-dir-answer="yes" data-record-id="${record.id}">Yes</button><button type="button" class="cvu-btn" data-dir-answer="no" data-record-id="${record.id}">No</button></div></div>`;
    }
    return `<div class="cvu-info"><div class="cvu-find"><small class="cvu-label">Find this yacht in the directory (optional)</small>
      <input type="text" class="cvu-find-input" data-find="${record.id}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="cvuFind${record.id}" aria-label="Find ${esc(record.name)} in the directory" placeholder="Name, IMO or MMSI">
      <ul class="vessel-finder-list" id="cvuFind${record.id}" role="listbox" aria-label="Yachts found" hidden></ul>
      <small class="cvu-note">We don't link from the name alone, as two yachts can share one.</small></div></div>`;
  }

  function recordBlock(record) {
    const summary = `<label class="cvu-yacht-top"><input type="checkbox" data-record-on="${record.id}"${record.on ? " checked" : ""}${record.noDates ? " disabled" : ""}>
      <span class="cvu-yacht-name"><strong>${esc(record.name)}</strong><small>${esc([record.length && `${record.length} m`, record.builder, record.year, record.program].filter(Boolean).join(" · "))}</small></span>
      ${record.already ? `<small class="cvu-pill">Already in your records</small>` : ""}
      ${record.noDates ? `<small class="cvu-pill">No dates on your CV. Add this one by hand</small>` : ""}
      ${openRecord(record) && record.on && !record.open ? `<small class="cvu-flag">Needs you</small>` : ""}
    </label>`;
    if (!record.on) return `<div class="cvu-yacht is-off">${summary}</div>`;
    if (!openRecord(record)) {
      return `<div class="cvu-yacht">${summary}
        <div class="cvu-yacht-line"><div>${record.roles.map((role) => `<strong>${esc(role.role || role.cv)}</strong><small class="cvu-note">${esc(prettyMonth(role.from))} – ${role.present ? "Present" : esc(prettyMonth(role.to))}</small>`).join("")}</div>
        <button type="button" class="cvu-btn" data-open="${record.id}">Edit</button></div></div>`;
    }
    const lines = record.duties ? record.duties.split("\n").filter(Boolean).length : 0;
    return `<div class="cvu-yacht">${summary}
      <div class="cvu-roles">${record.roles.map((role, index) => roleRow(record, role, index)).join("")}</div>
      ${record.lengths.length > 1 ? `<div class="cvu-info"><small class="cvu-note">Your CV gives ${esc(record.lengths.join(" m and "))} m for this yacht. Using ${esc(record.length)} m.</small></div>` : ""}
      ${directoryBlock(record)}
      ${lines ? `<details class="cvu-duties"><summary>Experience onboard, ${lines} lines from your CV</summary><textarea data-duties="${record.id}" aria-label="Experience onboard on ${esc(record.name)}">${esc(record.duties)}</textarea></details>` : ""}
    </div>`;
  }

  function certRow(cert) {
    let becomes;
    if (cert.kind === "unclear") {
      const options = window.SeavData.getCertificateCatalog().map((item) => `<option value="${esc(item.code)}"${cert.choice === item.code ? " selected" : ""}>${esc(item.name)}</option>`).join("");
      becomes = `<select data-cert-choice="${cert.id}" class="${cert.choice ? "" : "is-need"}" aria-label="Which certificate is ${esc(cert.line)}"><option value="">Choose, or keep your CV's wording</option><option value="own"${cert.choice === "own" ? " selected" : ""}>Keep your CV's wording</option>${options}</select>`;
    } else if (cert.kind === "not_a_certificate") {
      becomes = "Not a certificate";
    } else {
      becomes = cert.items.length ? cert.items.map((item) => esc(item.name)).join(", and ") : "Your own entry";
    }
    const expired = cert.expiry && window.SeavData.parseDateOnly(`${cert.expiry}-01`) < new Date();
    return `<tr class="${cert.on ? "" : "is-off"}"><td class="cvu-tick"><input type="checkbox" data-cert-on="${cert.id}" aria-label="${esc(cert.line)}"${cert.on ? " checked" : ""}></td>
      <td>${esc(cert.line)}</td>
      <td>${becomes}
        ${cert.expiry ? `<small class="cvu-pill${expired ? " is-bad" : ""}">${expired ? "Expired" : "Expires"} ${esc(prettyMonth(cert.expiry))}</small>` : ""}
        ${cert.already ? `<small class="cvu-pill">Already in your records</small>` : ""}
        ${cert.why ? `<small>${esc(cert.why)}</small>` : ""}</td></tr>`;
  }

  function viewCheck() {
    const left = questionsLeft();
    const yachts = check.records.filter((record) => record.on).length;
    const certs = check.certs.filter((cert) => cert.on).length;
    const jobs = check.records.reduce((sum, record) => sum + record.roles.length, 0);
    const daysOpen = check.records.some(needsDay);
    const fields = check.fields.filter((field) => !field.kept);
    const kept = check.fields.filter((field) => field.kept);
    return `<div class="cvu-stack">
      ${check.records.length ? `<article class="dash-panel">${head(ICONS.yacht, "Yachts", `<small class="dash-panel-more">${jobs} ${jobs === 1 ? "job" : "jobs"}, ${check.records.length} ${check.records.length === 1 ? "record" : "records"}</small>`)}
        ${daysOpen || check.useFirst ? `<div class="cvu-days${check.useFirst ? " is-done" : ""}${check.tried && !check.useFirst ? " is-need" : ""}" id="cvuDaysBanner">
          ${check.useFirst
            ? `<small class="cvu-note">Using the 1st of the month where you haven't chosen a day. Correct these when you log your sea time.</small><button type="button" class="dash-panel-more" data-first="0"><small>Undo</small></button>`
            : `<small class="cvu-note">Your CV gives months, not days. ${check.tried ? "Choose the days, or start with the 1st, before saving." : "Add them now, or start with the 1st of each month."}</small><button type="button" class="cvu-btn" data-first="1">Use the 1st for now</button>`}
        </div>` : ""}
        ${check.records.map(recordBlock).join("")}
      </article>` : ""}

      ${check.certs.length ? `<article class="dash-panel">${head(ICONS.cert, "Certificates")}
        <table class="dash-table"><thead><tr><th scope="col"><small class="dash-sr-only">Add</small></th><th scope="col"><small>On your CV</small></th><th scope="col"><small>Saved as</small></th></tr></thead><tbody>${check.certs.map(certRow).join("")}</tbody></table>
        <div class="dash-panel-note"><small>Add issue and expiry dates afterwards on Certificates. Until then, a certificate with no date says “date to confirm”.</small></div>
      </article>` : ""}

      ${check.fields.length ? `<article class="dash-panel">${head(ICONS.me, "About you")}
        ${fields.length ? `<table class="dash-table"><thead><tr><th scope="col"><small class="dash-sr-only">Add</small></th><th scope="col"><small>Field</small></th><th scope="col"><small>From your CV</small></th></tr></thead><tbody>
          ${fields.map((field) => `<tr class="${field.on ? "" : "is-off"}"><td class="cvu-tick"><input type="checkbox" data-field-on="${field.key}" aria-label="${esc(field.label)}"${field.on ? " checked" : ""}></td><td>${esc(field.label)}</td><td>${field.key === "bio" ? `<textarea data-field-text="${field.key}" aria-label="${esc(field.label)}">${esc(field.value)}</textarea>` : esc(field.value)}${field.key === "visasHeld" && check.expiredVisas.length ? `<small>Your CV shows ${esc(check.expiredVisas.join(", "))} as expired. Untick this if they haven't been renewed, and add the rest on your profile.</small>` : ""}</td></tr>`).join("")}
        </tbody></table>` : ""}
        ${kept.length ? `<div class="dash-panel-note"><small>Kept as they are, as your profile already has them: ${esc(kept.map((field) => field.label).join(", "))}.</small></div>` : ""}
      </article>` : ""}

      ${check.interests.length ? `<article class="dash-panel">${head(ICONS.heart, "Interests")}
        <div class="cvu-body"><div class="cvu-chips">${check.interests.map((interest, index) => `<label class="cvu-chip"><input type="checkbox" data-interest-on="${index}"${interest.on ? " checked" : ""}>${esc(interest.title)}${interest.already ? " (already added)" : ""}</label>`).join("")}</div></div>
      </article>` : ""}

      <article class="dash-panel">${head(ICONS.out, "Left out on purpose")}
        <ul class="cvu-out">
          <li><strong>Sea time</strong><small class="cvu-note">A CV has dates, not sea, standby and yard days. You'll log these next.</small></li>
          ${check.referees ? `<li><strong>${check.referees} ${check.referees === 1 ? "referee" : "referees"}</strong><small class="cvu-note">Their contact details are theirs. Add the ones you want under References.</small></li>` : ""}
          <li><strong>Date of birth, contact details and health notes</strong><small class="cvu-note">Not taken from your CV.</small></li>
        </ul>
      </article>

      <div class="cvu-save">
        <div><strong>${yachts} ${yachts === 1 ? "yacht" : "yachts"} and ${certs} ${certs === 1 ? "certificate line" : "certificate lines"} ticked</strong>
          <small>${left ? `${left} ${left === 1 ? "question" : "questions"} left. Anything unanswered keeps your CV's wording and isn't linked.` : "Everything is answered."}</small></div>
        <button type="button" class="cvu-btn" id="cvuSave">Save ticked items</button>
      </div>
    </div>`;
  }

  function viewDone() {
    const rows = done.roles.map((role) => ({
      name: role.name,
      role: role.role,
      dates: `${prettyMonth(role.from)} – ${role.present ? "Present" : prettyMonth(role.to)}`
    }));
    return `<div class="cvu-stack">
      ${done.failed ? `<div class="cvu-alert" role="alert">${done.failed} ${done.failed === 1 ? "item" : "items"} didn't save. Check your connection, then add ${done.failed === 1 ? "it" : "them"} by hand. Everything else below is saved.</div>` : ""}
      <article class="dash-panel">${head(ICONS.file, "What was added")}
        <dl class="dash-figures"><div><dt>Yachts</dt><dd>${done.yachts}</dd></div><div><dt>Certificates</dt><dd>${done.certs}</dd></div><div><dt>Profile fields</dt><dd>${done.fields}</dd></div><div><dt>Interests</dt><dd>${done.interests}</dd></div></dl>
        <div class="dash-panel-note"><small>If your public profile is switched on, these now show on it.</small></div>
      </article>
      ${rows.length ? `<article class="dash-panel">${head(ICONS.yacht, "Next: log your sea time")}
        <div class="dash-panel-note"><small>Add the sea, standby and yard days for each role. This is what counts towards your tickets.</small></div>
        <table class="dash-table"><thead><tr><th scope="col"><small>Yacht</small></th><th scope="col"><small>Role</small></th><th scope="col"><small>Dates</small></th></tr></thead><tbody>
          ${rows.map((row) => `<tr><td><a href="dashboard.html?add=seatime">${esc(row.name)}</a></td><td>${esc(row.role)}</td><td>${esc(row.dates)}</td></tr>`).join("")}
        </tbody></table>
      </article>` : ""}
      <article class="dash-panel">${head(ICONS.cert, "To finish later")}
        <ul class="cvu-out">
          <li><strong>Certificate dates</strong><small class="cvu-note">Add issue and expiry dates so SEA-V can remind you.</small></li>
          <li><strong>Exact days on your yachts</strong><small class="cvu-note">Any that started on the 1st of the month.</small></li>
          <li><strong>Yacht details</strong><small class="cvu-note">Find each yacht in the directory to fill in its flag, tonnage and IMO.</small></li>
        </ul>
      </article>
      <div><a class="btn-blue cvu-go" href="dashboard.html">Go to my dashboard</a></div>
    </div>`;
  }

  function viewClosed() {
    return `<div class="cvu-stack"><article class="dash-panel"><div class="cvu-body"><strong>Coming soon</strong><small class="cvu-note">You'll be able to fill in your record from your CV here.</small></div></article></div>`;
  }

  const main = () => document.getElementById("cvuMain");

  function render() {
    const mount = main();
    if (!mount) return;
    const active = document.activeElement?.id;
    const scroll = window.scrollY;
    mount.innerHTML =
      view.step === "closed" ? viewClosed()
        : view.step === "reading" ? viewBusy(`Reading ${view.fileName}`, "This can take up to a minute. Nothing is saved yet.")
          : view.step === "saving" ? viewBusy("Saving your ticked items", "Please keep this page open.")
            : view.step === "check" ? viewCheck()
              : view.step === "done" ? viewDone()
                : viewUpload();
    if (view.step === "check") {
      window.scrollTo(0, scroll);
      if (active) document.getElementById(active)?.focus();
      mount.querySelectorAll("[data-find]").forEach((input) => {
        const record = check.records.find((row) => row.id === input.dataset.find);
        window.SeavVesselFinder?.attachYachtSearch({
          input,
          list: document.getElementById(`cvuFind${record.id}`),
          emptyMessage: "Not in the directory yet. You can add it later.",
          onChoose: (entry) => { record.chosen = entry; record.open = true; render(); }
        });
      });
    }
  }

  const recordById = (id) => check?.records.find((record) => record.id === id);

  function wire() {
    const mount = main();
    mount.addEventListener("change", (event) => {
      const t = event.target;
      if (t.id === "cvuFile") {
        if (t.files?.[0]) readFile(t.files[0]);
        return;
      }
      if (!check) return;
      const row = t.closest("[data-record]");
      if (t.dataset.recordOn) recordById(t.dataset.recordOn).on = t.checked;
      else if ("role" in t.dataset && row) {
        const record = recordById(row.dataset.record);
        record.roles[Number(row.dataset.index)].role = t.value;
        record.open = true;
      } else if (t.dataset.day && row) {
        const record = recordById(row.dataset.record);
        record.roles[Number(row.dataset.index)][t.dataset.day] = t.value;
        record.open = true;
      } else if (t.dataset.certOn) check.certs.find((cert) => cert.id === t.dataset.certOn).on = t.checked;
      else if (t.dataset.certChoice) check.certs.find((cert) => cert.id === t.dataset.certChoice).choice = t.value;
      else if (t.dataset.fieldOn) check.fields.find((field) => field.key === t.dataset.fieldOn).on = t.checked;
      else if (t.dataset.interestOn !== undefined) check.interests[Number(t.dataset.interestOn)].on = t.checked;
      else return;
      render();
    });
    // Typing keeps the box; nothing to redraw.
    mount.addEventListener("input", (event) => {
      const t = event.target;
      if (t.dataset.duties) recordById(t.dataset.duties).duties = t.value;
      else if (t.dataset.fieldText) check.fields.find((field) => field.key === t.dataset.fieldText).value = t.value;
    });
    mount.addEventListener("click", (event) => {
      const t = event.target;
      if (t.closest("#cvuSave")) { saveAll(); return; }
      if (!check) return;
      const first = t.closest("[data-first]");
      const open = t.closest("[data-open]");
      const answer = t.closest("[data-dir-answer]");
      const clear = t.closest("[data-dir-clear]");
      if (first) check.useFirst = first.dataset.first === "1";
      else if (open) recordById(open.dataset.open).open = true;
      else if (answer) {
        const record = recordById(answer.dataset.recordId);
        record.answer = answer.dataset.dirAnswer;
        record.open = true;
      } else if (clear) {
        const record = recordById(clear.dataset.dirClear);
        record.answer = record.match ? "" : "no";
        record.chosen = null;
        record.open = true;
      } else return;
      render();
    });
  }

  async function init() {
    if (!main()) return;
    wire();
    // Your account only for now: the function refuses everyone else anyway.
    await window.SeavAuth?.whenReady?.();
    const open = await window.SeavAPI.canReadCv().catch(() => false);
    if (!open) view = { step: "closed" };
    // Sent on from Upload a document, already read. Taken once, so it doesn't linger.
    let handoff = null;
    try {
      handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null");
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch (err) {
      console.warn("[SEA-V] CV handoff unreadable:", err);
    }
    if (open && handoff) {
      check = await buildCheck(handoff);
      view = { step: "check" };
    }
    render();
  }

  // Exposed for the rule tests.
  window.SeavCvUpload = { buildRecords, wordText };

  document.addEventListener("DOMContentLoaded", init);
})();
