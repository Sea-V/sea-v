document.addEventListener("DOMContentLoaded", () => {
  // ---- localStorage helpers (safe even if core.js changes) ----
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- elements ----
  const form = document.getElementById("profileForm");
  if (!form) return;

  const el = (id) => document.getElementById(id);

  const pf_name = el("pf_name");
  const pf_rank = el("pf_rank");
  const pf_nationality = el("pf_nationality");
  const pf_dob = el("pf_dob");
  const pf_location = el("pf_location");
  const pf_email = el("pf_email");
  const pf_phone = el("pf_phone");
  const pf_availability = el("pf_availability");
  const pf_bio = el("pf_bio");
  const pf_photo = el("pf_photo");

  // Preview
  const previewName = el("previewName");
  const previewLine1 = el("previewLine1");
  const previewLine2 = el("previewLine2");
  const previewLine3 = el("previewLine3");
  const previewBio = el("previewBio");
  const previewPhoto = el("profilePreviewPhoto");

  // ---- load existing profile into form ----
  const existing = load("seav_profile", null);
  if (existing) {
    pf_name.value = existing.name || "";
    pf_rank.value = existing.rank || "";
    pf_nationality.value = existing.nationality || "";
    pf_dob.value = existing.dob || "";
    pf_location.value = existing.location || "";
    pf_email.value = existing.email || "";
    pf_phone.value = existing.phone || "";
    pf_availability.value = existing.availability || "Available";
    pf_bio.value = existing.bio || "";
    if (existing.photo?.dataUrl && previewPhoto) {
      previewPhoto.style.backgroundImage = `url(${existing.photo.dataUrl})`;
      previewPhoto.style.backgroundSize = "cover";
      previewPhoto.style.backgroundPosition = "center";
    }
  }

  function renderPreview(profile) {
    if (previewName) previewName.textContent = profile.name || "Your Name";

    if (previewLine1) {
      previewLine1.textContent = `Rank: ${profile.rank || "—"} • Nationality: ${profile.nationality || "—"}`;
    }
    if (previewLine2) {
      previewLine2.textContent = `Availability: ${profile.availability || "—"}`;
    }
    if (previewLine3) {
      previewLine3.textContent = `Location: ${profile.location || "—"}`;
    }
    if (previewBio) previewBio.textContent = profile.bio || "";

    if (previewPhoto) {
      if (profile.photo?.dataUrl) {
        previewPhoto.style.backgroundImage = `url(${profile.photo.dataUrl})`;
        previewPhoto.style.backgroundSize = "cover";
        previewPhoto.style.backgroundPosition = "center";
      } else {
        previewPhoto.style.backgroundImage = "";
      }
    }
  }

  // Initial preview
  renderPreview(load("seav_profile", {
    name: pf_name.value,
    rank: pf_rank.value,
    nationality: pf_nationality.value,
    dob: pf_dob.value,
    location: pf_location.value,
    email: pf_email.value,
    phone: pf_phone.value,
    availability: pf_availability.value,
    bio: pf_bio.value,
    photo: null
  }));

  // Live preview on input
  form.addEventListener("input", () => {
    const current = load("seav_profile", {});
    renderPreview({
      ...current,
      name: pf_name.value.trim(),
      rank: pf_rank.value.trim(),
      nationality: pf_nationality.value.trim(),
      dob: pf_dob.value,
      location: pf_location.value.trim(),
      email: pf_email.value.trim(),
      phone: pf_phone.value.trim(),
      availability: pf_availability.value,
      bio: pf_bio.value.trim(),
    });
  });

  // Save
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const profile = load("seav_profile", {
      publicEnabled: false
    });

    profile.name = pf_name.value.trim();
    profile.rank = pf_rank.value.trim();
    profile.nationality = pf_nationality.value.trim();
    profile.dob = pf_dob.value || "";
    profile.location = pf_location.value.trim();
    profile.email = pf_email.value.trim();
    profile.phone = pf_phone.value.trim();
    profile.availability = pf_availability.value;
    profile.bio = pf_bio.value.trim();

    const file = pf_photo?.files?.[0] || null;
    if (file) {
      const maxBytes = 2 * 1024 * 1024;
      if (file.size > maxBytes) {
        alert("Photo too large. Please upload an image under 2MB for the prototype.");
        return;
      }
      profile.photo = {
        filename: file.name,
        mime: file.type || "image/*",
        dataUrl: await readFileAsDataURL(file),
      };
    }

    save("seav_profile", profile);
    renderPreview(profile);

    alert("Profile saved.");
  });
});