// /js/seav-doc-drop.js — "Add from a document" on Certificates, Payslips, Sea Time and
// Specialist Qualifications (v629, Jack 2026-11-07). Plan and test results:
// docs/product/cv-upload-plan-2026-11-05.md. Mockup: design-concepts/section-drop/.
// One file at a time, in the section it belongs to, "so people think before uploading".
// The edge function doc-read reads it, this panel shows the file beside what it found,
// and nothing is saved until Save, through the same save code as the normal forms.
// Everything from a document is untrusted, so it is escaped and every code is checked.
// Open to every signed-in member. Nothing is read until the agreement is ticked.
(function () {
  "use strict";

  const esc = (value) => window.Seav.escapeHtml(value);
  const D = () => window.SeavData;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 2000;
  const DATE_CLOSE_DAYS = 31;
  const TO_CONFIRM = "Date to confirm";
  const READ_ERRORS = {
    not_set_up: "The reader isn't switched on yet. Nothing was saved.",
    not_open: "This isn't open yet. Nothing was saved.",
    limit: "You've used today's reads. Try again tomorrow. Nothing was saved.",
    busy: "A lot of documents have been read today. Try again tomorrow. Nothing was saved.",
    too_big: "That file is too big. Try one under 10 MB. Nothing was saved.",
    signin: "Please sign in again, then try once more.",
    type: "We can't read this kind of file. Try a PDF, Word file or photo. Nothing was saved.",
    cannot_read: "We couldn't read that file. It may be password protected or a poor scan. Nothing was saved."
  };
  const SECTIONS = {
    certificate: { noun: "certificate", drop: "Drop your certificate here", expects: "certificate" },
    specialist: { noun: "qualification", drop: "Drop your qualification here", expects: "certificate" },
    payslip: { noun: "payslip", drop: "Drop your payslip here", expects: "payslip" },
    testimonial: { noun: "sea service testimonial", drop: "Drop your sea service testimonial here", expects: "testimonial" }
  };
  const ELSEWHERE = {
    certificate: { label: "a certificate", where: "Certificates", href: "certificates.html" },
    payslip: { label: "a payslip", where: "Payslips", href: "payslips.html" },
    testimonial: { label: "a sea service testimonial", where: "Sea Time", href: "seatime.html" },
    cv: { label: "a CV", where: "Upload my CV", href: "cv-upload.html" },
    contract: { label: "a contract", where: "Vessels", href: "vessels.html" },
    reference: { label: "a reference letter", where: "References", href: "references.html" }
  };
  const ICON = '<span class="dash-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6V3ZM14 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  const clean = (value) => String(value ?? "").trim();
  const fullDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(clean(value)) && !Number.isNaN(D().parseDateOnly(clean(value)).getTime()) ? clean(value) : "");
  const pretty = (value) => (value ? D().formatDatePretty(value) : "Not shown");
  const sameName = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
  const number = (value) => {
    const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && clean(value) !== "" ? n : "";
  };
  const customCode = (name) => name.slice(0, 24).toUpperCase().replace(/\s+/g, "_");
  const daysApart = (a, b) => Math.abs(D().parseDateOnly(a) - D().parseDateOnly(b)) / 86400000;

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

  function mount(options) {
    const section = SECTIONS[options.section];
    const actions = document.querySelector(options.actions);
    const pageHead = actions?.closest('[class$="-shell-head"]');
    if (!section || !actions || !pageHead) return;

    const panel = document.createElement("section");
    panel.className = "dd-panel";
    panel.hidden = true;
    pageHead.after(panel);

    const button = document.createElement("a");
    button.className = "btn-ghost2";
    button.href = "#";
    button.textContent = options.label || "Add from a document";
    button.setAttribute("aria-expanded", "false");
    button.hidden = true;
    actions.insertBefore(button, actions.querySelector(".btn-blue"));

    let view = "closed";
    let doc = null;
    let message = "";
    let saved = "";

    /* ---------- Reading ---------- */

    async function read(hint = "") {
      view = "reading";
      render();
      try {
        const kind = fileKind(doc.file);
        const content = kind === "pdf" ? await toBase64(doc.file)
          : kind === "word" ? await window.SeavUpload.docxText(doc.file)
            : await imageForReading(doc.file);
        doc.result = await window.SeavAPI.readDocument({
          kind,
          file: content,
          mediaType: kind === "image" ? "image/jpeg" : "",
          hint,
          positions: D().SEAFARER_POSITIONS.flatMap((group) => group.roles.map((role) => role.label)),
          catalog: D().getCertificateCatalog().map((item) => ({ code: item.code, name: item.name }))
        });
      } catch (err) {
        console.warn("[SEA-V] Document read failed:", err?.code || "unknown");
        message = READ_ERRORS[err?.code] || READ_ERRORS.cannot_read;
        view = "ready";
        clearFile();
        render();
        return;
      }
      prepare(hint);
      render();
    }

    function clearFile() {
      if (doc?.fileUrl) URL.revokeObjectURL(doc.fileUrl);
      doc = null;
    }

    let agreed = false;

    function takeFiles(files) {
      message = "";
      saved = "";
      if (files.length > 1) {
        message = "One file at a time, please. Nothing was read.";
        view = "ready";
        render();
        return;
      }
      const file = files[0];
      if (!file) return;
      if (!agreed) {
        message = "Please tick the box to agree first. Nothing was read.";
        view = "ready";
        render();
        return;
      }
      if (!fileKind(file)) message = READ_ERRORS.type;
      else if (file.size > MAX_FILE_BYTES) message = READ_ERRORS.too_big;
      if (message) {
        view = "ready";
        render();
        return;
      }
      clearFile();
      doc = { file, fileUrl: URL.createObjectURL(file), keepFile: true, consent: false, answers: {} };
      if (fileKind(file) === "image" && !window.SeavUpload?.isHeicFile?.(file)) doc.preview = doc.fileUrl;
      read();
    }

    /* ---------- What the read means here ---------- */

    function savedCerts() {
      return (window.SeavState?.certs || []).filter((cert) => (D().isSavedCert ? D().isSavedCert(cert) : !!cert.name));
    }

    function certRow(row, index) {
      const items = (row.codes || []).map((code) => D().findCertificateCatalogItem(code)).filter(Boolean);
      const name = items[0]?.name || clean(row.name_as_written);
      const out = {
        id: `dd_c${index}`,
        item: items[0] || null,
        name,
        number: clean(row.number),
        issued: fullDate(row.issued),
        expiry: fullDate(row.expiry),
        expiryBasis: clean(row.expiry_basis),
        issuer: clean(row.issuer),
        noExpiry: false,
        on: true,
        state: "new"
      };
      if (options.section !== "certificate") return out;
      const existing = savedCerts().find((cert) => (out.item ? cert.code === out.item.code : sameName(cert.name, name)));
      out.existing = existing || null;
      if (existing) {
        const theirs = fullDate(existing.issued);
        if (!out.issued || !theirs || out.issued === theirs) {
          out.state = "same";
          out.on = !existing.attachment;
        } else if (daysApart(out.issued, theirs) <= DATE_CLOSE_DAYS) {
          // This close, it is more likely a misread than a renewal.
          out.state = "differs";
        } else if (out.issued < theirs) {
          out.state = "older";
          out.on = false;
        } else {
          out.state = "newer";
        }
      }
      return out;
    }

    function findOverlap(from, to, ownId) {
      const start = D().parseDateOnly(from);
      const end = to ? D().parseDateOnly(to) : new Date();
      return (window.SeavState?.seatimes || []).find((entry) => {
        if (entry.id === ownId || !entry.dateJoined) return false;
        const theirStart = D().parseDateOnly(entry.dateJoined);
        const theirEnd = entry.dateLeft ? D().parseDateOnly(entry.dateLeft) : new Date();
        const shared = (Math.min(end, theirEnd) - Math.max(start, theirStart)) / 86400000;
        return shared >= 1; // One changeover day is allowed, as on the Sea Time form.
      });
    }

    function prepare(hint) {
      const result = doc.result;
      doc.type = result.doc_type;
      doc.holder = result.holder || {};
      doc.hinted = hint;
      if (doc.type !== section.expects) {
        view = "wrong";
        return;
      }
      view = "check";
      if (doc.type === "certificate") {
        doc.certs = (result.certificates || []).filter((row) => clean(row?.name_as_written)).map(certRow);
        doc.medical = doc.certs.some((cert) => D().isMedicalFitnessCert?.({ code: cert.item?.code, name: cert.name }));
        if (!doc.certs.length) view = "wrong";
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
        const known = (D().PAYSLIP_CURRENCIES || []).some((c) => (c.value || c) === clean(p.currency));
        doc.pay = { date: fullDate(p.pay_date), yacht: clean(p.yacht), vesselId: vessel?.id || "", employer: clean(p.employer), gross: number(p.gross), net: number(p.net), currency: known ? clean(p.currency) : "OTHER" };
      }
    }

    // Every question has to be answered before Save: there is only one document in hand.
    function openQuestions() {
      if (!doc) return 0;
      let count = 0;
      if (doc.holder?.birth_matches === false && !doc.answers.birth) count += 1;
      if (doc.holder?.name_matches === false && !doc.answers.name) count += 1;
      (doc.certs || []).filter((cert) => cert.on && cert.state === "differs" && !cert.answer).forEach(() => { count += 1; });
      if (doc.sea && !doc.sea.checked) count += 1;
      return count;
    }

    /* ---------- Saving ---------- */

    // The site's date fields live in the page, so what's typed is read back before a redraw.
    function readDates() {
      if (!doc) return;
      (doc.certs || []).forEach((cert) => {
        if (document.getElementById(`${cert.id}i_year`)) cert.issued = window.Seav.readDateTriplet(`${cert.id}i`);
        if (document.getElementById(`${cert.id}e_year`)) cert.expiry = window.Seav.readDateTriplet(`${cert.id}e`);
      });
      if (doc.sea && document.getElementById("dd_from_year")) {
        doc.sea.from = window.Seav.readDateTriplet("dd_from");
        doc.sea.to = window.Seav.readDateTriplet("dd_to");
      }
      if (doc.pay && document.getElementById("dd_pay_year")) doc.pay.date = window.Seav.readDateTriplet("dd_pay");
    }

    async function upload(bucket, entityId, kind, extra) {
      if (!doc.keepFile) return null;
      const stored = await window.SeavUpload.uploadToStorage({ bucket, entityId, file: doc.file, existingMeta: null, kind });
      return stored ? { ...stored, ...extra } : null;
    }

    function expiryFields(cert) {
      if (cert.noExpiry) return { expiry: "", status: "No Expiry" };
      if (cert.expiry) return { expiry: cert.expiry, status: D().getCertExpiryInfo(cert.expiry).badge || "Valid" };
      return { expiry: "", status: TO_CONFIRM };
    }

    async function saveCert(cert) {
      const { KEYS, createId } = D();
      if (options.section === "specialist") {
        const id = createId("specialist");
        const attachment = await upload("specialist-qualification-files", id, "Qualification");
        await window.SeavAPI.addItem(KEYS.SPECIALIST_QUALIFICATIONS, { id, category: "other", title: cert.name, issuingBody: cert.issuer, dateObtained: cert.issued || null, expiry: cert.expiry || null, attachment });
        return;
      }
      const attachable = !doc.medical || doc.consent;
      const consent = doc.medical && doc.consent ? { healthConsentAt: new Date().toISOString() } : null;
      if (cert.existing) {
        const useDates = cert.state === "newer" || (cert.state === "differs" && cert.answer === "use");
        const existing = cert.existing;
        const attachment = attachable && (!existing.attachment || useDates) ? await upload("certificate-files", existing.id, "Certificate", consent) : null;
        if (!useDates && !attachment) return;
        const dates = useDates ? { issued: cert.issued, ...expiryFields(cert) } : {};
        await window.SeavAPI.updateItemById(KEYS.CERTS, existing.id, { ...existing, ...dates, attachment: attachment || existing.attachment || null, certificateNumber: existing.certificateNumber || cert.number });
        return;
      }
      const id = createId("cert");
      const attachment = attachable ? await upload("certificate-files", id, "Certificate", consent) : null;
      await window.SeavAPI.addItem(KEYS.CERTS, {
        id,
        code: cert.item?.code || customCode(cert.name),
        name: cert.name,
        issued: cert.issued,
        ...expiryFields(cert),
        attachment,
        isMandatory: !!cert.item?.isMandatory,
        isTemplate: false,
        showOnCv: true,
        trainingProvider: cert.issuer,
        certificateNumber: cert.number
      });
    }

    async function save() {
      readDates();
      // The Save button is not redrawn for a half-picked date, so this checks again.
      const badSea = doc.sea && (!doc.sea.from || findOverlap(doc.sea.from, doc.sea.to));
      if (openQuestions() || badSea || (doc.pay && !doc.pay.date)) {
        render();
        return;
      }
      const { KEYS, createId } = D();
      view = "saving";
      render();
      try {
        if (doc.certs) {
          const chosen = doc.certs.filter((cert) => cert.on);
          for (const cert of chosen) await saveCert(cert);
          saved = chosen.length
            ? `${chosen.map((cert) => cert.name).join(", ")} saved.`
            : "Nothing was ticked, so nothing changed.";
          if (chosen.some((cert) => expiryFields(cert).status === TO_CONFIRM && options.section === "certificate")) {
            saved += " It says “date to confirm” until you add one.";
          }
        } else if (doc.sea) {
          const id = createId("seatime");
          const attachment = await upload("seatime-files", id, "Sea service testimonial");
          await window.SeavAPI.addItem(KEYS.SEATIMES, {
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
          saved = "Sea time entry saved. Ask your captain to confirm it from the Actions menu on its row.";
        } else if (doc.pay) {
          const id = createId("payslip");
          const attachment = await upload("payslip-files", id, "Payslip");
          const payMonth = doc.pay.date.slice(5, 7);
          await window.SeavAPI.addItem(KEYS.PAYSLIPS, {
            id,
            taxYear: D().inferUkTaxYear(doc.pay.date),
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
          saved = "Payslip saved.";
        }
      } catch (err) {
        console.error("[SEA-V] Document save failed:", err);
        message = "That didn't save. Check your connection and try again.";
        view = "check";
        render();
        return;
      }
      clearFile();
      view = "done";
      render();
      await window.SeavState?.refresh?.();
      document.dispatchEvent(new CustomEvent("seav:data-updated"));
    }

    /* ---------- Screens ---------- */

    const head = (title) => `<div class="dash-panel-head"><span class="dash-panel-heading">${ICON}<h3 class="dash-panel-title">${esc(title)}</h3></span><button type="button" class="dash-panel-more" data-dd-close><small>Close</small></button></div>`;
    const answered = (text, attrs) => `<div class="du-flag is-done"><div><strong><span aria-hidden="true">✓ </span>${text}</strong></div><div class="cvu-actions"><button type="button" class="dash-panel-more" ${attrs}><small>Change</small></button></div></div>`;
    const alert = () => (message ? `<div class="cvu-alert" role="alert">${esc(message)}</div>` : "");

    function viewReady() {
      return `<article class="dash-panel">${head(options.label || "Add from a document")}<div class="cvu-body">
        ${alert()}
        <div class="cvu-drop" data-dd-drop>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <label for="ddFile"><strong>${esc(section.drop)}</strong></label>
          <input type="file" id="ddFile" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.heic,.heif,application/pdf,image/*">
          <small class="cvu-note">One file at a time. PDF, Word or a photo, up to 10 MB.</small>
        </div>
        <label class="du-consent"><input type="checkbox" data-dd-agree${agreed ? " checked" : ""}><small>I agree to this file being read by Claude, Anthropic's AI, including any health details it shows. <a href="privacy.html#document-reading">How this works</a></small></label>
        <div class="cvu-points">
          <div><strong>You stay in charge</strong><small class="cvu-note">Nothing is added until you check it and press Save.</small></div>
          <div><strong>What happens to the file</strong><small class="cvu-note">Claude reads it once. Anthropic doesn't train on it and deletes it within 30 days. We keep it only if you add it to a record, in your private storage.</small></div>
          <div><strong>Only this kind of document</strong><small class="cvu-note">Anything else is sent back, and we'll say where it goes. Please don't upload passports or ID.</small></div>
        </div>
      </div></article>`;
    }

    function viewBusy(title, line) {
      return `<article class="dash-panel"><div class="cvu-busy" role="status"><strong>${esc(title)}</strong><div class="cvu-bar"><i></i></div><small class="cvu-note">${esc(line)}</small></div></article>`;
    }

    function viewWrong() {
      const passport = doc.type === "passport_or_id";
      const other = ELSEWHERE[doc.type];
      const asked = doc.hinted && doc.type === section.expects;
      const text = passport
        ? "This looks like a passport or ID, so nothing was taken from it and it wasn't kept. Add your passport countries on your profile."
        : asked
          ? `We read it again as a ${section.noun}, but couldn't find those details. You can add it by hand instead.`
          : other
            ? `This looks like ${other.label}, so we didn't add it here.`
            : `This doesn't look like a ${section.noun}, so we didn't add it.`;
      return `<article class="dash-panel">${head(options.label || "Add from a document")}<div class="cvu-body">
        <div class="du-flag is-quiet"><div><strong>${esc(doc.file.name)}</strong><small class="cvu-note">${esc(text)}</small></div>
          <div class="cvu-actions">
            ${other && !asked ? `<a class="cvu-btn dd-link" href="${esc(other.href)}">Go to ${esc(other.where)}</a>` : ""}
            ${!passport && !asked ? `<button type="button" class="cvu-btn" data-dd-again>It is a ${esc(section.noun)}, read it again</button>` : ""}
            <button type="button" class="cvu-btn" data-dd-another>Try another file</button>
          </div></div>
      </div></article>`;
    }

    function dateField(prefix, label, optional) {
      return `<div data-date-field="${prefix}" data-date-label="${esc(label)}"${optional ? " data-date-optional" : ""}></div>`;
    }

    function certBlock(cert) {
      const theirs = cert.existing;
      const editable = ["new", "newer", "differs"].includes(cert.state);
      let note = "";
      if (cert.state === "older") note = `Your record shows ${esc(pretty(theirs.issued))}, so its dates won't change. Tick this only to add this file to it.`;
      if (cert.state === "newer") note = `Your record shows ${esc(pretty(theirs.issued))}. Saving updates its dates and adds this file.`;
      if (cert.state === "same") note = theirs?.attachment ? "This matches your record, which already has a file. Nothing to do." : "This matches your record. Saving adds this file to it.";
      const pill = { new: cert.item ? "New" : "New, your own entry", same: "Already in your records", newer: "Newer than your record", older: "Older than your record", differs: "Already in your records" }[cert.state];
      return `<div class="du-record">
        <label class="du-tick"><input type="checkbox" data-dd-cert="${cert.id}"${cert.on ? " checked" : ""}><strong>${esc(cert.name)}</strong></label>
        <div><small class="cvu-pill">${esc(pill)}</small>${cert.issuer ? ` <small class="cvu-note dd-inline">${esc(cert.issuer)}</small>` : ""}</div>
        ${editable && cert.on ? `<div class="dd-dates">
          ${dateField(`${cert.id}i`, "Date issued", true)}
          <div>${dateField(`${cert.id}e`, "Expiry date", true)}
            ${cert.expiryBasis ? `<small class="cvu-note">Worked out from “${esc(cert.expiryBasis)}”. Please check it.</small>` : ""}
            <label class="du-consent"><input type="checkbox" data-dd-noexpiry="${cert.id}"${cert.noExpiry ? " checked" : ""}><small>This certificate doesn't expire</small></label>
            ${!cert.expiry && !cert.noExpiry ? `<small class="cvu-note">Not on this document. Add it if you can, or it will say “date to confirm”.</small>` : ""}
          </div>
        </div>` : ""}
        ${cert.state === "differs" && cert.on ? (cert.answer
          ? answered(cert.answer === "keep" ? `Keeping your date, ${esc(pretty(theirs.issued))}` : "Using the date above", `data-dd-cert-answer="${cert.id}" data-value=""`)
          : `<div class="du-flag"><div><strong>The date issued differs</strong><small class="cvu-note">Your record says ${esc(pretty(theirs.issued))}. This reads as ${esc(pretty(cert.issued))}. Small scans get misread, so check the file.</small></div>
            <div class="cvu-actions"><button type="button" class="cvu-btn" data-dd-cert-answer="${cert.id}" data-value="keep">Keep mine</button><button type="button" class="cvu-btn" data-dd-cert-answer="${cert.id}" data-value="use">Use this</button></div></div>`) : ""}
        ${note ? `<small class="cvu-note">${note}</small>` : ""}
      </div>`;
    }

    function holderFlags() {
      let html = "";
      if (doc.holder?.birth_matches === false) {
        html += doc.answers.birth
          ? answered("You've said this is yours", 'data-dd-answer="birth"')
          : `<div class="du-flag"><div><strong>The date of birth here doesn't match your profile</strong><small class="cvu-note">If this is yours, ask the issuer to correct it, or check your profile.</small></div><div class="cvu-actions"><button type="button" class="cvu-btn" data-dd-answer="birth">It's mine, add it</button></div></div>`;
      }
      if (doc.holder?.name_matches === false) {
        html += doc.answers.name
          ? answered("You've said this is yours", 'data-dd-answer="name"')
          : `<div class="du-flag"><div><strong>The name here doesn't match your profile</strong><small class="cvu-note">Please check this is your document.</small></div><div class="cvu-actions"><button type="button" class="cvu-btn" data-dd-answer="name">It's mine</button></div></div>`;
      }
      return html;
    }

    function seaBlock() {
      const s = doc.sea;
      const field = (key, label) => `<div><small class="cvu-label">${label}</small><input type="number" min="0" data-dd-day="${key}" value="${esc(s.days[key])}" aria-label="${label}"></div>`;
      const overlap = s.from ? findOverlap(s.from, s.to) : null;
      return `<div class="du-record"><strong>${esc(s.yacht || "Yacht not shown")}${s.role ? `, ${esc(s.role)}` : ""}</strong>
        ${s.vesselId ? "" : `<small class="cvu-note">This yacht isn't in your records yet, so the entry won't be linked to one. Add it under Vessels, then link it.</small>`}
        <div class="dd-dates">${dateField("dd_from", "Joined", true)}${dateField("dd_to", "Left", true)}</div>
        <div class="du-pair du-pair--4">${field("sea", "Sea days")}${field("standby", "Standby days")}${field("yard", "Yard days")}${field("watch", "Watchkeeping days")}</div>
        ${overlap ? `<div class="du-flag"><div><strong>These dates overlap another entry</strong><small class="cvu-note">Each day can only count once. Check the dates, or edit the other entry, before you save.</small></div></div>` : ""}
      </div>
      ${s.checked
        ? answered("You've checked these figures", "data-dd-sea-check")
        : `<div class="du-flag"><div><strong>These count towards your tickets</strong><small class="cvu-note">Check each figure against the document. It saves as a normal entry, not as confirmed by a captain. Only the captain's online answer can do that.</small></div><div class="cvu-actions"><button type="button" class="cvu-btn" data-dd-sea-check>I've checked them</button></div></div>`}`;
    }

    function payBlock() {
      const p = doc.pay;
      const money = (key, label) => `<div><small class="cvu-label">${label}${p.currency === "OTHER" ? "" : `, ${esc(p.currency)}`}</small><input type="number" step="0.01" min="0" data-dd-pay="${key}" value="${esc(p[key])}" aria-label="${label}"></div>`;
      return `<div class="du-record">
        <div class="dd-dates">${dateField("dd_pay", "Paid on", true)}<div><small class="cvu-label">Yacht</small><strong class="du-value">${esc(p.yacht || "Not shown")}</strong></div></div>
        <div class="du-pair">${money("gross", "Gross pay")}${money("net", "Net pay")}</div>
        <small class="cvu-note">Private. Never on your public profile or CV.</small>
      </div>`;
    }

    function viewCheck() {
      const picture = doc.preview
        ? `<img class="du-picture" src="${esc(doc.preview)}" alt="Your file, ${esc(doc.file.name)}">`
        : `<div class="du-tile"><strong>${esc({ pdf: "PDF", word: "Word", image: "Photo" }[fileKind(doc.file)] || "File")}</strong></div>`;
      const left = openQuestions();
      const payBlocked = doc.pay && !doc.pay.date;
      const seaBlocked = doc.sea && (!doc.sea.from || (doc.sea.from && findOverlap(doc.sea.from, doc.sea.to)));
      const blocked = left > 0 || payBlocked || seaBlocked;
      const note = left
        ? `${left} ${left === 1 ? "question" : "questions"} to answer before saving.`
        : payBlocked ? "Add the date it was paid before saving."
          : seaBlocked ? "Fix the dates before saving."
            : "Nothing is saved until you press Save.";
      return `<article class="dash-panel">${head("Check what we found")}
        ${message ? `<div class="cvu-body">${alert()}</div>` : ""}
        <div class="du-doc-top"><span class="cvu-yacht-name"><strong>${esc(doc.file.name)}</strong></span></div>
        <div class="du-doc-body">
          <div class="du-side">${picture}<a class="dash-panel-more" href="${esc(doc.fileUrl)}" target="_blank" rel="noopener">Open full size</a></div>
          <div class="du-fields">
            ${holderFlags()}
            ${(doc.certs || []).map(certBlock).join("")}
            ${doc.sea ? seaBlock() : ""}
            ${doc.pay ? payBlock() : ""}
            ${doc.medical && options.section === "certificate"
              ? `<label class="du-consent"><input type="checkbox" data-dd-consent${doc.consent ? " checked" : ""}><small>I agree to SEA-V storing my medical certificate. Without this, only the dates are saved.</small></label>`
              : `<label class="du-consent"><input type="checkbox" data-dd-keep${doc.keepFile ? " checked" : ""}><small>Keep this file on the record, in my private storage.</small></label>`}
          </div>
        </div>
        <div class="dd-save"><div><small>${esc(note)}</small></div>
          <div class="cvu-actions"><button type="button" class="dash-panel-more" data-dd-another><small>Use a different file</small></button><button type="button" class="cvu-btn" id="ddSave"${blocked ? " disabled" : ""}>Save</button></div></div>
      </article>`;
    }

    function viewDone() {
      return `<article class="dash-panel"><div class="dd-done"><strong><span aria-hidden="true">✓ </span>${esc(saved)}</strong>
        <div class="cvu-actions"><button type="button" class="cvu-btn" data-dd-another>Add another</button><button type="button" class="dash-panel-more" data-dd-close><small>Close</small></button></div></div></article>`;
    }

    function fillDates() {
      window.Seav.mountDateFields?.(panel);
      (doc?.certs || []).forEach((cert) => {
        if (document.getElementById(`${cert.id}i_year`)) window.Seav.fillDateTriplet(`${cert.id}i`, cert.issued);
        if (document.getElementById(`${cert.id}e_year`)) window.Seav.fillDateTriplet(`${cert.id}e`, cert.noExpiry ? "" : cert.expiry);
      });
      if (doc?.sea) {
        window.Seav.fillDateTriplet("dd_from", doc.sea.from);
        window.Seav.fillDateTriplet("dd_to", doc.sea.to);
      }
      if (doc?.pay) window.Seav.fillDateTriplet("dd_pay", doc.pay.date);
    }

    function render() {
      panel.hidden = view === "closed";
      button.setAttribute("aria-expanded", String(view !== "closed"));
      panel.innerHTML =
        view === "ready" ? viewReady()
          : view === "reading" ? viewBusy(`Reading ${doc.file.name}`, "About 10 seconds. Nothing is saved yet.")
            : view === "saving" ? viewBusy("Saving", "Please keep this page open.")
              : view === "wrong" ? viewWrong()
                : view === "check" ? viewCheck()
                  : view === "done" ? viewDone()
                    : "";
      if (view === "check") fillDates();
      if (view === "ready") window.SeavUpload?.enhanceDropZones?.();
    }

    function redraw() {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    }

    function close() {
      clearFile();
      message = "";
      view = "closed";
      render();
      button.focus();
    }

    /* ---------- Wiring ---------- */

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (view === "closed") {
        view = "ready";
        message = "";
        render();
        panel.scrollIntoView({ block: "nearest" });
      } else {
        close();
      }
    });

    panel.addEventListener("change", (event) => {
      const t = event.target;
      if (t.id === "ddFile") {
        takeFiles([...t.files]);
        return;
      }
      if ("ddAgree" in t.dataset) {
        agreed = t.checked;
        return;
      }
      const seaFrom = doc?.sea?.from;
      const seaTo = doc?.sea?.to;
      const paid = doc?.pay?.date;
      readDates();
      const cert = (id) => doc.certs.find((row) => row.id === id);
      if (t.dataset.ddCert) cert(t.dataset.ddCert).on = t.checked;
      else if (t.dataset.ddNoexpiry) cert(t.dataset.ddNoexpiry).noExpiry = t.checked;
      else if ("ddConsent" in t.dataset) doc.consent = t.checked;
      else if ("ddKeep" in t.dataset) doc.keepFile = t.checked;
      else if (t.dataset.ddDay) { doc.sea.days[t.dataset.ddDay] = number(t.value); return; }
      else if (t.dataset.ddPay) { doc.pay[t.dataset.ddPay] = number(t.value); return; }
      else if (t.closest(".modal-date-group") && (doc.sea || doc.pay)) {
        // Save depends on these dates, so it is checked again as they change. A half-picked
        // date is left alone, because drawing it again would put its year back to the start.
        const changed = (doc.sea?.from && doc.sea.from !== seaFrom) || (doc.sea?.to && doc.sea.to !== seaTo)
          || (doc.pay?.date && doc.pay.date !== paid);
        if (!changed) return;
        redraw();
        document.getElementById(t.id)?.focus();
        return;
      }
      else return;
      redraw();
    });

    panel.addEventListener("click", (event) => {
      const t = event.target;
      if (t.closest("[data-dd-close]")) { close(); return; }
      if (t.closest("#ddSave")) { save(); return; }
      if (t.closest("[data-dd-another]")) {
        clearFile();
        message = "";
        view = "ready";
        render();
        return;
      }
      if (t.closest("[data-dd-again]")) { read(section.expects); return; }
      const certAnswer = t.closest("[data-dd-cert-answer]");
      const answer = t.closest("[data-dd-answer]");
      if (!certAnswer && !answer && !t.closest("[data-dd-sea-check]")) return;
      readDates();
      if (certAnswer) doc.certs.find((row) => row.id === certAnswer.dataset.ddCertAnswer).answer = certAnswer.dataset.value;
      else if (answer) doc.answers[answer.dataset.ddAnswer] = !doc.answers[answer.dataset.ddAnswer];
      else doc.sea.checked = !doc.sea.checked;
      redraw();
    });

    // A drop can carry several files, which a single-file input would quietly trim.
    panel.addEventListener("drop", (event) => {
      if (view !== "ready" || !event.dataTransfer?.files?.length) return;
      event.preventDefault();
      event.stopPropagation();
      takeFiles([...event.dataTransfer.files]);
    }, true);

    /* ---------- Signed-in members only ---------- */

    (async () => {
      await window.SeavAuth?.whenReady?.();
      const open = await window.SeavAPI?.canReadCv?.().catch(() => false);
      if (!open) return;
      button.hidden = false;
      // Nothing here yet: this is the quickest way to start, so it starts open.
      await window.SeavState?.loadAll?.().catch?.(() => {});
      if (options.isEmpty?.() && window.SeavState?.ready && view === "closed") {
        view = "ready";
        render();
      }
    })();
  }

  window.SeavDocDrop = { mount };
})();
