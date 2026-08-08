// /js/profile.js
(function () {
  "use strict";

  if (!window.Seav) {
    console.warn("[SEA-V] Seav core not found. Did you include js/core.js before profile.js?");
    return;
  }

  if (!window.SeavAPI) {
    console.warn("[SEA-V] SeavAPI not found. Did you include js/api.js before profile.js?");
    return;
  }

  if (!window.SeavData) {
    console.warn("[SEA-V] SeavData not found. Did you include js/seav-data.js before profile.js?");
    return;
  }

  if (!window.SeavState) {
    console.warn("[SEA-V] SeavState not found. Did you include js/state.js before profile.js?");
    return;
  }

  const {
    KEYS, DEFAULT_PROFILE, getSavedCertificates, isCurrentQualificationCert,
    slugifyUsername, isValidUsername
  } = window.SeavData;

  document.addEventListener("DOMContentLoaded", initProfile);

  function initProfile() {
    const form = document.getElementById("profileForm");
    if (!form) return;

    const el = (id) => document.getElementById(id);

    const fields = {
      firstName: el("pf_first_name"),
      lastName: el("pf_last_name"),
      rank: el("pf_rank"),
      dischargeBookNumber: el("pf_discharge_book_number"),
      qualification: el("pf_qualification"),
      nationality: el("pf_nationality"),
      location: el("pf_location"),
      email: el("pf_email"),
      phoneCountry: el("pf_phone_country"),
      phoneNumber: el("pf_phone_number"),
      passportCountry: el("pf_passport_country"),
      passportAdd: el("pf_passport_add"),
      visaType: el("pf_visa_type"),
      visaAdd: el("pf_visa_add"),
      availability: el("pf_availability"),
      bio: el("pf_bio"),
      photo: el("pf_photo")
    };

    const passportChipsBox = el("pf_passport_chips");
    const visaChipsBox = el("pf_visa_chips");
    const photoThumb = el("pfPhotoThumb");
    const photoBtn = el("pfPhotoBtn");
    const photoHint = el("pfPhotoHint");
    const Countries = window.SeavCountries;
    const Visas = window.SeavVisas;

    // 2026-08-05, per Jack: no separate read-only summary card anymore —
    // the form itself is the only surface, always filled with the real
    // saved values. When locked, a glassy overlay (#profileLockOverlay)
    // visually covers the form; form.inert blocks keyboard/focus access
    // to the fields underneath as a second line of defense alongside the
    // overlay's own visual + click coverage. "mode" is tracked explicitly
    // here (rather than inferred from a hidden check) since the form
    // element itself is never hidden anymore.
    const overlay = el("profileLockOverlay");
    const editBtn = el("btnEditProfile");
    let mode = "edit";
    let initialModeSet = false;
    // Tracks whether the person has actually typed/changed anything since
    // the form was last filled — see refreshProfileView() below for why
    // this exists (2026-08-07 Mia Bailey data-loss incident).
    let formDirty = false;

    function setMode(next) {
      mode = next;
      if (overlay) overlay.hidden = next !== "view";
      form.inert = next === "view";
      if (next === "edit") {
        fillForm(loadProfile());
        formDirty = false;
      }
    }

    if (editBtn) {
      editBtn.addEventListener("click", () => setMode("edit"));
    }

    function flag(iso2) {
      return Countries?.flagEmoji ? Countries.flagEmoji(iso2) : "";
    }

    // The Nationality/Passports/Phone-code dropdowns all draw from the same
    // shared js/seav-countries.js list, so the three stay visually and
    // alphabetically consistent instead of drifting apart over time.
    function populateCountrySelects() {
      const countries = Countries?.COUNTRIES || [];

      if (fields.nationality) {
        fields.nationality.innerHTML =
          '<option value="">Select your nationality</option>' +
          countries
            .map((c) => `<option value="${Seav.escapeHtml(c.name)}">${flag(c.iso2)} ${Seav.escapeHtml(c.name)}</option>`)
            .join("");
      }

      if (fields.passportCountry) {
        fields.passportCountry.innerHTML =
          '<option value="">Select a country to add</option>' +
          countries
            .map((c) => `<option value="${Seav.escapeHtml(c.name)}">${flag(c.iso2)} ${Seav.escapeHtml(c.name)}</option>`)
            .join("");
      }

      if (fields.phoneCountry) {
        fields.phoneCountry.innerHTML =
          '<option value="">Code</option>' +
          countries
            .map((c) => `<option value="${c.iso2}">${flag(c.iso2)} ${Seav.escapeHtml(c.name)} (+${c.dial})</option>`)
            .join("");
      }

      if (fields.visaType) {
        const visaTypes = Visas?.VISA_TYPES || [];
        fields.visaType.innerHTML =
          '<option value="">Select a visa to add</option>' +
          visaTypes.map((v) => `<option value="${Seav.escapeHtml(v)}">${Seav.escapeHtml(v)}</option>`).join("");
      }
    }

    populateCountrySelects();

    // "Current Qualification" used to be free text. It now draws from the
    // full certificate catalog (the same list certificates.html's "choose a
    // certificate" dropdown uses), filtered to actual rank/command CoCs only
    // (isCurrentQualificationCert) — a plain ENG1 or STCW Basic Safety
    // Training entry is a real cert but isn't a qualification/rank, so it
    // shouldn't show up here. Sourcing from the catalog (rather than only
    // certs the crew member has already saved with an expiry/attachment)
    // means every CoC/RYA qualification is pickable immediately, without
    // first adding it as a full dated certificate elsewhere.
    //
    // Also unioned with the crew member's own saved certs that pass the same
    // filter, so a legacy/custom-named saved cert (e.g. a free-typed "Chief
    // Mate <3000GT (STCW II/2)" that doesn't exactly match a catalog name)
    // still shows up and isn't silently dropped.
    function populateQualificationOptions() {
      const select = fields.qualification;
      if (!select) return;

      const catalogCerts = window.SeavData?.getCertificateCatalog
        ? window.SeavData.getCertificateCatalog()
        : [];
      const savedCerts = getSavedCertificates
        ? getSavedCertificates(window.SeavState?.certs || [])
        : [];

      const candidates = isCurrentQualificationCert
        ? [...catalogCerts, ...savedCerts].filter(isCurrentQualificationCert)
        : [...catalogCerts, ...savedCerts];

      const seenNames = new Set();
      const certs = candidates.filter((cert) => {
        const name = String(cert?.name || "").trim();
        if (!name) return false;
        const key = name.toLowerCase();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      const sorted = [...certs].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

      const current = select.value || "";
      select.innerHTML =
        '<option value="">Select a certificate you hold</option>' +
        sorted
          .map(
            (cert) =>
              `<option value="${Seav.escapeHtml(cert.name)}">${Seav.escapeHtml(cert.name)}</option>`
          )
          .join("");
      if (current) select.value = current;
    }

    populateQualificationOptions();

    // Preserves a legacy free-text value (e.g. a nationality saved before
    // this dropdown existed) as a selectable option instead of silently
    // blanking the field the first time this page loads after the change.
    function ensureSelectHasValue(select, value) {
      if (!select || !value) return;
      const exists = [...select.options].some((opt) => opt.value === value);
      if (exists) return;
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = `${value} (previously entered)`;
      select.insertBefore(opt, select.options[1] || null);
    }

    function loadProfile() {
      return {
        ...DEFAULT_PROFILE,
        ...(window.SeavState?.profile || {}),
        id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
      };
    }

    // profile.phone stays a single plain string in storage (same column,
    // same shape every other reader — CV export, public profile, etc. —
    // already expects), the country-code select is purely an editing aid
    // that composes/parses that string on the way in and out.
    function splitPhone(value) {
      const raw = String(value || "").trim();
      if (!raw) return { iso2: "", number: "" };
      if (!raw.startsWith("+")) return { iso2: "", number: raw };

      const digits = raw.slice(1);
      const countries = Countries?.COUNTRIES || [];
      // Longest dial code first so e.g. Barbados' "1246" matches before the
      // shorter shared NANP "1".
      const dials = [...new Set(countries.map((c) => c.dial))].sort((a, b) => b.length - a.length);
      const matchedDial = dials.find((dial) => digits.startsWith(dial));
      if (!matchedDial) return { iso2: "", number: raw };

      const country = Countries?.getCountryByDial?.(matchedDial);
      return { iso2: country?.iso2 || "", number: digits.slice(matchedDial.length).trim() };
    }

    function buildPhone(iso2, number) {
      const trimmedNumber = String(number || "").trim();
      const country = iso2 ? (Countries?.COUNTRIES || []).find((c) => c.iso2 === iso2) : null;
      if (!country) return trimmedNumber;
      return trimmedNumber ? `+${country.dial} ${trimmedNumber}` : `+${country.dial}`;
    }

    // profile.passportsHeld also stays a single comma-joined string in
    // storage — same as before this field had chips — so nothing else that
    // reads it needs to change.
    let passportChips = [];

    function renderPassportChips() {
      if (!passportChipsBox) return;
      if (!passportChips.length) {
        passportChipsBox.innerHTML = '<span class="profile-chip-empty muted">No passports added yet</span>';
        return;
      }
      passportChipsBox.innerHTML = passportChips
        .map(
          (name) => `
            <span class="profile-chip">
              ${Seav.escapeHtml(name)}
              <button type="button" class="profile-chip-remove" data-name="${Seav.escapeHtml(name)}" aria-label="Remove ${Seav.escapeHtml(name)}">&times;</button>
            </span>
          `
        )
        .join("");
    }

    function setPassportChips(value) {
      passportChips = String(value || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      renderPassportChips();
    }

    function addPassportChip(name) {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;
      const exists = passportChips.some((chip) => chip.toLowerCase() === trimmed.toLowerCase());
      if (exists) return;
      passportChips = [...passportChips, trimmed];
      renderPassportChips();
      updatePhotoThumbFromForm();
    }

    function removePassportChip(name) {
      passportChips = passportChips.filter((chip) => chip !== name);
      renderPassportChips();
      updatePhotoThumbFromForm();
    }

    if (fields.passportAdd) {
      fields.passportAdd.addEventListener("click", () => {
        const value = fields.passportCountry?.value || "";
        if (!value) return;
        addPassportChip(value);
        // Deliberately leave the select showing the country just added —
        // clearing it back to "Select a country to add" made it look like
        // the pick hadn't registered at all, even though the chip below
        // had been added correctly.
      });
    }

    if (passportChipsBox) {
      passportChipsBox.addEventListener("click", (e) => {
        const btn = e.target.closest(".profile-chip-remove");
        if (!btn) return;
        removePassportChip(btn.dataset.name || "");
      });
    }

    // profile.visasHeld follows the exact same comma-joined-string pattern
    // as passportsHeld above — same chip UI, sourced from js/seav-visas.js
    // instead of js/seav-countries.js.
    let visaChips = [];

    function renderVisaChips() {
      if (!visaChipsBox) return;
      if (!visaChips.length) {
        visaChipsBox.innerHTML = '<span class="profile-chip-empty muted">No visas added yet</span>';
        return;
      }
      visaChipsBox.innerHTML = visaChips
        .map(
          (name) => `
            <span class="profile-chip">
              ${Seav.escapeHtml(name)}
              <button type="button" class="profile-chip-remove" data-name="${Seav.escapeHtml(name)}" aria-label="Remove ${Seav.escapeHtml(name)}">&times;</button>
            </span>
          `
        )
        .join("");
    }

    function setVisaChips(value) {
      visaChips = String(value || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      renderVisaChips();
    }

    function addVisaChip(name) {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;
      const exists = visaChips.some((chip) => chip.toLowerCase() === trimmed.toLowerCase());
      if (exists) return;
      visaChips = [...visaChips, trimmed];
      renderVisaChips();
      updatePhotoThumbFromForm();
    }

    function removeVisaChip(name) {
      visaChips = visaChips.filter((chip) => chip !== name);
      renderVisaChips();
      updatePhotoThumbFromForm();
    }

    if (fields.visaAdd) {
      fields.visaAdd.addEventListener("click", () => {
        const value = fields.visaType?.value || "";
        if (!value) return;
        addVisaChip(value);
        // Same reasoning as passports above — leave the pick visible.
      });
    }

    if (visaChipsBox) {
      visaChipsBox.addEventListener("click", (e) => {
        const btn = e.target.closest(".profile-chip-remove");
        if (!btn) return;
        removeVisaChip(btn.dataset.name || "");
      });
    }

    if (photoBtn && fields.photo) {
      photoBtn.addEventListener("click", () => fields.photo.click());
    }

    // Drag-and-drop, alongside (not instead of) the Change photo button —
    // dropping onto the thumbnail assigns the file to the same #pf_photo
    // input and fires its normal "change" event, so HEIC conversion,
    // the live thumbnail preview, and Save all work exactly as they do
    // for a button-picked file. 2026-08-05, per Jack.
    if (photoThumb && fields.photo) {
      window.SeavUpload?.wireDragDrop?.(photoThumb, fields.photo, { accept: "image/*" });
    }

    // Renders the form's own photo thumbnail as a background-image —
    // previously the form only had a bare <input type=file> with no
    // indication a photo already existed, which read as "nothing
    // uploaded" (a blank/empty control) even when one was.
    function renderPhotoThumb(photoMeta, { isNewSelection = false } = {}) {
      if (!photoThumb) return;

      const photoUrl = Seav.getFileDisplayUrl(
        photoMeta,
        window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
      );

      if (photoUrl) {
        const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        photoThumb.style.backgroundImage = `url("${safeUrl}")`;
      } else {
        photoThumb.style.backgroundImage = "";
      }

      if (photoHint) {
        if (isNewSelection) {
          photoHint.textContent = "New photo selected — click Save Profile to apply";
        } else if (photoUrl) {
          photoHint.textContent = "Current photo";
        } else {
          photoHint.textContent = "No photo uploaded yet";
        }
      }

      if (photoBtn) {
        photoBtn.textContent = photoUrl ? "Change photo" : "Choose photo";
      }
    }

    function readProfileForm() {
      return {
        firstName: fields.firstName?.value.trim() || "",
        lastName: fields.lastName?.value.trim() || "",
        rank: fields.rank?.value.trim() || "",
        dischargeBookNumber: fields.dischargeBookNumber?.value.trim() || "",
        qualification: fields.qualification?.value.trim() || "",
        nationality: fields.nationality?.value.trim() || "",
        dob: Seav.readDateTriplet("pf_dob"),
        location: fields.location?.value.trim() || "",
        email: fields.email?.value.trim() || "",
        phone: buildPhone(fields.phoneCountry?.value || "", fields.phoneNumber?.value || ""),
        passportsHeld: passportChips.join(", "),
        visasHeld: visaChips.join(", "),
        availability: fields.availability?.value || "Available Immediately",
        bio: fields.bio?.value.trim() || "",
        file: fields.photo?.files?.[0] || null
      };
    }

    async function buildProfilePhoto(file, existingPhoto, profileId) {
      return window.SeavUpload?.uploadToStorage({
        bucket: "profile-photos",
        entityId: profileId,
        file,
        existingMeta: existingPhoto,
        kind: "Photo",
        maxBytes: window.SeavUpload?.PHOTO_MAX_BYTES,
        resizeImage: true
      }) ?? existingPhoto ?? null;
    }

    function fillForm(profile) {
      if (fields.firstName) fields.firstName.value = profile.firstName || "";
      if (fields.lastName) fields.lastName.value = profile.lastName || "";
      if (fields.rank) fields.rank.value = profile.rank || "";
      if (fields.dischargeBookNumber) fields.dischargeBookNumber.value = profile.dischargeBookNumber || "";
      if (fields.qualification) {
        ensureSelectHasValue(fields.qualification, profile.qualification);
        fields.qualification.value = profile.qualification || "";
      }
      if (fields.nationality) {
        ensureSelectHasValue(fields.nationality, profile.nationality);
        fields.nationality.value = profile.nationality || "";
      }
      Seav.setDateTriplet("pf_dob", profile.dob || "");
      if (fields.location) fields.location.value = profile.location || "";
      if (fields.email) fields.email.value = profile.email || "";

      const phoneParts = splitPhone(profile.phone);
      if (fields.phoneCountry) fields.phoneCountry.value = phoneParts.iso2 || "";
      if (fields.phoneNumber) fields.phoneNumber.value = phoneParts.number || "";

      setPassportChips(profile.passportsHeld);
      setVisaChips(profile.visasHeld);
      if (fields.availability) fields.availability.value = profile.availability || "Available Immediately";
      if (fields.bio) fields.bio.value = profile.bio || "";

      renderPhotoThumb(profile.photo, { isNewSelection: false });
    }

    let previewObjectUrl = null;

    function refreshProfileView() {
      const profile = loadProfile();
      populateQualificationOptions();

      if (!initialModeSet) {
        // Only decide edit-vs-locked once, on first load — a background
        // state refresh (e.g. after a save elsewhere, or a realtime sync)
        // must never yank someone out of the form mid-edit. A profile
        // with no name yet is treated as brand new, so first-time users
        // land straight in the form instead of an empty locked view.
        initialModeSet = true;
        fillForm(profile);
        setMode(profile.name ? "view" : "edit");
      } else if (mode === "edit") {
        // Currently editing — normally keep the form's own state so a
        // background refresh never clobbers someone's in-progress typing.
        // BUT: if this "edit" session was entered because the very first
        // refreshProfileView() call above ran before SeavState actually
        // had the real profile loaded (a load race), the form can be
        // showing blanks that were never the user's choice — and if the
        // user hasn't touched anything since, there's nothing to protect.
        // Re-filling in that case lets the real data (which has since
        // arrived) win instead of staying stuck blank until a Save wipes
        // it for real. Confirmed root cause of the 2026-08-07 Mia Bailey
        // incident — her form loaded blank, she never saw it recover, and
        // saving over it erased her saved profile.
        if (!formDirty) fillForm(profile);
      } else {
        fillForm(profile);
      }
    }

    // Runs on every keystroke in the form (see the "input" listener below)
    // to keep the form's own photo thumbnail in sync with whatever file is
    // currently selected. Used to also live-update a separate preview card
    // on every keystroke — that card is gone (2026-08-05, per Jack: the
    // page locks after Save instead), so this now only handles the thumb.
    // Must never touch the thumbnail for a HEIC file — that's handled
    // once, asynchronously, by handlePhotoFileChange. Re-deriving a raw
    // createObjectURL() from a HEIC file on every keystroke would both be
    // wasteful and re-introduce the broken-preview bug.
    function updatePhotoThumbFromForm() {
      const current = loadProfile();
      const formData = readProfileForm();
      const file = formData.file;
      const fileIsHeic = !!(file && window.SeavUpload?.isHeicFile?.(file));

      if (file && !fileIsHeic) {
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(file);
        renderPhotoThumb({ dataUrl: previewObjectUrl }, { isNewSelection: true });
      } else if (!file) {
        if (previewObjectUrl) {
          URL.revokeObjectURL(previewObjectUrl);
          previewObjectUrl = null;
        }
        renderPhotoThumb(current.photo, { isNewSelection: false });
      }
      // else: file is HEIC — leave whatever handlePhotoFileChange already
      // rendered (converted preview, or the "preview unavailable" hint) alone.
    }

    // Runs once per file selection (not on every keystroke, unlike
    // updatePhotoThumbFromForm above). For a HEIC photo this awaits the same
    // HEIC->JPEG conversion Save will use, so the preview shown here always
    // matches what actually gets saved — instead of the old behavior of
    // handing a raw HEIC blob URL to an <img>/background-image, which Chrome,
    // Firefox, and Edge simply can't decode and render as blank/broken.
    async function handlePhotoFileChange() {
      const file = fields.photo?.files?.[0] || null;
      if (!file || !window.SeavUpload?.isHeicFile?.(file)) {
        updatePhotoThumbFromForm();
        return;
      }

      if (photoHint) photoHint.textContent = "Converting HEIC photo for preview…";
      const url = await window.SeavUpload.buildPreviewUrl(file);
      if (fields.photo?.files?.[0] !== file) return; // selection changed mid-conversion

      if (url) {
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = url;
        renderPhotoThumb({ dataUrl: url }, { isNewSelection: true });
      } else if (photoHint) {
        photoHint.textContent =
          "HEIC photo selected — preview unavailable, but Save will still try to convert it. If that fails, switch your camera to JPEG (\"Most Compatible\") and re-upload.";
      }
    }

    // fillForm()/setDateTriplet() etc. set .value directly and never fire
    // "input" events, so this only trips on genuine typing/selection —
    // exactly what formDirty needs to distinguish real edits from a
    // programmatic (re-)fill. See refreshProfileView() above.
    form.addEventListener("input", () => { formDirty = true; });
    form.addEventListener("input", updatePhotoThumbFromForm);
    if (fields.photo) {
      fields.photo.addEventListener("change", handlePhotoFileChange);
    }

    async function saveProfileFromForm() {
      return Seav.withSaving(async () => {
      const existingProfile = loadProfile();
      const formData = readProfileForm();
      const profileId = existingProfile.id || DEFAULT_PROFILE.id;

      const photo = await buildProfilePhoto(
        formData.file,
        existingProfile.photo,
        profileId
      );

      if (formData.file && !photo) {
        throw new Error("Profile photo upload failed.");
      }

      // Safety net for the 2026-08-07 Mia Bailey data-loss incident: a
      // blank field in the form must never be treated as "the user wants
      // this cleared" — it falls back to whatever was already saved
      // instead. This is deliberate even though it means there's currently
      // no way to explicitly blank out one of these fields via this form;
      // that's a far smaller cost than silently erasing real data because
      // the form happened to render blank (load race, stuck edit session,
      // anything). refreshProfileView()'s formDirty guard fixes the known
      // root cause of the blank-form state; this is the backstop in case
      // some other path ever gets the form into the same situation.
      const keep = (formValue, existingValue) =>
        (formValue === "" || formValue == null) && existingValue ? existingValue : formValue;

      const profile = {
        ...existingProfile,
        id: profileId,
        firstName: keep(formData.firstName, existingProfile.firstName),
        lastName: keep(formData.lastName, existingProfile.lastName),
        rank: keep(formData.rank, existingProfile.rank),
        dischargeBookNumber: keep(formData.dischargeBookNumber, existingProfile.dischargeBookNumber),
        qualification: keep(formData.qualification, existingProfile.qualification),
        nationality: keep(formData.nationality, existingProfile.nationality),
        dob: keep(formData.dob, existingProfile.dob),
        location: keep(formData.location, existingProfile.location),
        email: keep(formData.email, existingProfile.email),
        phone: keep(formData.phone, existingProfile.phone),
        passportsHeld: keep(formData.passportsHeld, existingProfile.passportsHeld),
        visasHeld: keep(formData.visasHeld, existingProfile.visasHeld),
        availability: formData.availability,
        bio: keep(formData.bio, existingProfile.bio),
        publicEnabled: !!existingProfile.publicEnabled,
        photo
      };

      // First time this profile is saved with a name and no username yet:
      // auto-suggest one so the /u/<username> share link works immediately,
      // instead of requiring a trip to the dashboard's share panel first.
      // Editing/changing it afterward happens there, not on this page.
      const autoBase = slugifyUsername ? slugifyUsername(profile.name) : "";
      const needsUsername =
        !profile.username && autoBase && (!isValidUsername || isValidUsername(autoBase));

      const saved = needsUsername
        ? await saveProfileWithAutoUsername(profile, autoBase)
        : await saveProfileNow(profile);

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      } else {
        refreshProfileView();
      }

      return saved;
      }, { sub: "Updating your profile" });
    }

    async function saveProfileNow(profile) {
      await SeavAPI.save(KEYS.PROFILE, profile);
      return profile;
    }

    async function saveProfileWithAutoUsername(profile, base) {
      try {
        return await saveProfileNow({ ...profile, username: base });
      } catch (err) {
        if (err?.code !== "USERNAME_TAKEN") throw err;
      }

      for (let suffix = 2; suffix <= 6; suffix += 1) {
        const candidate = `${base}-${suffix}`.slice(0, 30);
        try {
          return await saveProfileNow({ ...profile, username: candidate });
        } catch (err) {
          if (err?.code !== "USERNAME_TAKEN") throw err;
        }
      }

      // Couldn't find a free auto-generated slug in a few tries — save
      // without one rather than blocking the whole profile save; a username
      // can always be set manually later from the dashboard share panel.
      return saveProfileNow({ ...profile, username: "" });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        await saveProfileFromForm();
        Seav.notify(
          "success",
          "Profile anchored",
          "Your SEA-V profile is saved and shipshape."
        );
        // 2026-08-05, per Jack: lock back to the read-only view on a
        // successful save — Edit is the only way back into the form.
        setMode("view");
      } catch (err) {
        console.error("[SEA-V] Profile save failed:", err);
        Seav.notify(
          "error",
          "Could not save profile",
          "Check the browser console (F12) for details."
        );
      }
    });

    const runRefresh = () => {
      refreshProfileView();
    };

    Seav.bindStateRefresh(runRefresh, { label: "Profile refresh" });

    const deleteBtn = document.getElementById("btnDeleteAccount");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          "Delete your SEA-V account and all uploaded documents?\n\nThis cannot be undone."
        );
        if (!confirmed) return;

        try {
          await window.SeavAuth?.deleteAccount?.();
          window.location.href = "index.html";
        } catch (err) {
          console.error("[SEA-V] Account deletion failed:", err);
          Seav.notify("error", "Could not delete account", err?.message || "Try again or contact support.");
        }
      });
    }
  }

  // --- Public profile share panel (moved here from dashboard.js, 2026-08-08
  // -- per Jack: it didn't feel like it belonged on the Dashboard, and on
  // mobile it was the first thing rendered above the crew member's own
  // info. This is a standalone block, not folded into initProfile() above,
  // deliberately: initProfile() carries the hardened formDirty/keep()
  // data-loss safeguards from the 2026-08-07 Mia Bailey incident, and this
  // panel has its own independent save calls (username, publicEnabled) that
  // have no reason to share that function's state machine. Rendered as a
  // sibling <article> outside #profileEditView/#profileLockOverlay in
  // profile.html, so it stays interactive even while the profile form
  // itself is locked. IDs/classes fully renamed dash*->pp* on the move; see
  // css/pages/profile.css .profile-public-share* for the styling half. ---

  function loadPublicShareProfile() {
    return {
      ...DEFAULT_PROFILE,
      ...(window.SeavState?.profile || {}),
      id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
    };
  }

  // Same safety net as js/dashboard.js originally had (root cause: 2026-08-07
  // Mia Bailey data-loss incident). Both controls below save the ENTIRE
  // profile row (spread loadPublicShareProfile() + override one field) -- if
  // SeavState hasn't actually finished loading the real profile yet, that
  // silently returns DEFAULT_PROFILE, and saving would wipe every other
  // field back to blank. Block the save rather than risk it.
  function isPublicShareProfileReady() {
    return !!(window.SeavState?.ready && window.SeavState?.profile?.id);
  }

  function resolvePublicShareUrl() {
    const profile = loadPublicShareProfile();
    const path = Seav.buildPublicProfileUrl?.(profile) || "public-profile.html";
    return new URL(path, window.location.href).href;
  }

  async function copyPublicShareLink() {
    const url = resolvePublicShareUrl();

    try {
      await navigator.clipboard.writeText(url);
      Seav.notify("success", "Link copied", "Share your public profile with employers and recruiters.");
      return;
    } catch (err) {
      console.warn("[SEA-V] Public profile link clipboard copy failed:", err);
    }

    const urlEl = document.getElementById("ppLinkUrl");
    if (urlEl) {
      urlEl.focus();
      urlEl.select?.();
    }

    Seav.notify("info", "Copy manually", "Select the link and copy it.");
  }

  function syncPublicSharePanel(profile) {
    const currentProfile = profile || loadPublicShareProfile();
    const checkbox = document.getElementById("ppEnabled");
    const sharePanel = document.getElementById("ppShare");
    const statusEl = document.getElementById("ppStatus");
    const hintEl = document.getElementById("ppLinkHint");
    const linkWrap = document.getElementById("ppLinkWrap");
    const urlEl = document.getElementById("ppLinkUrl");
    const openEl = document.getElementById("ppLinkOpen");
    const usernameInput = document.getElementById("ppSlug");

    if (checkbox) {
      checkbox.checked = !!currentProfile.publicEnabled;
    }

    const enabled = !!currentProfile.publicEnabled;
    const url = resolvePublicShareUrl();

    if (sharePanel) {
      sharePanel.classList.toggle("is-live", enabled);
    }

    if (statusEl) {
      statusEl.textContent = enabled ? "Live" : "Private";
      statusEl.classList.toggle("is-live", enabled);
      statusEl.classList.toggle("is-private", !enabled);
    }

    if (hintEl) {
      hintEl.hidden = enabled;
    }

    if (linkWrap) {
      linkWrap.hidden = !enabled;
    }

    if (urlEl) {
      urlEl.value = url;
      urlEl.title = url;
    }

    if (openEl) {
      openEl.href = url;
    }

    // QR is grouped with the link row and always visible while the panel is
    // live (no separate toggle/expand step) — just keep it regenerated
    // against the current url on every sync, so a slug change never leaves
    // a stale code showing. No need to explicitly blank it when going
    // private: linkWrap.hidden above already hides the whole group, QR
    // included.
    if (enabled) {
      renderProfilePublicQr(url);
    }

    // Don't clobber the field mid-edit — only sync it in from the saved
    // profile when the user isn't actively typing in it.
    if (usernameInput && document.activeElement !== usernameInput) {
      usernameInput.value = currentProfile.username || "";
    }
  }

  function setPublicShareUsernameHint(message, isError) {
    const hintEl = document.getElementById("ppSlugHint");
    if (!hintEl) return;
    hintEl.textContent = message || "";
    hintEl.classList.toggle("is-error", !!isError);
  }

  function initPublicShareUsername() {
    const input = document.getElementById("ppSlug");
    const saveBtn = document.getElementById("ppSlugSave");
    if (!input || !saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      if (!isPublicShareProfileReady()) {
        setPublicShareUsernameHint("Still loading your profile — try again in a moment.", true);
        return;
      }

      const cleaned = slugifyUsername ? slugifyUsername(input.value) : input.value.trim().toLowerCase();
      input.value = cleaned;

      if (!cleaned) {
        setPublicShareUsernameHint("Enter a username first.", true);
        return;
      }

      if (isValidUsername && !isValidUsername(cleaned)) {
        setPublicShareUsernameHint("3-30 characters: lowercase letters, numbers, and hyphens only.", true);
        return;
      }

      const profile = loadPublicShareProfile();
      if (cleaned === (profile.username || "")) {
        setPublicShareUsernameHint("That's already your username.", false);
        return;
      }

      const updated = { ...profile, username: cleaned };

      try {
        await Seav.withSaving(async () => {
          await SeavAPI.save(KEYS.PROFILE, updated);
          if (window.SeavState?.refresh) {
            await window.SeavState.refresh();
          } else if (window.SeavState?.data) {
            window.SeavState.data.profile = updated;
          }
        }, { sub: "Updating your public link" });

        syncPublicSharePanel(updated);
        setPublicShareUsernameHint("Saved — your link is updated.", false);
        Seav.notify("success", "Username saved", `Your public link is now /u/${cleaned}.`);
      } catch (err) {
        console.error("[SEA-V] Username save failed:", err);
        const message =
          err?.code === "USERNAME_TAKEN"
            ? err.message
            : err?.message || "Could not save username. Try again.";
        setPublicShareUsernameHint(message, true);
        Seav.notify("error", "Could not save username", message);
      }
    });
  }

  // QR code for the public profile link -- lets a crew member hand their
  // profile to someone in person (a dock, a crew agency desk) by having
  // them scan it, instead of only being able to send a message. Generated
  // entirely client-side via qrcodejs (profile.html script tag): no
  // third-party "QR image API" is called, so the profile URL is never sent
  // anywhere just to render the code. Regenerated on every open (not
  // cached) so it always reflects the current username/slug.
  function renderProfilePublicQr(url) {
    const canvasHost = document.getElementById("ppQrCanvas");
    if (!canvasHost || !url) return;

    if (typeof window.QRCode !== "function") {
      // Library still loading (it's deferred) -- try again shortly rather
      // than silently leaving the panel blank.
      window.setTimeout(() => renderProfilePublicQr(url), 200);
      return;
    }

    // Generated at a higher pixel size than it's displayed (see
    // .profile-public-share-qr-canvas in css/pages/profile.css, which
    // renders it at ~76px) so a shared/saved copy still scans and prints
    // cleanly, not just a small on-screen preview.
    canvasHost.innerHTML = "";
    new window.QRCode(canvasHost, {
      text: url,
      width: 168,
      height: 168,
      colorDark: "#0b1c2e",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }

  // The QR is small and always visible now (grouped with the link row —
  // see profile.html), so there's no toggle/expand step left to wire.
  // Tapping the code itself shares (or downloads, as a fallback) the QR
  // image via js/seav-share.js's shareCanvasImage — the QR is already a
  // canvas, so this skips seav-share's off-screen-render/html2canvas
  // pipeline entirely and just shares the canvas that's already on screen.
  function initPublicShareQr() {
    const shareBtn = document.getElementById("ppQrShare");
    if (!shareBtn) return;

    shareBtn.addEventListener("click", async () => {
      if (shareBtn.disabled) return;
      const canvas = document.querySelector("#ppQrCanvas canvas");
      if (!canvas) {
        Seav.notify("error", "QR code not ready", "Give it a second and try again.");
        return;
      }

      shareBtn.disabled = true;
      try {
        const profile = loadPublicShareProfile();
        const url = resolvePublicShareUrl();
        await window.SeavShare?.shareCanvasImage?.(canvas, {
          filenameBase: `seav-profile-qr-${(profile.username || "career").toLowerCase()}`,
          shareText: `Scan to view my SEA-V career profile: ${url}`,
          linkUrl: url
        });
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  // Collapsed by default (see profile.html comment) — a plain
  // expand/collapse chevron, not tied to saved state, since this is just
  // reducing header clutter, not a preference worth persisting.
  function expandPublicShareDetails() {
    const toggleBtn = document.getElementById("ppShareToggle");
    const details = document.getElementById("ppShareDetails");
    if (!toggleBtn || !details) return;

    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.setAttribute("aria-label", "Hide your public link");
    details.hidden = false;
  }

  function initPublicShareDetailsToggle() {
    const toggleBtn = document.getElementById("ppShareToggle");
    const details = document.getElementById("ppShareDetails");
    if (!toggleBtn || !details) return;

    toggleBtn.addEventListener("click", () => {
      const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      toggleBtn.setAttribute("aria-expanded", String(next));
      toggleBtn.setAttribute("aria-label", next ? "Hide your public link" : "Show your public link");
      details.hidden = !next;
    });
  }

  function initPublicShareToggle() {
    const checkbox = document.getElementById("ppEnabled");
    const copyBtn = document.getElementById("ppLinkCopy");
    const shareImageBtn = document.getElementById("ppShareImage");
    if (!checkbox) return;

    syncPublicSharePanel();
    initPublicShareUsername();
    initPublicShareDetailsToggle();
    initPublicShareQr();

    copyBtn?.addEventListener("click", () => {
      copyPublicShareLink();
    });

    shareImageBtn?.addEventListener("click", async () => {
      if (shareImageBtn.disabled) return;
      shareImageBtn.disabled = true;
      try {
        await window.SeavShare?.shareProfile?.();
      } finally {
        shareImageBtn.disabled = false;
      }
    });

    checkbox.addEventListener("change", async () => {
      if (!isPublicShareProfileReady()) {
        checkbox.checked = !checkbox.checked;
        Seav.notify(
          "error",
          "Still loading",
          "Your profile hasn't finished loading yet — try again in a moment."
        );
        return;
      }

      const previous = !checkbox.checked;
      const profile = loadPublicShareProfile();
      const updated = { ...profile, publicEnabled: checkbox.checked };

      try {
        await Seav.withSaving(async () => {
          await SeavAPI.save(KEYS.PROFILE, updated);
          if (window.SeavState?.refresh) {
            await window.SeavState.refresh();
          } else if (window.SeavState?.data) {
            window.SeavState.data.profile = updated;
          }
        }, { sub: "Updating public profile" });

        syncPublicSharePanel(updated);

        // Turning visibility on is exactly the moment someone wants their
        // link — auto-expand so it's not hidden behind the chevron right
        // when it becomes useful. Turning it off doesn't collapse it back;
        // no need to yank the panel shut if they're actively looking at it.
        if (updated.publicEnabled) {
          expandPublicShareDetails();
        }

        Seav.notify(
          "success",
          "Public profile updated",
          updated.publicEnabled
            ? "Your public profile is visible to anyone with your link."
            : "Your public profile is hidden."
        );
      } catch (err) {
        checkbox.checked = previous;
        syncPublicSharePanel(profile);
        console.error("[SEA-V] Public profile toggle failed:", err);
        Seav.notify("error", "Could not update public profile", err?.message || "Try again.");
      }
    });
  }

  function initProfilePublicShare() {
    if (!document.getElementById("ppEnabled")) return;
    initPublicShareToggle();
    Seav.bindStateRefresh(() => syncPublicSharePanel(), { label: "Public share refresh" });
  }

  document.addEventListener("DOMContentLoaded", initProfilePublicShare);
})();