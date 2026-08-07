// /js/references.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before references.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before references.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before references.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before references.js?");
    return;
  }

  const {
    KEYS,
    createId,
    getSortedVesselOptions,
    formatDatePretty,
    getReferenceStatus,
    getReferenceStatusDisplay
  } = window.SeavData;
  const STORAGE_KEY = KEYS.REFS;
  // Mirrors the <select id="rf_doc_type"> options in references.html.
  // "reference" is the default/majority case, so it's the only one with no
  // label chip on the card (see isSpecialDocType below) -- Probation Review
  // and Annual Appraisal are the exception cases worth flagging at a glance.
  const REFERENCE_DOC_TYPE_LABELS = {
    reference: "Reference",
    probation_review: "Probation Review",
    annual_appraisal: "Annual Appraisal"
  };
  const VERIFY_LINK_KEY_PREFIX = "seav_ref_verify_url_";
  const REF_FILES_BUCKET =
    window.SeavApiCore?.STORAGE_BUCKETS?.REFERENCE_FILES || "reference-files";
  // Mirrors js/certificates.js's expandedCertIds — cards render collapsed
  // (name/vessel/role/period/status only) by default, expand for the quote,
  // sectioned details, attachment, and actions.
  const expandedRefIds = new Set();

  // References are grouped into a collapsible section per document type
  // (mirrors the <details class="tender-vessel-group"> pattern in
  // js/tenders.js and the seatime-vessel-group pattern in js/seatime.js).
  // All groups default open since this list used to be flat and ungrouped
  // — nothing should visually disappear the first time this ships.
  // Unlike those two pages, References also has a per-card expand/collapse
  // toggle that rebuilds refsList.innerHTML directly (see the
  // data-toggle-ref-id handler below) — without tracking which group the
  // user had open/closed, that full rebuild would silently re-collapse any
  // group the user had just opened. The "toggle" event on <details> doesn't
  // bubble but IS reachable via a capture-phase listener, so we track state
  // that way instead of threading it through every render call.
  const expandedDocTypeGroups = new Set(Object.keys(REFERENCE_DOC_TYPE_LABELS));

  const REFERENCE_DOC_TYPE_ORDER = Object.keys(REFERENCE_DOC_TYPE_LABELS);

  function buildReferenceDocTypeGroups(sortedRefs) {
    const groups = new Map();
    sortedRefs.forEach((r) => {
      const key = REFERENCE_DOC_TYPE_ORDER.includes(r.docType) ? r.docType : "reference";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    return REFERENCE_DOC_TYPE_ORDER
      .map((key) => ({
        key,
        label: REFERENCE_DOC_TYPE_LABELS[key],
        refs: groups.get(key) || []
      }))
      .filter((group) => group.refs.length > 0);
  }

  function renderGroupedReferenceCards(sortedRefs) {
    const groups = buildReferenceDocTypeGroups(sortedRefs);
    // Only one doc type present (the common case pre-launch) — grouping
    // adds a collapsible wrapper with nothing to sort, so skip it and
    // render the flat card list exactly as before.
    if (groups.length <= 1) {
      return sortedRefs.map((r) => buildReferenceCard(r)).join("");
    }

    return groups
      .map((group) => {
        const isOpen = expandedDocTypeGroups.has(group.key);
        return `
          <details class="reference-doc-type-group" data-doctype-group="${group.key}"${isOpen ? " open" : ""}>
            <summary class="reference-doc-type-group-summary">
              <span class="reference-doc-type-group-title">
                <strong>${Seav.escapeHtml(group.label)}</strong>
              </span>
              <span class="reference-doc-type-group-count">${group.refs.length}</span>
            </summary>
            <div class="reference-doc-type-group-body">
              ${group.refs.map((r) => buildReferenceCard(r)).join("")}
            </div>
          </details>
        `;
      })
      .join("");
  }

  document.addEventListener(
    "toggle",
    (e) => {
      const details = e.target?.closest?.("[data-doctype-group]");
      if (!details) return;
      const key = details.getAttribute("data-doctype-group");
      if (details.open) expandedDocTypeGroups.add(key);
      else expandedDocTypeGroups.delete(key);
    },
    true
  );

  function rememberVerifyLink(refId, verifyUrl) {
    if (!refId || !verifyUrl) return;
    try {
      sessionStorage.setItem(verifyLinkStorageKey(refId), verifyUrl);
    } catch (err) {
      console.warn("[SEA-V] Could not store verification link:", err);
    }
  }

  function readStoredVerifyLink(refId) {
    if (!refId) return "";
    try {
      return sessionStorage.getItem(verifyLinkStorageKey(refId)) || "";
    } catch {
      return "";
    }
  }

  function verifyLinkStorageKey(refId) {
    const userId = window.SeavAuth?.getUserId?.();
    return `${VERIFY_LINK_KEY_PREFIX}${userId ? `${userId}_` : ""}${refId}`;
  }

  function getRefs() {
    return window.SeavState?.refs || [];
  }

  function getVessels() {
    return window.SeavState?.vessels || [];
  }

  function getSortedRefs() {
    return [...getRefs()].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });
  }

  // Mirrors Onboard Experience's formatDateRange (js/onboard-experience.js)
  // for the same "Date from / Date to" picker pattern. Falls back to the
  // legacy free-text r.period string for references saved before this field
  // became a date range, so older entries don't just show "—".
  function formatDateRange(from, to, legacyPeriod) {
    if (!from && !to) return legacyPeriod ? legacyPeriod : "—";
    const start = from ? formatDatePretty(from) : "—";
    const end = to ? formatDatePretty(to) : "Ongoing";
    return `${start} → ${end}`;
  }

  function maskCoc(coc) {
    const raw = String(coc || "").trim();
    if (!raw) return "—";
    if (raw.length <= 4) return raw;
    return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
  }

  function populateReferenceVesselOptions() {
  const select = document.getElementById("rf_vessel");
  if (!select || select.tagName !== "SELECT") return;

  const currentValue = select.value || "";
  const vessels = getSortedVesselOptions(getVessels());

  select.innerHTML = `
    <option value="">Choose from your vessel list</option>
    ${vessels
      .map(
        (v) =>
          `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name)}</option>`
      )
      .join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }

  // Linking a vessel is optional here, so zero vessels doesn't block the
  // form -- just note it so it reads as a deliberate choice, not a bug.
  const note = document.getElementById("rfNoVesselNote");
  if (note) note.hidden = vessels.length > 0;
}

  async function hydrateReferenceAttachments(refs) {
    if (!window.SeavApiCore?.hydrateItemsFileField) return refs;
    await window.SeavApiCore.hydrateItemsFileField(refs, "attachment", REF_FILES_BUCKET);

    if (!window.SeavApiCore?.hydrateFileMeta) return refs;

    await Promise.all(
      refs.map(async (ref) => {
        const signatureImage = ref.verification?.signatureImage;
        // Always re-resolve via path when one exists — a stored .url is a
        // short-lived (1hr) Supabase signed URL, never a permanent link, so
        // treating its mere presence as "already fresh" (the old check here)
        // let it silently expire in the DB and break the <img> forever.
        // hydrateFileMeta/resolveStorageFileUrl already prefer path over a
        // stale url and cache the result for the session, so this is cheap.
        if (!signatureImage?.path || signatureImage.dataUrl) return;
        const hydrated = await window.SeavApiCore.hydrateFileMeta(
          signatureImage,
          REF_FILES_BUCKET
        );
        if (hydrated) {
          ref.verification = { ...ref.verification, signatureImage: hydrated };
        }
      })
    );

    return refs;
  }

  // Status label/color map lives in js/seav-data.js (shared with the
  // dashboard snippet) so both surfaces agree on wording and colors.
  function referenceStatusPill(status) {
    const info = getReferenceStatusDisplay(status);
    if (!info.visible) return "";
    return `<span class="${info.className}">${Seav.escapeHtml(info.label)}</span>`;
  }

  function getRefereeInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return (parts[0]?.charAt(0) || "?").toUpperCase();
  }

  function truncateText(text, max = 140) {
    return window.SeavData?.truncateText
      ? window.SeavData.truncateText(text, max)
      : String(text || "").trim().slice(0, max);
  }

  // ref.text is now always referee-authored (written on verify-reference.html
  // when they confirm), never crew-supplied, so it's the excerpt on its own
  // merit — no need to prefer verification.note over it like before, when
  // ref.text was self-reported by the crew member. verification.note is a
  // separate, optional short confirmation blurb, shown in its own meta item
  // in the Verification section instead (see buildReferenceCard).
  function getReferenceExcerpt(ref) {
    return ref.text || "";
  }

  // Mirrors js/onboard-experience.js's isImageAttachment/renderAttachmentSection
  // pattern — previously the reference attachment was just a small text link
  // (.ref-meta-link) buried in the meta grid, easy to miss. This renders a
  // large embedded preview (image thumbnail, or a prominent file tile for
  // PDFs) as its own section on the card instead.
  function isImageAttachment(attachment, url) {
    const mime = String(attachment?.mime || attachment?.mimetype || "").toLowerCase();
    const name = String(attachment?.filename || attachment?.name || url || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
  }

  function renderReferenceAttachmentSection(attachment, fileUrl) {
    if (!fileUrl) return "";

    const filename = attachment?.filename || "Reference attachment";
    const safeUrl = Seav.escapeHtml(fileUrl);
    const safeName = Seav.escapeHtml(filename);

    if (isImageAttachment(attachment, fileUrl)) {
      return `
        <div class="ref-detail-section">
          <div class="ref-section-label">Attachment</div>
          <a class="reference-attachment-preview" href="${safeUrl}" target="_blank" rel="noopener">
            <img class="reference-attachment-image" src="${safeUrl}" alt="${safeName}" loading="lazy" />
          </a>
        </div>
      `;
    }

    return `
      <div class="ref-detail-section">
        <div class="ref-section-label">Attachment</div>
        <a class="reference-attachment-file" href="${safeUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M14 3.5V8h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
          <span>${safeName}</span>
        </a>
      </div>
    `;
  }

  function referenceMetaItem(label, valueHtml) {
    return `
      <div class="vessel-meta-item">
        <span class="vessel-meta-label">${Seav.escapeHtml(label)}</span>
        <span class="vessel-meta-value">${valueHtml}</span>
      </div>
    `;
  }

  function buildReferenceCard(r) {
    const refId = r.id || "";
    const refFileUrl = Seav.getFileDisplayUrl(r.attachment, REF_FILES_BUCKET);
    const hasFile = !!refFileUrl;

    const vessel = getVessels().find((v) => v.id === r.vesselId);
    const vesselLabel = vessel?.name || "";

    const verification = r.verification || {};
    const status = getReferenceStatus(r);
    const excerpt = getReferenceExcerpt(r);
    const excerptLabel = REFERENCE_DOC_TYPE_LABELS[r.docType] || "Reference";
    const isSpecialDocType = !!r.docType && r.docType !== "reference";

    const canSend =
      !!r.email &&
      status !== "Verified" &&
      status !== "Declined" &&
      (status === "Draft" || status === "Sent for Verification");
    const sendLabel =
      status === "Sent for Verification" ? "New link" : "Share link";
    const storedVerifyLink = readStoredVerifyLink(refId);
    const showOpenLink =
      window.SeavConfig?.SHOW_DEV_VERIFY_LINK &&
      status === "Sent for Verification" &&
      !!storedVerifyLink;

    const statusValue =
      referenceStatusPill(status) ||
      `<span class="pill pill-neutral">Unverified</span>`;

    const verificationSent =
      status === "Sent for Verification" || status === "Verified" || status === "Declined";

    const verificationDetail =
      status === "Verified"
        ? referenceStatusPill(status) || `<span class="ref-meta-muted">Verified</span>`
        : status === "Sent for Verification"
          ? "Awaiting referee"
          : status === "Declined"
            ? Seav.escapeHtml(verification.signatureName || r.name || "Declined")
            : "Not sent";

    const signatureValue = (() => {
      if (status !== "Verified") {
        return status === "Sent for Verification"
          ? `<span class="ref-meta-muted">Pending</span>`
          : `<span class="ref-meta-muted">—</span>`;
      }

      const sig = verification.signatureImage;
      const sigUrl = sig ? Seav.getFileDisplayUrl(sig, REF_FILES_BUCKET) : "";
      const name = Seav.escapeHtml(verification.signatureName || r.name || "—");

      if (sigUrl) {
        // A signed URL that has since expired shows the browser's native
        // broken-image icon with no useful information (reported as a
        // "question mark in a blue square") — same class of issue already
        // guarded against for photos in seav-cards.js. Fall back to the
        // signer's typed name instead of leaving that icon on screen.
        return `<div class="ref-signature-wrap ref-signature-wrap--meta"><div class="ref-signature-frame"><img class="seav-signature-display" src="${Seav.escapeHtml(sigUrl)}" alt="Referee signature" loading="lazy"
          onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><span class="ref-signature-fallback muted" style="display:none;">${name}</span></div><span class="ref-signature-name">${name}</span></div>`;
      }

      if (verification.signatureName) return name;
      return `<span class="ref-meta-muted">—</span>`;
    })();

    const attachmentSectionHtml = hasFile
      ? renderReferenceAttachmentSection(r.attachment, refFileUrl)
      : "";

    const initials = getRefereeInitials(r.name);
    const titleLine = r.title ? Seav.escapeHtml(r.title) : "";

    const rankValue =
      status === "Verified" || verification.rank
        ? Seav.escapeHtml(verification.rank || "—")
        : status === "Sent for Verification"
          ? "Pending"
          : "—";

    const cocValue =
      status === "Verified" && verification.cocNumber
        ? Seav.escapeHtml(maskCoc(verification.cocNumber))
        : "—";

    const signedValue = verification.signedAt
      ? Seav.escapeHtml(formatDatePretty(verification.signedAt))
      : "—";

    const excerptHtml = excerpt
      ? `“${Seav.escapeHtml(truncateText(excerpt))}”`
      : `<span class="ref-meta-muted">No reference text yet.</span>`;

    const periodText = formatDateRange(r.periodFrom, r.periodTo, r.period);
    const subtitleLine =
      [r.role, periodText !== "—" ? periodText : ""].filter(Boolean).join(" · ") || "—";

    const isExpanded = expandedRefIds.has(refId);

    // Collapses the whole Verification section down to one CTA line until a
    // reference is actually sent — the individual Rank/CoC/Signed/Signature
    // fields are all "—"/"Pending" placeholders until then, which was most
    // of the clutter in the old flat grid.
    const verificationSectionHtml = verificationSent
      ? `
        <div class="vessel-meta-grid">
          ${referenceMetaItem("Verification", verificationDetail)}
          ${referenceMetaItem("Rank", rankValue)}
          ${referenceMetaItem("CoC", cocValue)}
          ${referenceMetaItem("Signed", signedValue)}
          ${referenceMetaItem("Signature", signatureValue)}
          ${verification.note ? referenceMetaItem("Note", Seav.escapeHtml(verification.note)) : ""}
        </div>
      `
      : `<p class="ref-verify-cta">Not yet sent for verification${
          canSend ? " — use <strong>Share link</strong> below to request it from your referee." : "."
        }</p>`;

    return `
    <article class="vessel-card ref-page-card ref-compact-card${isExpanded ? " is-expanded" : ""}" data-ref-id="${Seav.escapeHtml(refId)}">
      <div class="vessel-body">

        <button
          type="button"
          class="ref-compact-summary"
          aria-expanded="${isExpanded ? "true" : "false"}"
          data-toggle-ref-id="${Seav.escapeHtml(refId)}"
        >
          <div class="ref-card-avatar" aria-hidden="true">${initials}</div>
          <div class="ref-compact-summary-left">
            <div class="ref-compact-title">
              ${Seav.escapeHtml(r.name || "—")}${vesselLabel ? ` <small>· ${Seav.escapeHtml(vesselLabel)}</small>` : ""}
            </div>
            <div class="ref-compact-sub">${Seav.escapeHtml(subtitleLine)}</div>
          </div>
          <div class="ref-compact-summary-right">
            ${
              // Mirrors js/certificates.js's cert-cv-flag pattern -- only
              // flag the exception cases (Probation Review / Annual
              // Appraisal); "Reference" is the default for every entry so
              // labelling it every time would just clutter the row for no
              // informational gain.
              isSpecialDocType ? `<span class="cert-cv-flag">${Seav.escapeHtml(excerptLabel)}</span>` : ""
            }
            ${statusValue}
            <span class="cert-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </button>

        <div class="ref-compact-body"${isExpanded ? "" : " hidden"}>

          ${titleLine ? `<p class="ref-compact-position">${titleLine}</p>` : ""}

          <blockquote class="ref-quote">
            <span class="ref-section-label">${Seav.escapeHtml(excerptLabel)}</span>
            <span class="ref-quote-text">${excerptHtml}</span>
          </blockquote>

          <div class="ref-detail-section">
            <div class="ref-section-label">Service details</div>
            <div class="vessel-meta-grid">
              ${referenceMetaItem("Vessel", Seav.escapeHtml(vesselLabel || "—"))}
              ${referenceMetaItem("Your role", Seav.escapeHtml(r.role || "—"))}
              ${referenceMetaItem("Period", Seav.escapeHtml(periodText))}
              ${referenceMetaItem("Date", Seav.escapeHtml(formatDatePretty(r.date)))}
              ${referenceMetaItem("Referee email", Seav.escapeHtml(r.email || "—"))}
              ${
                r.messageToReferee
                  ? referenceMetaItem("Your message to referee", Seav.escapeHtml(r.messageToReferee))
                  : ""
              }
            </div>
          </div>

          <div class="ref-detail-section">
            <div class="ref-section-label">Verification</div>
            ${verificationSectionHtml}
          </div>

          ${attachmentSectionHtml}

          ${Seav.seavActions(
            `${Seav.seavAction("edit", "Edit", `data-edit-ref-id="${Seav.escapeHtml(refId)}"`)}${
              canSend
                ? Seav.seavAction(
                    "secondary",
                    sendLabel,
                    `data-send-ref-id="${Seav.escapeHtml(refId)}"`
                  )
                : ""
            }${
              showOpenLink
                ? Seav.seavAction(
                    "secondary",
                    "Copy link",
                    `data-open-verify-link="${Seav.escapeHtml(refId)}"`
                  )
                : ""
            }${Seav.seavAction("delete", "Delete", `data-del-ref-id="${Seav.escapeHtml(refId)}"`)}`,
            "seav-actions--compact"
          )}
        </div>
      </div>
    </article>
  `;
  }

  async function renderRefs() {
    const refsList = document.getElementById("refsList");
    if (!refsList && !document.getElementById("refForm")) return;
    if (!refsList) return;

    const refs = getRefs();

    if (refs.length === 0) {
      refsList.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No references yet</div>
            <div class="list-sub">Add one from a Captain or Senior Officer.</div>
          </div>
          <span class="pill pill-neutral">Unverified</span>
        </div>
      `;
      updateReferencesSummary(refs);
      return;
    }

    const sorted = getSortedRefs();

    try {
      await hydrateReferenceAttachments(sorted);
      window.SeavState?.syncCache?.();

      refsList.innerHTML = renderGroupedReferenceCards(sorted);
      updateReferencesSummary(refs);
    } catch (err) {
      console.error("[SEA-V] References render failed:", err);
      refsList.innerHTML = `
      <div class="list-row">
        <div>
          <div class="list-title">Could not display references</div>
          <div class="list-sub">${Seav.escapeHtml(err?.message || "Refresh the page and try again.")}</div>
        </div>
      </div>
    `;
    }
  }

  function updateReferencesSummary(refs) {
    const el = document.getElementById("refsSummary");
    if (!el) return;

    if (!refs.length) {
      el.textContent = "";
      return;
    }

    const verified = refs.filter((r) => getReferenceStatus(r) === "Verified").length;
    const pending = refs.filter(
      (r) => getReferenceStatus(r) === "Sent for Verification"
    ).length;
    const declined = refs.filter((r) => getReferenceStatus(r) === "Declined").length;

    const parts = [`${refs.length} reference${refs.length === 1 ? "" : "s"}`];
    if (verified) parts.push(`${verified} verified`);
    if (pending) parts.push(`${pending} pending`);
    if (declined) parts.push(`${declined} declined`);

    el.textContent = parts.join(" · ");
  }

  function clearFormFieldLocks() {
    ["rf_name", "rf_email"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.readOnly = false;
    });
  }

  function applyReferenceFormLocks() {
    // Previously name/text/email were locked read-only once a reference was
    // Verified/Declined, so the (misleading) status label could never drift
    // from what was actually confirmed. Saving an edit now voids the
    // verification back to Draft instead (see the wasUnderVerification
    // handling in the refForm submit handler), so editing is always allowed —
    // there's nothing left to protect by locking these fields.
    clearFormFieldLocks();
  }

  // Mirrors the Certificates/Sea Time/Vessels upload-box pattern
  // (js/certificates.js renderCertAttachmentHint) — previously rf_file was
  // a bare <input type="file"> with a separate link-only preview block;
  // this replaces both with the same Choose/Change-file + hint text used
  // everywhere else so editing a reference with an attachment already
  // shows it before re-uploading.
  function renderReferenceAttachmentHint(attachmentMeta, { isNewSelection = false } = {}) {
    const hint = document.getElementById("rfFileHint");
    const btn = document.getElementById("rfFileBtn");

    if (isNewSelection) {
      if (hint) {
        hint.textContent = attachmentMeta?.filename
          ? `New file selected: ${attachmentMeta.filename} — click Save reference to apply`
          : "New file selected — click Save reference to apply";
      }
      if (btn) btn.textContent = "Change file";
      return;
    }

    const docUrl = attachmentMeta ? Seav.getFileDisplayUrl(attachmentMeta, REF_FILES_BUCKET) : "";
    const filename = attachmentMeta?.filename || "";

    if (hint) {
      hint.textContent = docUrl
        ? (filename ? `Current file: ${filename}` : "Current file uploaded")
        : "No file uploaded yet";
    }

    if (btn) {
      btn.textContent = docUrl ? "Change file" : "Choose file";
    }
  }

  async function fillReferenceForm(ref) {
  const editId = document.getElementById("rf_edit_id");
  if (editId) editId.value = ref.id || "";

  const docTypeEl = document.getElementById("rf_doc_type");
  if (docTypeEl) docTypeEl.value = ref.docType || "reference";

  document.getElementById("rf_name").value = ref.name || "";
  document.getElementById("rf_title").value = ref.title || "";
  document.getElementById("rf_email").value = ref.email || "";

  const vesselField = document.getElementById("rf_vessel");
  if (vesselField) {
    vesselField.value = ref.vesselId || "";
  }

  document.getElementById("rf_role").value = ref.role || "";
  Seav.setDateTriplet("rf_period_from", ref.periodFrom || "");
  Seav.setDateTriplet("rf_period_to", ref.periodTo || "");
  const messageField = document.getElementById("rf_message");
  if (messageField) messageField.value = ref.messageToReferee || "";

  const status = getReferenceStatus(ref);

  const voidNotice = document.getElementById("rfVoidNotice");
  if (voidNotice) {
    voidNotice.hidden = !(
      status === "Verified" ||
      status === "Declined" ||
      status === "Sent for Verification"
    );
  }

  applyReferenceFormLocks();
  document.getElementById("rf_file").value = "";
  renderReferenceAttachmentHint(ref.attachment || null);

  if (window.SeavModals?.openModal) window.SeavModals.openModal("refModal");
}

