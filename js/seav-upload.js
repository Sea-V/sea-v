// /js/seav-upload.js — shared Supabase storage upload helper
(function () {
  "use strict";

  async function uploadToStorage({
    bucket,
    entityId,
    file,
    existingMeta,
    kind = "File",
    errorHint = null
  }) {
    if (!file) return existingMeta || null;

    if (window.SeavSupabase && window.SeavAPI) {
      const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = window.SeavAPI.buildStoragePath(entityId, safeName);

      const { error } = await window.SeavSupabase.storage.from(bucket).upload(filePath, file, {
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

      return window.SeavAPI.buildUploadedFileMeta(bucket, filePath, file);
    }

    if (window.Seav?.buildStoredFile) {
      return window.Seav.buildStoredFile(file, {
        fallback: existingMeta || null,
        kind
      });
    }

    return existingMeta || null;
  }

  window.SeavUpload = { uploadToStorage };
})();
