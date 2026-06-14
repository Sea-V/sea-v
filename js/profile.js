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

  const { KEYS, DEFAULT_PROFILE } = window.SeavData;

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
      phone: el("pf_phone"),
      passportsHeld: el("pf_passportsHeld"),
      visasHeld: el("pf_visasHeld"),
      salary: el("pf_salary"),
      availability: el("pf_availability"),
      bio: el("pf_bio"),
      photo: el("pf_photo"),
      publicEnabled: el("pf_publicEnabled")
    };

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
      salary: el("previewSalary"),
      availability: el("previewAvailability"),
      bio: el("previewBio"),
      photo: el("profilePreviewPhoto")
    };

    const viewPublicBtn = document.getElementById("btnViewPublicProfile");
    const copyPublicBtn = document.getElementById("btnCopyPublicUrl");

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
      if (preview.salary) preview.salary.textContent = profile.salary || "—";
      if (preview.availability) preview.availability.textContent = profile.availability || "—";
      if (preview.bio) preview.bio.textContent = profile.bio || "—";

      if (preview.photo) {
        const photoUrl = profile.photo?.url || profile.photo?.dataUrl || "";

      if (photoUrl) {
          preview.photo.style.backgroundImage = `url(${photoUrl})`;
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
        phone: fields.phone?.value.trim() || "",
        passportsHeld: fields.passportsHeld?.value.trim() || "",
        visasHeld: fields.visasHeld?.value.trim() || "",
        salary: fields.salary?.value.trim() || "",
        availability: fields.availability?.value || "Available Immediately",
        bio: fields.bio?.value.trim() || "",
        file: fields.photo?.files?.[0] || null,
        publicEnabled: !!fields.publicEnabled?.checked
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
      if (fields.qualification) fields.qualification.value = profile.qualification || "";
      if (fields.nationality) fields.nationality.value = profile.nationality || "";
      if (fields.dobDay) fields.dobDay.value = dobParts.day || "";
      if (fields.dobMonth) fields.dobMonth.value = dobParts.month || "";
      if (fields.dobYear) fields.dobYear.value = dobParts.year || "";
      if (fields.location) fields.location.value = profile.location || "";
      if (fields.email) fields.email.value = profile.email || "";
      if (fields.phone) fields.phone.value = profile.phone || "";
      if (fields.passportsHeld) fields.passportsHeld.value = profile.passportsHeld || "";
      if (fields.visasHeld) fields.visasHeld.value = profile.visasHeld || "";
      if (fields.salary) fields.salary.value = profile.salary || "";
      if (fields.availability) fields.availability.value = profile.availability || "Available Immediately";
      if (fields.bio) fields.bio.value = profile.bio || "";
      if (fields.publicEnabled) {
        fields.publicEnabled.checked = !!profile.publicEnabled;
      }
    }

    function refreshProfileView() {
      const profile = loadProfile();
      fillForm(profile);
      renderPreview(profile);
    }

    function previewFromForm() {
      const current = loadProfile();
      const formData = readProfileForm();
      const previewPhoto = formData.file
        ? { dataUrl: URL.createObjectURL(formData.file) }
        : current.photo;

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
        salary: formData.salary,
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
        salary: formData.salary,
        availability: formData.availability,
        bio: formData.bio,
        publicEnabled: formData.publicEnabled,
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
          "Check the browser console (F12) for details. If public profile never turns on, verify the public_enabled column in Supabase."
        );
      }
    });

    if (viewPublicBtn) {
      viewPublicBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const newTab = window.open("about:blank", "_blank");

        try {
          const profile = await saveProfileFromForm();

          if (!window.SeavData?.isProfilePublic(profile)) {
            if (newTab) newTab.close();
            Seav.notify(
              "info",
              "Public profile hidden",
              "Tick “Make my public profile visible” and try again, or click Save Profile first."
            );
            return;
          }

          const publicUrl = new URL(
            profile.id
              ? `public-profile.html?p=${encodeURIComponent(profile.id)}`
              : "public-profile.html",
            window.location.href
          ).href;

          if (newTab) {
            newTab.location.replace(publicUrl);
          } else {
            window.open(publicUrl, "_blank", "noopener");
          }
        } catch (err) {
          if (newTab) newTab.close();
          console.error("[SEA-V] Profile save failed:", err);
          Seav.notify(
            "error",
            "Could not open public profile",
            "Save your profile first. See the browser console (F12) for details."
          );
        }
      });
    }

    if (copyPublicBtn) {
      copyPublicBtn.addEventListener("click", async () => {
        const profileId = window.SeavAuth?.getUserId?.() || window.SeavState?.profile?.id;
        if (!profileId) {
          Seav.notify("error", "Not signed in", "Save your profile after logging in.");
          return;
        }

        const publicUrl = new URL(`public-profile.html?p=${encodeURIComponent(profileId)}`, window.location.href).href;

        try {
          await navigator.clipboard.writeText(publicUrl);
          Seav.notify("success", "Link copied", "Public profile URL copied to clipboard.");
        } catch (err) {
          window.prompt("Copy your public profile link:", publicUrl);
        }
      });
    }

    const runRefresh = () => {
      refreshProfileView();
    };

    if (window.SeavState?.ready) {
      runRefresh();
    } else {
      document.addEventListener("seav:state-ready", runRefresh, { once: true });
    }

    document.addEventListener("seav:data-updated", runRefresh);

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