// /js/doc-upload.js — "Upload a document" (v626, Jack 2026-11-06). Plan and test results:
// docs/product/cv-upload-plan-2026-11-05.md. Mockup he approved: design-concepts/doc-upload/.
// Drop anything: the edge function doc-read works out what each file is and reads it,
// this page shows what it found beside the file, and only what is ticked is saved,
// through the same save code as the normal forms. Certificates, testimonials and
// payslips save from here; a CV goes on to the CV check. Everything from a document is
// untrusted, so it is escaped and every code is checked against SEA-V's own lists.
(function () {
  "use strict";

  if (!window.Seav || !window.SeavData) {
    console.error("[SEA-V] Document upload: core scripts missing.");
    return;
  }

  const esc = window.Seav.escapeHtml;
  const D = window.SeavData;
  const MAX_FILES = 20;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 2000;
  const DATE_CLOSE_DAYS = 31;
  const TO_CONFIRM = "Date to confirm";
  const READ_ERRORS = {
    not_set_up: "The reader isn't switched on yet.",
    not_open: "This isn't open yet.",
    limit: "You've used today's reads. Try this one tomorrow.",
    too_big: "This file is too big. Try one under 10 MB.",
    signin: "Please sign in again, then try once more.",
    type: "We can't read this kind of file yet. Save it as a PDF and try again.",
    cannot_read: "We couldn't read this file. It may be password protected or a poor scan."
  };
  const TYPES = {
    certificate: "Certificate",
    testimonial: "Sea service testimonial",
    payslip: "Payslip",
    cv: "CV",
    contract: "Contract (SEA)",
    reference: "Reference letter",
    other: "Something else"
  };
  const BY_HAND = {
    contract: "We can't add contracts from here yet. Attach it on your yacht's record.",
    reference: "We can't add reference letters from here yet. Add it under References.",
    other: "We don't know where this goes. Nothing will be saved from it."
  };
  const CERT_HOMES = ["Certificates", "Specialist qualifications", "Interests"];
  const ICON = (d) => `<span class="dash-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="${d}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  const ICONS = {
    file: "M6 3h9l4 4v14H6V3ZM14 3v5h5",
    out: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM6 6l12 12",
    ok: "M5 12.5 10 17 19 7",
    later: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
  };
  const head = (icon, title, extra = "") =>
    `<div class="dash-panel-head"><span class="dash-panel-heading">${ICON(icon)}<h3 class="dash-panel-title">${esc(title)}</h3></span>${extra}</div>`;

  const clean = (value) => String(value ?? "").trim();
  const fullDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(clean(value)) && !Number.isNaN(D.parseDateOnly(clean(value)).getTime()) ? clean(value) : "");
  const pretty = (value) => (value ? D.formatDatePretty(value) : "Not shown");
  const sameName = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
  const number = (value) => {
    const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && clean(value) !== "" ? n : "";
  };
  const customCode = (name) => name.slice(0, 24).toUpperCase().replace(/\s+/g, "_");
  const daysApart = (a, b) => Math.abs(D.parseDateOnly(a) - D.parseDateOnly(b)) / 86400000;

  let view = { step: "upload" };
  let docs = [];
  let done = null;
  let nextId = 0;

  /* ---------- Preparing and reading ---------- */

  function fileKind(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "pdf";
    if (name.endsWith(".docx")) return "word";
    if (/\.(png|jpe?g|webp|gif|heic|heif)$/.test(name) || /^image\//.test(file.type)) return "image";
    return "";
  }

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(Object.assign(new Error("cannot_read"), { code: "cannot_read" }));
    reader.readAsDataURL(blob);
  });

  // Photos go smaller and as JPEG: enough to read, and a fraction of the size.
  async function imageForReading(file) {
    const source = window.SeavUpload?.isHeicFile?.(file) ? await window.SeavUpload.convertHeicToJpeg(file) : file;
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return toBase64(blob);
  }

  async function readOne(doc) {
    doc.status = "reading";
    render();
    try {
      const kind = fileKind(doc.file);
      const file = kind === "pdf" ? await toBase64(doc.file)
        : kind === "word" ? await window.SeavCvUpload.wordText(doc.file)
          : await imageForReading(doc.file);
      const result = await window.SeavAPI.readDocument({
        kind,
        file,
        mediaType: kind === "image" ? "image/jpeg" : "",
        positions: D.SEAFARER_POSITIONS.flatMap((group) => group.roles.map((role) => role.label)),
        catalog: D.getCertificateCatalog().map((item) => ({ code: item.code, name: item.name }))
      });
      doc.result = result;
      doc.status = "read";
    } catch (err) {
      console.warn("[SEA-V] Document read failed:", err?.code || "unknown");
      doc.status = "failed";
      doc.error = READ_ERRORS[err?.code] || READ_ERRORS.cannot_read;
    }
  }

  async function startReading(files) {
    const chosen = [...files].slice(0, MAX_FILES);
    docs = chosen.map((file) => {
      const doc = { id: `d${nextId += 1}`, file, status: "waiting", answers: {}, open: false };
      if (!fileKind(file)) { doc.status = "failed"; doc.error = READ_ERRORS.type; }
      else if (file.size > MAX_FILE_BYTES) { doc.status = "failed"; doc.error = READ_ERRORS.too_big; }
      if (doc.status === "waiting" && fileKind(file) === "image" && !window.SeavUpload?.isHeicFile?.(file)) doc.preview = URL.createObjectURL(file);
      return doc;
    });
    view = { step: "reading", extra: files.length - chosen.length };
    render();
    for (const doc of docs.filter((row) => row.status === "waiting")) await readOne(doc);
    await window.SeavState?.refresh?.();
    docs.filter((doc) => doc.status === "read").forEach(prepare);
    linkDuplicates();
    sortDocs();
    view = { step: "check" };
    window.scrollTo(0, 0);
    render();
  }

  /* ---------- Working out what each document means ---------- */

  function savedCerts() {
    return (window.SeavState?.certs || []).filter((cert) => (D.isSavedCert ? D.isSavedCert(cert) : !!cert.name));
  }

  function buildCertRow(row, doc) {
    const items = (row.codes || []).map((code) => D.findCertificateCatalogItem(code)).filter(Boolean);
    const name = items[0]?.name || clean(row.name_as_written);
    const issued = fullDate(row.issued);
    const out = {
      id: `${doc.id}c${doc.certs.length}`,
      item: items[0] || null,
      name,
      written: clean(row.name_as_written),
      number: clean(row.number),
      issued,
      expiry: fullDate(row.expiry),
      expiryBasis: clean(row.expiry_basis),
      issuer: clean(row.issuer),
      recreational: !!row.recreational,
      expiryChoice: "",
      expiryAdded: "",
      on: true,
      state: "new"
    };
    const existing = savedCerts().find((cert) => (out.item ? cert.code === out.item.code : sameName(cert.name, name)));
    out.existing = existing || null;
    if (existing) {
      const theirs = fullDate(existing.issued);
      if (!issued || !theirs || issued === theirs) {
        out.state = "same";
        out.on = !existing.attachment;
      } else if (issued < theirs && daysApart(issued, theirs) > DATE_CLOSE_DAYS) {
        out.state = "older";
        out.on = false;
      } else if (daysApart(issued, theirs) <= DATE_CLOSE_DAYS) {
        // This close, it is more likely a misread than a renewal.
        out.state = "differs";
      } else {
        out.state = "newer";
      }
    }
    return out;
  }

  function prepare(doc) {
    const result = doc.result;
    doc.type = result.doc_type;
    doc.on = true;
    doc.keepFile = true;
    doc.holder = result.holder || {};
    doc.certs = [];
    if (doc.type === "certificate") {
      (result.certificates || []).filter((row) => clean(row?.name_as_written)).forEach((row) => doc.certs.push(buildCertRow(row, doc)));
      doc.home = doc.certs.some((cert) => cert.recreational) ? "" : "Certificates";
      doc.medical = doc.certs.some((cert) => D.isMedicalFitnessCert?.({ code: cert.item?.code, name: cert.name }));
      doc.consent = false;
      doc.on = doc.certs.some((cert) => cert.on);
      if (!doc.certs.length) doc.type = "other";
    } else if (doc.type === "testimonial") {
      const t = result.testimonial || {};
      const vessel = (window.SeavState?.vessels || []).find((row) => sameName(row.name, t.yacht));
      doc.sea = {
        yacht: clean(t.yacht),
        vesselId: vessel?.id || "",
        role: clean(t.role),
        from: fullDate(t.from),
        to: fullDate(t.to),
        days: { sea: number(t.sea_days), standby: number(t.standby_days), yard: number(t.yard_days), watch: number(t.watchkeeping_days) },
        checked: false
      };
    } else if (doc.type === "payslip") {
      const p = result.payslip || {};
      const vessel = (window.SeavState?.vessels || []).find((row) => sameName(row.name, p.yacht));
      const currency = (D.PAYSLIP_CURRENCIES || []).some((c) => (c.value || c) === clean(p.currency)) ? clean(p.currency) : "OTHER";
      doc.pay = { date: fullDate(p.pay_date), yacht: clean(p.yacht), vesselId: vessel?.id || "", employer: clean(p.employer), gross: number(p.gross), net: number(p.net), currency };
      doc.on = !!doc.pay.date;
    } else if (doc.type === "cv") {
      doc.on = false;
    } else {
      doc.on = false;
    }
  }

  // The same certificate twice in one upload: the first stays, the rest step back.
  function linkDuplicates() {
    const seen = new Map();
    docs.filter((doc) => doc.type === "certificate").forEach((doc) => {
      doc.certs.forEach((cert) => {
        const key = cert.number ? `n:${cert.number.toLowerCase()}:${cert.name.toLowerCase()}` : `d:${cert.name.toLowerCase()}:${cert.issued}`;
        if (seen.has(key)) {
          cert.state = "duplicate";
          cert.duplicateOf = seen.get(key);
          cert.on = false;
        } else {
          seen.set(key, doc.file.name);
        }
      });
      if (doc.certs.every((cert) => !cert.on)) doc.on = false;
    });
  }

  function docQuestions(doc) {
    if (doc.status !== "read" || !doc.on) return 0;
    let count = 0;
    if (doc.type === "certificate") {
      if (!doc.home) count += 1;
      if (doc.holder.birth_matches === false && !doc.answers.holder) count += 1;
      doc.certs.filter((cert) => cert.on).forEach((cert) => {
        if (cert.state === "differs" && !cert.answer) count += 1;
        if (cert.state === "new" && !cert.expiry && !cert.expiryChoice) count += 1;
      });
    } else if (doc.type === "testimonial" && !doc.sea.checked) count += 1;
    if (doc.holder?.name_matches === false && !doc.answers.name) count += 1;
    return count;
  }

  const questionsLeft = () => docs.reduce((sum, doc) => sum + docQuestions(doc), 0);

  function sortDocs() {
    const rank = (doc) => (doc.status !== "read" ? 3 : docQuestions(doc) ? 0 : doc.on ? 1 : 2);
    docs = docs.map((doc, index) => [doc, index]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([doc]) => doc);
  }

  /* ---------- Saving ---------- */

  const BUCKETS = { certs: "certificate-files", seatime: "seatime-files", payslips: "payslip-files", specialist: "specialist-qualification-files" };

  async function upload(doc, bucket, entityId, kind, extra) {
    if (!doc.keepFile) return null;
    const stored = await window.SeavUpload.uploadToStorage({ bucket, entityId, file: doc.file, existingMeta: null, kind });
    return stored ? { ...stored, ...extra } : null;
  }

  function expiryFor(cert) {
    if (cert.expiry) return { expiry: cert.expiry, status: D.getCertExpiryInfo(cert.expiry).badge || "Valid" };
    if (cert.expiryChoice === "none") return { expiry: "", status: "No Expiry" };
    const added = fullDate(cert.expiryAdded);
    if (cert.expiryChoice === "add" && added) return { expiry: added, status: D.getCertExpiryInfo(added).badge || "Valid" };
    return { expiry: "", status: TO_CONFIRM };
  }

  async function saveCert(doc, cert, result) {
    const consent = doc.medical && doc.consent ? { healthConsentAt: new Date().toISOString() } : null;
    const attachable = !doc.medical || doc.consent;
    if (doc.home === "Interests") {
      await window.SeavAPI.addItem(D.KEYS.HOBBIES_INTERESTS, { id: D.createId("hobby"), category: "other", title: cert.name, status: "Published" });
      result.interests += 1;
      return;
    }
    if (doc.home === "Specialist qualifications") {
      const id = D.createId("specialist");
      const attachment = await upload(doc, BUCKETS.specialist, id, "Qualification");
      await window.SeavAPI.addItem(D.KEYS.SPECIALIST_QUALIFICATIONS, { id, category: "other", title: cert.name, issuingBody: cert.issuer, dateObtained: cert.issued || null, attachment });
      result.specialist += 1;
      return;
    }
    if (cert.existing) {
      const existing = cert.existing;
      const useDates = cert.state === "newer" || (cert.state === "differs" && cert.answer === "use");
      const attachment = attachable && (!existing.attachment || useDates) ? await upload(doc, BUCKETS.certs, existing.id, "Certificate", consent) : null;
      if (!useDates && !attachment) return;
      const dates = useDates ? { issued: cert.issued, ...expiryFor(cert) } : {};
      await window.SeavAPI.updateItemById(D.KEYS.CERTS, existing.id, { ...existing, ...dates, attachment: attachment || existing.attachment || null, certificateNumber: existing.certificateNumber || cert.number });
      if (attachment) result.attached += 1;
      if (useDates) result.updated += 1;
      return;
    }
    const id = D.createId("cert");
    const attachment = attachable ? await upload(doc, BUCKETS.certs, id, "Certificate", consent) : null;
    await window.SeavAPI.addItem(D.KEYS.CERTS, {
      id,
      code: cert.item?.code || customCode(cert.name),
      name: cert.name,
      issued: cert.issued,
      ...expiryFor(cert),
      attachment,
      isMandatory: !!cert.item?.isMandatory,
      isTemplate: false,
      showOnCv: true,
      trainingProvider: cert.issuer,
      certificateNumber: cert.number
    });
    result.certs += 1;
    if (expiryFor(cert).status === TO_CONFIRM) result.toConfirm += 1;
  }

  async function saveDoc(doc, result) {
    if (doc.type === "certificate") {
      for (const cert of doc.certs.filter((row) => row.on)) await saveCert(doc, cert, result);
    } else if (doc.type === "testimonial") {
      if (!doc.sea.checked) return;
      const id = D.createId("seatime");
      const attachment = await upload(doc, BUCKETS.seatime, id, "Sea service testimonial");
      await window.SeavAPI.addItem(D.KEYS.SEATIMES, {
        id,
        vesselId: doc.sea.vesselId || null,
        capacityServed: doc.sea.role,
        dateJoined: doc.sea.from,
        dateLeft: doc.sea.to,
        actualSeaServiceDays: doc.sea.days.sea || 0,
        standbyServiceDays: doc.sea.days.standby || 0,
        yardServiceDays: doc.sea.days.yard || 0,
        watchkeepingDays: doc.sea.days.watch || 0,
        verificationStatus: "Logged",
        attachment
      });
      result.seatime += 1;
    } else if (doc.type === "payslip") {
      const id = D.createId("payslip");
      const taxYear = D.inferUkTaxYear(doc.pay.date);
      const attachment = await upload(doc, BUCKETS.payslips, id, "Payslip");
      const payMonth = doc.pay.date.slice(5, 7);
      await window.SeavAPI.addItem(D.KEYS.PAYSLIPS, {
        id,
        taxYear,
        payMonth,
        payPeriod: payMonth,
        paymentDate: doc.pay.date,
        employer: doc.pay.employer,
        vesselId: doc.pay.vesselId || null,
        grossAmount: doc.pay.gross,
        netAmount: doc.pay.net,
        currency: doc.pay.currency,
        attachment
      });
      result.payslips += 1;
    }
  }

  async function saveAll() {
    view = { step: "saving" };
    render();
    const result = { certs: 0, updated: 0, attached: 0, seatime: 0, payslips: 0, specialist: 0, interests: 0, toConfirm: 0, failed: [] };
    for (const doc of docs.filter((row) => row.status === "read" && row.on)) {
      try {
        await saveDoc(doc, result);
      } catch (err) {
        console.error("[SEA-V] Document save failed:", err);
        result.failed.push(doc.file.name);
      }
    }
    const cvDoc = docs.find((doc) => doc.status === "read" && doc.type === "cv");
    if (cvDoc) {
      try {
        sessionStorage.setItem("seav_cv_handoff", JSON.stringify(cvDoc.result.cv || {}));
        result.cv = cvDoc.file.name;
      } catch (err) {
        console.warn("[SEA-V] CV handoff failed:", err);
      }
    }
    docs.forEach((doc) => { if (doc.preview) URL.revokeObjectURL(doc.preview); });
    docs = [];
    done = result;
    view = { step: "done" };
    await window.SeavState?.refresh?.();
    window.scrollTo(0, 0);
    render();
  }

  /* ---------- Screens ---------- */

  function viewUpload() {
    return `<div class="cvu-stack">
      <article class="dash-panel">${head(ICONS.file, "Your documents")}
        <div class="cvu-body">
          <div class="cvu-drop" id="duDrop" data-seav-dropzone>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <label for="duFiles"><strong>Choose your documents</strong></label>
            <input type="file" id="duFiles" multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.heic,.heif,application/pdf,image/*">
            <small class="cvu-note">One or many, up to ${MAX_FILES}. PDF, Word or photos, up to 10 MB each.</small>
            <div class="du-kinds"><small class="cvu-pill">CV</small><small class="cvu-pill">Certificates</small><small class="cvu-pill">Sea service testimonials</small><small class="cvu-pill">Payslips</small></div>
          </div>
          <div class="cvu-points">
            <div><strong>You stay in charge</strong><small class="cvu-note">Nothing is added until you tick it and press Save.</small></div>
            <div><strong>What happens to the files</strong><small class="cvu-note">An AI service reads each one once. A file is kept only if you add it to a record, in your private storage.</small></div>
            <div><strong>Please don't upload</strong><small class="cvu-note">Passports or ID. We don't need them, and we won't keep or use them.</small></div>
          </div>
        </div>
      </article>
    </div>`;
  }

  const STATUS = { waiting: "Waiting", reading: "Reading…", read: "Read", failed: "Couldn't read" };

  function viewReading() {
    return `<div class="cvu-stack"><article class="dash-panel">${head(ICONS.file, "Reading your documents")}
      <div class="cvu-bar du-bar"><i></i></div>
      <ul class="du-queue" role="status">${docs.map((doc) => `<li><strong>${esc(doc.file.name)}</strong><small class="cvu-note">${doc.error ? esc(doc.error) : STATUS[doc.status]}</small></li>`).join("")}</ul>
      <div class="dash-panel-note"><small>One at a time. Please keep this page open. Nothing is saved yet.${view.extra > 0 ? ` We can read ${MAX_FILES} at a time, so ${view.extra} ${view.extra === 1 ? "was" : "were"} left out.` : ""}</small></div>
    </article></div>`;
  }

  function filePicture(doc) {
    const open = `<button type="button" class="dash-panel-more" data-view-file="${doc.id}"><small>Open full size</small></button>`;
    return doc.preview
      ? `<div class="du-side"><img class="du-picture" src="${esc(doc.preview)}" alt="Your file, ${esc(doc.file.name)}">${open}</div>`
      : `<div class="du-side"><div class="du-tile"><strong>${esc({ pdf: "PDF", word: "Word", image: "Photo" }[fileKind(doc.file)] || "File")}</strong></div>${open}</div>`;
  }

  function typeRow(doc) {
    const options = Object.entries(TYPES).map(([value, label]) => `<option value="${value}"${doc.type === value ? " selected" : ""}>${esc(label)}</option>`).join("");
    const home = doc.type === "certificate"
      ? `<div><small class="cvu-label">Goes to</small><select data-home="${doc.id}" class="${doc.home ? "" : "is-need"}" aria-label="Where ${esc(doc.file.name)} goes"><option value="">Choose</option>${CERT_HOMES.map((h) => `<option${doc.home === h ? " selected" : ""}>${esc(h)}</option>`).join("")}</select>${doc.home ? "" : `<small class="cvu-note">This looks like a leisure qualification. Where should it go?</small>`}</div>`
      : `<div><small class="cvu-label">Goes to</small><strong class="du-value">${esc({ testimonial: "Sea time", payslip: "Payslips", cv: "The CV check" }[doc.type] || "Nowhere yet")}</strong></div>`;
    return `<div class="du-where"><div><small class="cvu-label">This looks like</small><select data-type="${doc.id}" aria-label="Document type for ${esc(doc.file.name)}">${options}</select></div>${home}</div>`;
  }

  const CERT_STATE = {
    new: "New",
    same: "Already in your records",
    newer: "Newer than your record",
    older: "Older than your record",
    differs: "Already in your records",
    duplicate: "Duplicate"
  };

  function expiryCell(cert) {
    if (cert.expiry) {
      const expired = D.parseDateOnly(cert.expiry) < new Date();
      return `<div><small class="cvu-label">Expires</small><strong class="du-value">${esc(pretty(cert.expiry))}${expired ? ` <small class="cvu-pill is-bad">Expired</small>` : ""}</strong>${cert.expiryBasis ? `<small class="cvu-note">Worked out from “${esc(cert.expiryBasis)}”. Please check it.</small>` : ""}</div>`;
    }
    return `<div><small class="cvu-label">Expires</small>
      <select data-expiry="${cert.id}" aria-label="Expiry for ${esc(cert.name)}"><option value="">Date to confirm</option><option value="none"${cert.expiryChoice === "none" ? " selected" : ""}>Doesn't expire</option><option value="add"${cert.expiryChoice === "add" ? " selected" : ""}>Add a date</option></select>
      ${cert.expiryChoice === "add" ? `<input type="date" data-expiry-date="${cert.id}" value="${esc(cert.expiryAdded)}" aria-label="Expiry date for ${esc(cert.name)}">` : `<small class="cvu-note">Not shown on this document.</small>`}</div>`;
  }

  function certBlock(doc, cert) {
    const theirs = cert.existing;
    let note = "";
    if (cert.state === "older") note = `Your record shows ${esc(pretty(theirs.issued))}, so nothing will change. Tick this only to add this file to it.`;
    if (cert.state === "newer") note = `Your record shows ${esc(pretty(theirs.issued))}. Saving updates its dates and adds this file.`;
    if (cert.state === "same") note = theirs?.attachment ? "This matches your record, which already has a file." : "This matches your record. Saving adds this file to it.";
    if (cert.state === "duplicate") note = `The same certificate as ${esc(cert.duplicateOf)}, so this one is left out.`;
    return `<div class="du-record">
      <label class="du-tick"><input type="checkbox" data-cert-on="${cert.id}" aria-label="Use ${esc(cert.name)}"${cert.on ? " checked" : ""}><strong>${esc(cert.name)}</strong></label>
      <div><small class="cvu-pill">${esc(cert.item || cert.existing ? CERT_STATE[cert.state] : `${CERT_STATE[cert.state]}, your own entry`)}</small></div>
      ${cert.state === "new" || cert.state === "differs" || cert.state === "newer" ? `<div class="du-pair">
        <div><small class="cvu-label">Date issued</small><strong class="du-value">${esc(pretty(cert.issued))}</strong></div>
        ${expiryCell(cert)}
        ${cert.issuer ? `<div><small class="cvu-label">Issued by</small><strong class="du-value">${esc(cert.issuer)}</strong></div>` : ""}
      </div>` : ""}
      ${cert.state === "differs" ? `<div class="du-flag"><div><strong>The date issued differs</strong><small class="cvu-note">Your record says ${esc(pretty(theirs.issued))}. This reads as ${esc(pretty(cert.issued))}. Small scans get misread, so check the file.</small></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn${cert.answer === "keep" ? " is-chosen" : ""}" data-cert-answer="${cert.id}" data-value="keep">Keep mine</button><button type="button" class="cvu-btn${cert.answer === "use" ? " is-chosen" : ""}" data-cert-answer="${cert.id}" data-value="use">Use this</button></div></div>` : ""}
      ${note ? `<small class="cvu-note">${note}</small>` : ""}
    </div>`;
  }

  function flags(doc) {
    let html = "";
    if (doc.holder?.birth_matches === false && doc.type === "certificate") {
      html += `<div class="du-flag"><div><strong>The date of birth here doesn't match your profile</strong><small class="cvu-note">If this is yours, ask the issuer to correct it, or check your profile.</small></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn${doc.answers.holder ? " is-chosen" : ""}" data-doc-answer="${doc.id}" data-value="holder">It's mine, add it</button></div></div>`;
    }
    if (doc.holder?.name_matches === false) {
      html += `<div class="du-flag"><div><strong>The name here doesn't match your profile</strong><small class="cvu-note">Please check this is your document.</small></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn${doc.answers.name ? " is-chosen" : ""}" data-doc-answer="${doc.id}" data-value="name">It's mine</button></div></div>`;
    }
    return html;
  }

  function docBody(doc) {
    let inner = typeRow(doc);
    if (BY_HAND[doc.type]) inner += `<div class="du-flag is-quiet"><div><small class="cvu-note">${esc(BY_HAND[doc.type])}</small></div></div>`;
    if (doc.type === "cv") inner += `<div class="du-flag is-quiet"><div><small class="cvu-note">After you save, we'll take you to the CV check for your yachts and certificates.</small></div></div>`;
    inner += flags(doc);
    if (doc.type === "certificate") {
      inner += doc.certs.map((cert) => certBlock(doc, cert)).join("");
      if (doc.medical) {
        inner += `<label class="du-consent"><input type="checkbox" data-consent="${doc.id}"${doc.consent ? " checked" : ""}><small>I agree to SEA-V storing my medical certificate. Without this, only the dates are saved.</small></label>`;
      } else {
        inner += `<label class="du-consent"><input type="checkbox" data-keep="${doc.id}"${doc.keepFile ? " checked" : ""}><small>Keep this file on the record, in my private storage.</small></label>`;
      }
    }
    if (doc.type === "testimonial") {
      const s = doc.sea;
      const field = (key, label) => `<div><small class="cvu-label">${label}</small><input type="number" min="0" data-sea="${doc.id}" data-field="${key}" value="${esc(s.days[key])}" aria-label="${label}"></div>`;
      inner += `<div class="du-record"><strong>${esc(s.yacht || "Yacht not shown")}${s.role ? `, ${esc(s.role)}` : ""}</strong>
        <small class="cvu-note">${esc(pretty(s.from))} – ${esc(pretty(s.to))}${s.vesselId ? "" : ". This yacht isn't in your records yet, so the entry won't be linked to one."}</small>
        <div class="du-pair du-pair--4">${field("sea", "Sea days")}${field("standby", "Standby days")}${field("yard", "Yard days")}${field("watch", "Watchkeeping days")}</div></div>
        <div class="du-flag"><div><strong>These count towards your tickets</strong><small class="cvu-note">Check each figure against the document. It saves as a normal entry, not as confirmed by a captain. Only the captain's online answer can do that.</small></div>
        <div class="cvu-actions"><button type="button" class="cvu-btn${s.checked ? " is-chosen" : ""}" data-sea-check="${doc.id}">I've checked them</button></div></div>`;
    }
    if (doc.type === "payslip") {
      const p = doc.pay;
      inner += `<div class="du-record"><div class="du-pair">
        <div><small class="cvu-label">Paid on</small><strong class="du-value">${esc(pretty(p.date))}</strong></div>
        <div><small class="cvu-label">Yacht</small><strong class="du-value">${esc(p.yacht || "Not shown")}</strong></div>
        <div><small class="cvu-label">Net pay</small><strong class="du-value">${p.net === "" ? "Not shown" : esc(D.formatMoneyAmount ? D.formatMoneyAmount(p.net, p.currency) : `${p.net} ${p.currency}`)}</strong></div>
      </div><small class="cvu-note">${p.date ? "Private. Never on your public profile or CV." : "We need a pay date to save this, so add it on Payslips."}</small></div>`;
    }
    return `<div class="du-doc-body">${filePicture(doc)}<div class="du-fields">${inner}</div></div>`;
  }

  function summary(doc) {
    if (doc.type === "certificate") return doc.certs.map((cert) => cert.name).join(", ");
    if (doc.type === "testimonial") return doc.sea.yacht;
    if (doc.type === "payslip") return pretty(doc.pay.date);
    return "";
  }

  function docBlock(doc) {
    const q = docQuestions(doc);
    const open = q > 0 || doc.open;
    const canTick = ["certificate", "testimonial", "payslip"].includes(doc.type);
    return `<div class="du-doc">
      <div class="du-doc-top">
        ${canTick ? `<input type="checkbox" data-doc-on="${doc.id}"${doc.on ? " checked" : ""} aria-label="Use ${esc(doc.file.name)}">` : ""}
        <span class="cvu-yacht-name"><strong>${esc(doc.file.name)}</strong><small>${esc(TYPES[doc.type] || "")}${!open && summary(doc) ? ` · ${esc(summary(doc))}` : ""}</small></span>
        ${q ? `<small class="cvu-flag">Needs you</small>` : `<button type="button" class="cvu-btn" data-toggle="${doc.id}" aria-expanded="${open}">${open ? "Close" : "Review"}</button>`}
      </div>
      ${open ? docBody(doc) : ""}
    </div>`;
  }

  function viewCheck() {
    const read = docs.filter((doc) => doc.status === "read" && doc.type !== "passport_or_id");
    const refused = docs.filter((doc) => doc.status === "read" && doc.type === "passport_or_id");
    const failed = docs.filter((doc) => doc.status === "failed");
    const ticked = read.filter((doc) => doc.on).length;
    const left = questionsLeft();
    return `<div class="cvu-stack">
      ${read.length ? `<article class="dash-panel">${head(ICONS.file, "Documents", `<small class="dash-panel-more">${read.length} read</small>`)}${read.map(docBlock).join("")}</article>` : ""}
      ${refused.length || failed.length ? `<article class="dash-panel">${head(ICONS.out, "Not used")}<ul class="cvu-out">
        ${refused.map((doc) => `<li><strong>${esc(doc.file.name)}</strong><small class="cvu-note">This looked like a passport or ID, so nothing was taken from it and it wasn't kept. Add your passport countries on your profile.</small></li>`).join("")}
        ${failed.map((doc) => `<li><strong>${esc(doc.file.name)}</strong><small class="cvu-note">${esc(doc.error)}</small></li>`).join("")}
      </ul></article>` : ""}
      <div class="cvu-save"><div><strong>${ticked} ${ticked === 1 ? "document" : "documents"} ticked</strong>
        <small>${left ? `${left} ${left === 1 ? "question" : "questions"} left. Certificates with no date save as “date to confirm”. Unchecked sea time isn't saved.` : "Everything is answered."}</small></div>
        <button type="button" class="cvu-btn" id="duSave">Save ticked items</button></div>
    </div>`;
  }

  function viewBusy() {
    return `<div class="cvu-stack"><article class="dash-panel"><div class="cvu-busy" role="status"><strong>Saving your ticked items</strong><div class="cvu-bar"><i></i></div><small class="cvu-note">Please keep this page open.</small></div></article></div>`;
  }

  function viewDone() {
    const r = done;
    const figures = [["New certificates", r.certs], ["Certificates updated", r.updated], ["Files attached", r.attached], ["Sea time entries", r.seatime], ["Payslips", r.payslips], ["Qualifications", r.specialist], ["Interests", r.interests]].filter(([, n]) => n);
    const later = [];
    if (r.toConfirm) later.push(["Certificate dates to confirm", `${r.toConfirm} ${r.toConfirm === 1 ? "certificate says" : "certificates say"} “date to confirm” until you add one. You'll see them in Needs attention on your dashboard.`]);
    if (r.seatime) later.push(["Your captain's signature", "Ask for it from your Sea Time page, so the entry can be confirmed."]);
    return `<div class="cvu-stack">
      ${r.failed.length ? `<div class="cvu-alert" role="alert">These didn't save: ${esc(r.failed.join(", "))}. Check your connection, then try them again.</div>` : ""}
      ${r.cv ? `<article class="dash-panel">${head(ICONS.file, "One more step: your CV")}<div class="cvu-body"><small class="cvu-note">We've read ${esc(r.cv)}. Check your yachts and certificates next.</small><p class="du-next"><a class="btn-blue cvu-go" href="cv-upload.html">Check my CV</a></p></div></article>` : ""}
      <article class="dash-panel">${head(ICONS.ok, "What was added")}
        ${figures.length ? `<dl class="dash-figures">${figures.map(([label, n]) => `<div><dt>${esc(label)}</dt><dd>${n}</dd></div>`).join("")}</dl>` : `<div class="cvu-body"><small class="cvu-note">Nothing was ticked, so nothing was added.</small></div>`}
        <div class="dash-panel-note"><small>If your public profile is switched on, new certificates and interests now show on it. Payslips and files never do.</small></div>
      </article>
      ${later.length ? `<article class="dash-panel">${head(ICONS.later, "To finish later")}<ul class="cvu-out">${later.map(([title, line]) => `<li><strong>${esc(title)}</strong><small class="cvu-note">${esc(line)}</small></li>`).join("")}</ul></article>` : ""}
      <div class="du-end"><a class="btn-blue cvu-go" href="dashboard.html">Go to my dashboard</a><button type="button" class="cvu-btn" id="duAgain">Upload more</button></div>
    </div>`;
  }

  function viewClosed() {
    return `<div class="cvu-stack"><article class="dash-panel"><div class="cvu-body"><strong>Coming soon</strong><small class="cvu-note">You'll be able to add your documents here.</small></div></article></div>`;
  }

  const main = () => document.getElementById("duMain");

  function render() {
    const mount = main();
    if (!mount) return;
    const scroll = window.scrollY;
    mount.innerHTML =
      view.step === "closed" ? viewClosed()
        : view.step === "reading" ? viewReading()
          : view.step === "saving" ? viewBusy()
            : view.step === "check" ? viewCheck()
              : view.step === "done" ? viewDone()
                : viewUpload();
    if (view.step === "check" || view.step === "reading") window.scrollTo(0, scroll);
  }

  const docById = (id) => docs.find((doc) => doc.id === id);
  const certById = (id) => docs.flatMap((doc) => doc.certs || []).find((cert) => cert.id === id);

  function wire() {
    const mount = main();
    mount.addEventListener("change", (event) => {
      const t = event.target;
      if (t.id === "duFiles") {
        if (t.files?.length) startReading(t.files);
        return;
      }
      if (t.dataset.docOn) docById(t.dataset.docOn).on = t.checked;
      else if (t.dataset.certOn) {
        certById(t.dataset.certOn).on = t.checked;
      } else if (t.dataset.home) docById(t.dataset.home).home = t.value;
      else if (t.dataset.type) {
        const doc = docById(t.dataset.type);
        const hasData = (t.value === "certificate" && doc.certs.length) || (t.value === "testimonial" && doc.sea) || (t.value === "payslip" && doc.pay) || (t.value === "cv" && doc.result.cv);
        doc.type = t.value;
        doc.on = !!hasData && t.value !== "cv";
        if (!hasData) doc.type = "other";
        doc.open = true;
      } else if (t.dataset.expiry) {
        const cert = certById(t.dataset.expiry);
        cert.expiryChoice = t.value;
      } else if (t.dataset.expiryDate) {
        certById(t.dataset.expiryDate).expiryAdded = t.value;
        return;
      } else if (t.dataset.consent) docById(t.dataset.consent).consent = t.checked;
      else if (t.dataset.keep) docById(t.dataset.keep).keepFile = t.checked;
      else if (t.dataset.sea) {
        const value = number(t.value);
        docById(t.dataset.sea).sea.days[t.dataset.field] = value;
        return;
      } else return;
      const doc = docs.find((row) => (row.certs || []).some((cert) => cert.id === (t.dataset.expiry || t.dataset.certOn)) || [t.dataset.docOn, t.dataset.home, t.dataset.consent, t.dataset.keep].includes(row.id));
      if (doc) doc.open = true;
      render();
    });
    mount.addEventListener("click", (event) => {
      const t = event.target;
      if (t.closest("#duSave")) { saveAll(); return; }
      if (t.closest("#duAgain")) { view = { step: "upload" }; render(); return; }
      const toggle = t.closest("[data-toggle]");
      const viewFile = t.closest("[data-view-file]");
      const docAnswer = t.closest("[data-doc-answer]");
      const certAnswer = t.closest("[data-cert-answer]");
      const seaCheck = t.closest("[data-sea-check]");
      if (viewFile) {
        const url = URL.createObjectURL(docById(viewFile.dataset.viewFile).file);
        window.open(url, "_blank", "noopener");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }
      if (toggle) {
        const doc = docById(toggle.dataset.toggle);
        doc.open = !doc.open;
      } else if (docAnswer) {
        const doc = docById(docAnswer.dataset.docAnswer);
        doc.answers[docAnswer.dataset.value] = true;
        doc.open = true;
      } else if (certAnswer) {
        certById(certAnswer.dataset.certAnswer).answer = certAnswer.dataset.value;
        docs.find((row) => (row.certs || []).some((c) => c.id === certAnswer.dataset.certAnswer)).open = true;
      } else if (seaCheck) {
        const doc = docById(seaCheck.dataset.seaCheck);
        doc.sea.checked = !doc.sea.checked;
        doc.open = true;
      } else return;
      render();
    });
  }

  async function init() {
    if (!main()) return;
    wire();
    await window.SeavAuth?.whenReady?.();
    const open = await window.SeavAPI.canReadCv().catch(() => false);
    if (!open) view = { step: "closed" };
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
