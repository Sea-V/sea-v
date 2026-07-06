// /js/seav-upload.js — shared Supabase storage upload helper
(function () {
  "use strict";

  // Safari has native HEIC/HEIF decoding built into WebKit (Apple's own photo
  // format), so photos uploaded straight from an iPhone camera roll render
  // fine there — but Chrome, Firefox, and Edge cannot display HEIC in an
  // <img> tag at all and just show a broken-image icon. Since this is the one
  // shared choke point every domain's file upload goes through, converting
  // HEIC -> JPEG here (client-side, via heic2any) fixes it everywhere at once
  // instead of needing a per-domain fix.
  function isHeicFile(file) {
    const type = String(file?.type || "").toLowerCase();
    if (type === "image/heic" || type === "image/heif") return true;
    const name = String(file?.name || "").toLowerCase();
    return name.endsWith(".heic") || name.endsWith(".heif");
  }

  async function convertHeicToJpeg(file) {
    if (typeof window.heic2any !== "function") {
      console.warn("[SEA-V] heic2any not loaded — uploading original HEIC file.");
      return file;
    }
    try {
      const result = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const jpegBlob = Array.isArray(result) ? result[0] : result;
      const newName = String(file.name || "photo").replace(/\.(heic|heif)$/i, "") + ".jpg";
      return new File([jpegBlob], newName, { type: "image/jpeg" });
    } catch (error) {
      console.warn("[SEA-V] HEIC conversion failed, uploading original file:", error);
      return file;
    }
  }

  async function uploadToStorage({
    bucket,
    entityId,
    file,
    existingMeta,
    kind = "File",
    errorHint = null
  }) {
    if (!file) return existingMeta || null;

    const uploadFile = isHeicFile(file) ? await convertHeicToJpeg(file) : file;

    if (window.SeavSupabase && window.SeavAPI) {
      const safeName = String(uploadFile.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = window.SeavAPI.buildStoragePath(entityId, safeName);

      const { error } = await window.SeavSupabase.storage.from(bucket).upload(filePath, uploadFile, {
        cacheControl: "3600",
        upsert: true
      });

      if (error) {
        console.error(`[SEA-V] ${kind} upload failed:`, error);
        let detail =
          errorHint && /row-level security|bucket not found|does not exist/i.test(error.message || "")
            ? errorHint
            : error.message || `Could not upload ${kind.toLowerCase()}. Try a smaller file.`;
        if (window.SeavFeedback?.error) {
          window.SeavFeedback.error("Upload failed", detail);
        } else if (window.Seav?.notify) {
          window.Seav.notify("error", "Upload failed", detail);
        }
        return existingMeta || null;
      }

      return window.SeavAPI.buildUploadedFileMeta(bucket, filePath, uploadFile);
    }

    if (window.Seav?.buildStoredFile) {
      return window.Seav.buildStoredFile(uploadFile, {
        fallback: existingMeta || null,
        kind
      });
    }

    return existingMeta || null;
  }

  window.SeavUpload = { uploadToStorage };
})();
