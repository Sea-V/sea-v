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
      name: el("pf_name"),
      rank: el("pf_rank"),
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

    function setMode(next) {
      mode = next;
      if (overlay) overlay.hidden = next !== "view";
      form.inert = next === "view";
      if (next === "edit") fillForm(loadProfile());
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
        name: fields.name?.value.trim() || "",
        rank: fields.rank?.value.trim() || "",
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
      if (fields.name) fields.name.value = profile.name || "";
      if (fields.rank) fields.rank.value = profile.rank || "";
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
        // Currently editing — keep the form's own state (don't clobber
        // in-progress edits). The fields will pick up the latest saved
        // data next time setMode("edit") runs (Edit button, or after a
        // successful save re-locks and Edit is clicked again).
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

      const profile = {
        ...existingProfile,
        id: profileId,
        name: formData.name,
        rank: formData.rank,
        qualification: formData.qualification,
        nationality: formData.nationality,
        dob: formData.dob,
        location: formData.location,
        email: formData.email,
        phone: formData.phone,
        passportsHeld: formData.passportsHeld,
        visasHeld: formData.visasHeld,
        availability: formData.availability,
        bio: formData.bio,
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
})();