function resetReferenceForm(form) {
  form.reset();

  const editId = document.getElementById("rf_edit_id");
  if (editId) editId.value = "";

  Seav.clearDateTriplet("rf_period_from");
  Seav.clearDateTriplet("rf_period_to");

  const voidNotice = document.getElementById("rfVoidNotice");
  if (voidNotice) voidNotice.hidden = true;

  clearFormFieldLocks();
  renderReferenceAttachmentHint(null);
}

function readReferenceForm() {
  const vesselValue = document.getElementById("rf_vessel")?.value || "";

  return {
    id: document.getElementById("rf_edit_id")?.value || "",
    docType: document.getElementById("rf_doc_type")?.value || "reference",
    name: document.getElementById("rf_name")?.value.trim(),
    title: document.getElementById("rf_title")?.value.trim() || "",
    email: document.getElementById("rf_email")?.value.trim() || "",
    vesselId: vesselValue,
    role: document.getElementById("rf_role")?.value.trim() || "",
    periodFrom: Seav.readDateTriplet("rf_period_from"),
    periodTo: Seav.readDateTriplet("rf_period_to"),
    messageToReferee: document.getElementById("rf_message")?.value.trim() || "",
    // Status is never hand-picked in this form — a reference starts Draft
    // (shown as "Unverified") and only moves to Sent for Verification /
    // Verified / Declined via the Share-link + referee-response flow. The
    // refForm submit handler overrides this to "Draft" whenever the edit
    // targets a reference that was under verification, voiding it.
    status: "Draft",
    file: document.getElementById("rf_file")?.files?.[0] || null
  };
}

  async function buildReferenceAttachment(file, existingAttachment, refId) {
    return window.SeavUpload?.uploadToStorage({
      bucket: "reference-files",
      entityId: refId,
      file,
      existingMeta: existingAttachment,
      kind: "Reference"
    }) ?? existingAttachment ?? null;
  }

  async function saveReferenceData(refData) {
    await SeavAPI.upsertItemById(STORAGE_KEY, refData);
  }

  function initReferences() {
    if (
      !document.getElementById("refsList") &&
      !document.getElementById("refForm")
    ) return;

    const runRefresh = async () => {
      populateReferenceVesselOptions();
      await renderRefs();
    };

    Seav.bindStateRefresh(runRefresh, { label: "References refresh" });

    // Reference verification status can change from outside this browser
    // entirely — a referee completes or declines it on their own device,
    // and this tab has no way to know until it asks again. The shared
    // 5-minute state cache (js/state.js) can otherwise serve an already-
    // stale snapshot on load, so pull a fresh copy of just the refs table
    // in the background right away rather than waiting out the cache TTL.
    // runRefresh above is already wired to re-render on "seav:data-updated",
    // so this just corrects the cards in place once the fresh data lands.
    if (window.SeavState?.refreshKey) {
      window.SeavState.refreshKey("refs").catch((err) => {
        console.warn("[SEA-V] Background refs refresh failed:", err);
      });
    }

    const rfFileInput = document.getElementById("rf_file");
    const rfFileBtn = document.getElementById("rfFileBtn");
    if (rfFileBtn && rfFileInput) {
      rfFileBtn.addEventListener("click", () => rfFileInput.click());
    }
    if (rfFileInput) {
      rfFileInput.addEventListener("change", () => {
        const file = rfFileInput.files?.[0] || null;
        if (file) {
          renderReferenceAttachmentHint({ filename: file.name }, { isNewSelection: true });
        }
      });
    }

    const refForm = document.getElementById("refForm");
    if (refForm) {
      refForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = readReferenceForm();
        if (!formData.name) {
          Seav.notify(
            "error",
            "Reference details missing",
            "Add the referee's name before saving."
          );
          return;
        }

        const existingRef = formData.id
         ? getRefs().find((item) => item.id === formData.id) || null
         : null;

        const existingStatus = existingRef ? getReferenceStatus(existingRef) : "Draft";
        const wasUnderVerification =
          existingStatus === "Verified" ||
          existingStatus === "Sent for Verification" ||
          existingStatus === "Declined";

        // Once a verification request has gone out — or come back signed or
        // declined — the referee's response refers to the reference exactly
        // as it stood at that moment. Editing the content afterwards has to
        // void that verification rather than silently keep a Verified/
        // Declined status pinned to wording that's since changed: reset to
        // Draft so the crew member has to re-send and get it confirmed again.
        if (wasUnderVerification) {
          formData.status = "Draft";
        }

        await Seav.withSaving(async () => {
        const refId = formData.id || createId("ref");

       const attachment = await buildReferenceAttachment(
        formData.file,
        existingRef?.attachment || null,
        refId
     );
        if (formData.file && !attachment) return;

        const now = new Date().toISOString();

        // Voiding a Verified/Sent/Declined reference clears its verification
        // data entirely (rank/CoC/signature/note all belonged to the old,
        // now-edited wording) rather than carrying it forward. Otherwise,
        // editing any reference field re-saves existingRef.verification
        // as-is. By the time this form loads, hydrateReferenceAttachments()
        // has already merged a live, 1-hour signed URL onto signatureImage in
        // memory (to display it). Saving that mutated object straight back to
        // the DB would permanently bake a URL that expires in an hour into
        // storage — exactly what caused the signature to show a broken-image
        // icon later. Strip the transient url/dataUrl back off before saving;
        // path/bucket/filename are all that should ever be persisted.
        // The reference text/date are now written by the referee themselves
        // (verify-reference.html), not the crew member — so this form never
        // supplies them. Preserve whatever the referee last wrote unless
        // we're voiding, in which case it belonged to the now-invalidated
        // verification round and gets cleared along with it.
        const clearedReferenceContent = wasUnderVerification;
        const existingVerification = wasUnderVerification ? null : existingRef?.verification || null;
        const sanitizedVerification = existingVerification
          ? {
              ...existingVerification,
              signatureImage: window.SeavApiCore?.sanitizeFileForStorage
                ? window.SeavApiCore.sanitizeFileForStorage(
                    existingVerification.signatureImage,
                    REF_FILES_BUCKET
                  )
                : existingVerification.signatureImage
            }
          : null;

        await saveReferenceData({
        id: refId,
        docType: formData.docType,
        name: formData.name,
        title: formData.title,
        email: formData.email,
        vesselId: formData.vesselId,
        role: formData.role,
        periodFrom: formData.periodFrom,
        periodTo: formData.periodTo,
        // Keep the legacy free-text period only until a real date range is
        // entered for this reference — once periodFrom/periodTo are set,
        // the date range is the source of truth and the old text retires.
        period: formData.periodFrom || formData.periodTo ? "" : existingRef?.period || "",
        text: clearedReferenceContent ? "" : (existingRef?.text || ""),
        date: clearedReferenceContent ? "" : (existingRef?.date || ""),
        messageToReferee: formData.messageToReferee,
        status: formData.status,
        attachment,
        verification: sanitizedVerification || {
        confirmed: false,
        note: "",
        rank: "",
        cocNumber: "",
        signatureName: "",
        signedAt: ""
        },
        createdAt: existingRef?.createdAt || now,
        updatedAt: now
      });

        resetReferenceForm(refForm);
        if (window.SeavModals?.closeAllModals) window.SeavModals.closeAllModals();

        Seav.notify("success", "Reference saved", "Stored in your professional record.");

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await renderRefs();
        }
        }, { sub: "Saving reference" });
      });
    }

    document.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-ref-id]");
      if (toggleBtn) {
        const refId = toggleBtn.getAttribute("data-toggle-ref-id");
        if (expandedRefIds.has(refId)) expandedRefIds.delete(refId);
        else expandedRefIds.add(refId);
        // Re-render from the already-hydrated in-memory refs — same
        // lightweight re-render certificates.js uses on toggle, no need to
        // re-sort/re-hydrate for a pure expand/collapse.
        const refsList = document.getElementById("refsList");
        if (refsList) {
          refsList.innerHTML = renderGroupedReferenceCards(getSortedRefs());
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-ref-id]");
      if (editBtn) {
        e.preventDefault();
        const refId = editBtn.getAttribute("data-edit-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;
        await fillReferenceForm(ref);
        return;
      }

      const sendBtn = e.target.closest("[data-send-ref-id]");
      if (sendBtn) {
        e.preventDefault();
        const refId = sendBtn.getAttribute("data-send-ref-id");
        const ref = getRefs().find((item) => item.id === refId);
        if (!ref) return;

        if (!ref.email) {
          Seav.notify("error", "Email required", "Add the referee email before sharing a link.");
          return;
        }

        if (!window.SeavReferenceVerification?.sendRequest) {
          Seav.notify(
            "error",
            "Verification unavailable",
            "Reference verification is not loaded. Refresh and try again."
          );
          return;
        }

        let sendResult = null;
        await Seav.withSaving(async () => {
          sendResult = await window.SeavReferenceVerification.sendRequest(refId);
        }, {
          sub: "Preparing verification link",
          errorTitle: "Verification failed"
        });

        if (!sendResult) {
          // A failure here (e.g. "Reference is already verified") usually
          // means the card is showing an out-of-date status — the referee
          // completed or declined it from their own device since this tab
          // last loaded, which this tab has no way to know about until it
          // asks again. Refresh so the card corrects itself instead of
          // staying stuck on stale "Sent for Verification" state forever.
          try {
            if (window.Seav.app?.refreshAll) {
              await window.Seav.app.refreshAll();
            } else {
              await renderRefs();
            }
          } catch (refreshErr) {
            console.warn("[SEA-V] Refresh after failed verification send failed:", refreshErr);
          }
          return;
        }

        if (sendResult?.verifyUrl) {
          rememberVerifyLink(refId, sendResult.verifyUrl);
        }

        const vessel = getVessels().find((item) => item.id === ref.vesselId);
        const crewName = String(window.SeavState?.profile?.name || "").trim();
        const attachmentUrl = Seav.getFileDisplayUrl(ref.attachment, REF_FILES_BUCKET);

        if (sendResult?.verifyUrl) {
          window.SeavReferenceVerification.showVerifyLinkDialog(sendResult.verifyUrl, {
            refereeEmail: sendResult.refereeEmail || ref.email,
            refereeName: ref.name,
            refereeTitle: ref.title || "",
            crewName: crewName || "A SEA-V member",
            crewRole: ref.role || "",
            vesselName: vessel?.name || "",
            periodText: formatDateRange(ref.periodFrom, ref.periodTo, ref.period),
            dateText: formatDatePretty(ref.date),
            messageToReferee: ref.messageToReferee || "",
            referenceText: ref.text || "",
            attachmentUrl,
            attachmentFilename: ref.attachment?.filename || ""
          });
        }

        Seav.notify(
          "success",
          "Link ready",
          sendResult.message || "Copy the suggested email and send it from your own account."
        );

        try {
          if (window.Seav.app?.refreshAll) {
            await window.Seav.app.refreshAll();
          } else {
            await renderRefs();
          }
        } catch (refreshErr) {
          console.warn("[SEA-V] Refresh after verification send failed:", refreshErr);
          await renderRefs();
        }

        return;
      }

      const openLinkBtn = e.target.closest("[data-open-verify-link]");
      if (openLinkBtn) {
        e.preventDefault();
        const refId = openLinkBtn.getAttribute("data-open-verify-link");
        const verifyUrl = readStoredVerifyLink(refId);
        if (!verifyUrl) {
          Seav.notify(
            "info",
            "No saved link",
            "Click New link to generate a fresh verification link."
          );
          return;
        }
        if (window.SeavReferenceVerification?.showVerifyLinkDialog) {
          const ref = getRefs().find((item) => item.id === refId);
          const vessel = getVessels().find((item) => item.id === ref?.vesselId);
          const crewName = String(window.SeavState?.profile?.name || "").trim();
          const attachmentUrl = ref ? Seav.getFileDisplayUrl(ref.attachment, REF_FILES_BUCKET) : "";
          window.SeavReferenceVerification.showVerifyLinkDialog(verifyUrl, {
            refereeEmail: ref?.email || "",
            refereeName: ref?.name || "",
            refereeTitle: ref?.title || "",
            crewName: crewName || "A SEA-V member",
            crewRole: ref?.role || "",
            vesselName: vessel?.name || "",
            periodText: ref ? formatDateRange(ref.periodFrom, ref.periodTo, ref.period) : "",
            dateText: ref ? formatDatePretty(ref.date) : "",
            messageToReferee: ref?.messageToReferee || "",
            referenceText: ref?.text || "",
            attachmentUrl,
            attachmentFilename: ref?.attachment?.filename || ""
          });
        } else {
          window.open(verifyUrl, "_blank", "noopener");
        }
        return;
      }

      const legacyVerifyBtn = e.target.closest("[data-verify-ref-id]");
      if (legacyVerifyBtn) {
        e.preventDefault();
        Seav.notify(
          "info",
          "Page update required",
          "Hard refresh this page (Cmd+Shift+R), then use Share link."
        );
        return;
      }

      const delBtn = e.target.closest("[data-del-ref-id]");
      if (delBtn) {
        e.preventDefault();
        const refId = delBtn.getAttribute("data-del-ref-id");
        const ref = getRefs().find((item) => item.id === refId);

        if (
          !Seav.confirmDelete({
            itemName: ref?.name || "",
            itemLabel: "reference"
          })
        ) {
          return;
        }

        await SeavAPI.deleteItemById(STORAGE_KEY, refId);

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        } else {
          await renderRefs();
        }
      }
    });

  }

  document.addEventListener("DOMContentLoaded", initReferences);
})();