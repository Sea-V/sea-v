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

  const { KEYS, DEFAULT_PROFILE, getSavedCertificates, isCurrentQualificationCert } = window.SeavData;

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
      dobDay: el("pf_dob_day"),
      dobMonth: el("pf_dob_month"),
      dobYear: el("pf_dob_year"),
      location: el("pf_location"),
      email: el("pf_email"),
      phoneCountry: el("pf_phone_country"),
      phoneNumber: el("pf_phone_number"),
      passportCountry: el("pf_passport_country"),
      passportAdd: el("pf_passport_add"),
      visasHeld: el("pf_visasHeld"),
      availability: el("pf_availability"),
      bio: el("pf_bio"),
      photo: el("pf_photo")
    };

    const passportChipsBox = el("pf_passport_chips");
    const photoThumb = el("pfPhotoThumb");
    const photoBtn = el("pfPhotoBtn");
    const photoHint = el("pfPhotoHint");
    const Countries = window.SeavCountries;

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
    }

    populateCountrySelects();

    // "Current Qualification" used to be free text. Now it draws from the
    // certificates the crew member has actually saved on the Certificates
    // page (matching CV generator/public profile conventions for what
    // counts as a "saved" cert), filtered further to actual rank/command
    // CoCs only (isCurrentQualificationCert) — a saved ENG1 or STCW Basic
    // Safety Training cert is real and "saved" but isn't a qualification/
    // rank, so it shouldn't show up here. Certs load in the background
    // after profile.html's initial paint (see js/state.js's deferred-key
    // hydration for this page), so this also gets called again from
    // refreshProfileView() once bindStateRefresh's "seav:data-updated"
    // fires with the fetched certs — not just once at init.
    function populateQualificationOptions() {
      const select = fields.qualification;
      if (!select) return;

      const savedCerts = getSavedCertificates
        ? getSavedCertificates(window.SeavState?.certs || [])
        : [];
      const certs = isCurrentQualificationCert
        ? savedCerts.filter(isCurrentQualificationCert)
        : savedCerts;
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

    const preview = {
      name: el("previewName"),
      rank: el("previewRank"),
      qualification: el("previewQualification"),
      nationality: el("previewNationality"),
      dob: el("previewDob"),
      location: el("previewLocation"),
      email: el("previewEmail"),
      phone: el("previewPhone"),
      passportsHeld: el("previewPassportsHeld"),
      visasHeld: el("previewVisasHeld"),
      availability: el("previewAvailability"),
      bio: el("previewBio"),
      photo: el("profilePreviewPhoto")
    };

    function loadProfile() {
      return {
        ...DEFAULT_PROFILE,
        ...(window.SeavState?.profile || {}),
        id: window.SeavState?.profile?.id || DEFAULT_PROFILE.id
      };
    }

    function splitDob(value) {
      const raw = String(value || "").trim();
      if (!raw || !raw.includes("-")) {
        return { year: "", month: "", day: "" };
      }

      const [year = "", month = "", day = ""] = raw.split("-");
      return { year, month, day };
    }

    function buildDob(day, month, year) {
      const d = String(day || "").trim();
      const m = String(month || "").trim();
      const y = String(year || "").trim();

      if (!d || !m || !y) return "";

      if (!/^\d{4}$/.test(y)) return "";
      if (!/^\d{2}$/.test(m)) return "";
      if (!/^\d{2}$/.test(d)) return "";

      return `${y}-${m}-${d}`;
    }

    function formatDobForPreview(value) {
      const parts = splitDob(value);
      if (!parts.year || !parts.month || !parts.day) return "—";
      return `${parts.day}/${parts.month}/${parts.year}`;
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
      previewFromForm();
    }

    function removePassportChip(name) {
      passportChips = passportChips.filter((chip) => chip !== name);
      renderPassportChips();
      previewFromForm();
    }

    if (fields.passportAdd) {
      fields.passportAdd.addEventListener("click", () => {
        const value = fields.passportCountry?.value || "";
        if (!value) return;
        addPassportChip(value);
        fields.passportCountry.value = "";
      });
    }

    if (passportChipsBox) {
      passportChipsBox.addEventListener("click", (e) => {
        const btn = e.target.closest(".profile-chip-remove");
        if (!btn) return;
        removePassportChip(btn.dataset.name || "");
      });
    }

    if (photoBtn && fields.photo) {
      photoBtn.addEventListener("click", () => fields.photo.click());
    }

    // Mirrors the same background-image treatment the Preview card's avatar
    // already used — previously the form only had a bare <input type=file>
    // with no indication a photo already existed, which read as "nothing
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

    function renderPreview(profile) {
      if (preview.name) preview.name.textContent = profile.name || "Your Name";
      if (preview.rank) preview.rank.textContent = profile.rank || "—";
      if (preview.qualification) preview.qualification.textContent = profile.qualification || "—";
      if (preview.nationality) preview.nationality.textContent = profile.nationality || "—";
      if (preview.dob) preview.dob.textContent = formatDobForPreview(profile.dob);
      if (preview.location) preview.location.textContent = profile.location || "—";
      if (preview.email) preview.email.textContent = profile.email || "—";
      if (preview.phone) preview.phone.textContent = profile.phone || "—";
      if (preview.passportsHeld) preview.passportsHeld.textContent = profile.passportsHeld || "—";
      if (preview.visasHeld) preview.visasHeld.textContent = profile.visasHeld || "—";
      if (preview.availability) preview.availability.textContent = profile.availability || "—";
      if (preview.bio) preview.bio.textContent = profile.bio || "—";

      if (preview.photo) {
        const photoUrl = Seav.getFileDisplayUrl(
          profile.photo,
          window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
        );

      if (photoUrl) {
          const safeUrl = String(photoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          preview.photo.style.backgroundImage = `url("${safeUrl}")`;
          preview.photo.style.backgroundSize = "cover";
          preview.photo.style.backgroundPosition = "center";
          preview.photo.style.backgroundRepeat = "no-repeat";
        } else {
          preview.photo.style.backgroundImage = "";
        }
      }
    }

    function readProfileForm() {
      return {
        name: fields.name?.value.trim() || "",
        rank: fields.rank?.value.trim() || "",
        qualification: fields.qualification?.value.trim() || "",
        nationality: fields.nationality?.value.trim() || "",
        dob: buildDob(
          fields.dobDay?.value || "",
          fields.dobMonth?.value || "",
          fields.dobYear?.value || ""
        ),
        location: fields.location?.value.trim() || "",
        email: fields.email?.value.trim() || "",
        phone: buildPhone(fields.phoneCountry?.value || "", fields.phoneNumber?.value || ""),
        passportsHeld: passportChips.join(", "),
        visasHeld: fields.visasHeld?.value.trim() || "",
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
        kind: "Photo"
      }) ?? existingPhoto ?? null;
    }

    function fillForm(profile) {
      const dobParts = splitDob(profile.dob);

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
      if (fields.dobDay) fields.dobDay.value = dobParts.day || "";
      if (fields.dobMonth) fields.dobMonth.value = dobParts.month || "";
      if (fields.dobYear) fields.dobYear.value = dobParts.year || "";
      if (fields.location) fields.location.value = profile.location || "";
      if (fields.email) fields.email.value = profile.email || "";

      const phoneParts = splitPhone(profile.phone);
      if (fields.phoneCountry) fields.phoneCountry.value = phoneParts.iso2 || "";
      if (fields.phoneNumber) fields.phoneNumber.value = phoneParts.number || "";

      setPassportChips(profile.passportsHeld);
      if (fields.visasHeld) fields.visasHeld.value = profile.visasHeld || "";
      if (fields.availability) fields.availability.value = profile.availability || "Available Immediately";
      if (fields.bio) fields.bio.value = profile.bio || "";

      renderPhotoThumb(profile.photo, { isNewSelection: false });
    }

    let previewObjectUrl = null;

    function refreshProfileView() {
      const profile = loadProfile();
      populateQualificationOptions();
      fillForm(profile);
      renderPreview(profile);
    }

    function previewFromForm() {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }

      const current = loadProfile();
      const formData = readProfileForm();
      let previewPhoto = current.photo;
      if (formData.file) {
        previewObjectUrl = URL.createObjectURL(formData.file);
        previewPhoto = { dataUrl: previewObjectUrl };
      }

      renderPhotoThumb(previewPhoto, { isNewSelection: !!formData.file });

      renderPreview({
        ...current,
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
        photo: previewPhoto
      });
    }

    form.addEventListener("input", previewFromForm);
    if (fields.photo) {
      fields.photo.addEventListener("change", previewFromForm);
    }

    if (fields.dobYear) {
      fields.dobYear.addEventListener("input", () => {
        fields.dobYear.value = fields.dobYear.value.replace(/\D/g, "").slice(0, 4);
      });
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

      await SeavAPI.save(KEYS.PROFILE, profile);

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      } else {
        refreshProfileView();
      }

      return profile;
      }, { sub: "Updating your profile" });
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