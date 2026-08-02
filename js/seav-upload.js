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

  // heic2any decodes HEIC entirely in the browser (WASM), and for some files
  // — Live Photos, burst/multi-image HEIC containers, some Portrait-mode
  // depth shots — it can hang indefinitely instead of ever resolving or
  // rejecting. Without a bound on that, "Saving tender..." (or any photo
  // save) just spins forever with no error, no rejection, nothing for
  // withSaving()'s try/catch/finally to catch — because nothing ever
  // settles. Racing against a timeout guarantees this always resolves one
  // way or another, so a bad file surfaces as the same clear "couldn't be
  // converted" error instead of a silent infinite spinner.
  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function convertHeicToJpeg(file) {
    if (typeof window.heic2any !== "function") {
      console.warn("[SEA-V] heic2any not loaded — uploading original HEIC file.");
      return file;
    }
    try {
      const result = await withTimeout(
        window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }),
        30000,
        "HEIC conversion"
      );
      const jpegBlob = Array.isArray(result) ? result[0] : result;
      const newName = String(file.name || "photo").replace(/\.(heic|heif)$/i, "") + ".jpg";
      return new File([jpegBlob], newName, { type: "image/jpeg" });
    } catch (error) {
      console.warn("[SEA-V] HEIC conversion failed, uploading original file:", error);
      return file;
    }
  }

  // Default matches the storage buckets' own file_size_limit (10MB). Photo
  // fields (profile/vessel/tender/hobby photos) pass a tighter maxBytes —
  // a 10MB cap made sense for document/certificate scans, but an avatar-style
  // photo only ever displays as a small thumbnail, so 10MB was needlessly
  // generous and let people upload much larger files than the page needed.
  const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  async function uploadToStorage({
    bucket,
    entityId,
    file,
    existingMeta,
    kind = "File",
    errorHint = null,
    maxBytes = DEFAULT_MAX_UPLOAD_BYTES
  }) {
    if (!file) return existingMeta || null;

    if (file.size > maxBytes) {
      const msg = `${kind} too large. Please upload a file under ${Math.round(maxBytes / (1024 * 1024))}MB.`;
      if (window.SeavFeedback?.error) {
        window.SeavFeedback.error("File too large", msg);
      } else if (window.Seav?.notify) {
        window.Seav.notify("error", "File too large", msg);
      } else {
        alert(msg);
      }
      return existingMeta || null;
    }

    const wasHeic = isHeicFile(file);
    const uploadFile = wasHeic ? await convertHeicToJpeg(file) : file;

    // Guard against the exact bug found 2026-07-24: three tender photos
    // (Naiad, Rafnar, Axopar) were uploaded as raw, unconverted HEIC on
    // 2026-07-06 — about 90 minutes before this HEIC->JPEG conversion step
    // even existed in the codebase — and sat silently broken (invisible in
    // Chrome/Firefox/Edge, fine in Safari) for weeks because the old code
    // had no way to notice or report a failed/skipped conversion; it just
    // uploaded whatever convertHeicToJpeg() returned. That gap is now closed
    // for good: if the input was HEIC and what comes back is STILL HEIC
    // (heic2any not loaded, or it threw on an unusual file like a Live Photo/
    // portrait-depth HEIC), refuse the upload instead of silently storing a
    // file most browsers can't render, and tell the user why.
    if (wasHeic && isHeicFile(uploadFile)) {
      const detail =
        "This HEIC photo couldn't be converted for web display. Try again, or in your phone's camera settings switch to \"Most Compatible\" (JPEG) format and re-upload.";
      if (window.SeavFeedback?.error) {
        window.SeavFeedback.error("Photo not uploaded", detail);
      } else if (window.Seav?.notify) {
        window.Seav.notify("error", "Photo not uploaded", detail);
      }
      return existingMeta || null;
    }

    if (window.SeavSupabase && window.SeavAPI) {
      const safeName = String(uploadFile.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = window.SeavAPI.buildStoragePath(entityId, safeName);

      let uploadError = null;
      try {
        const { error } = await withTimeout(
          window.SeavSupabase.storage.from(bucket).upload(filePath, uploadFile, {
            cacheControl: "3600",
            upsert: true
          }),
          30000,
          `${kind} upload`
        );
        uploadError = error;
      } catch (timeoutErr) {
        uploadError = timeoutErr;
      }

      if (uploadError) {
        console.error(`[SEA-V] ${kind} upload failed:`, uploadError);
        let detail =
          errorHint && /row-level security|bucket not found|does not exist/i.test(uploadError.message || "")
            ? errorHint
            : uploadError.message || `Could not upload ${kind.toLowerCase()}. Try a smaller file.`;
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

  // Live "you just picked a file" thumbnail previews (Profile, Vessels,
  // Tenders) used to call URL.createObjectURL() directly on whatever the
  // <input type=file> gave them. That's fine for JPEG/PNG, but for a HEIC
  // photo it produces a blob URL Chrome/Firefox/Edge can't decode either —
  // same root cause as the upload bug above, just one step earlier — so the
  // thumbnail box goes blank/broken the instant a HEIC file is chosen, well
  // before Save ever runs the real conversion. Routing previews through this
  // shared helper (same HEIC->JPEG conversion as uploadToStorage) means the
  // preview matches what actually gets saved, instead of lying about it.
  async function buildPreviewUrl(file) {
    if (!file) return null;
    const source = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
    if (isHeicFile(source)) return null; // conversion failed/skipped — unsafe to preview
    try {
      return URL.createObjectURL(source);
    } catch (error) {
      console.warn("[SEA-V] Could not build preview URL:", error);
      return null;
    }
  }

  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

  window.SeavUpload = { uploadToStorage, isHeicFile, buildPreviewUrl, PHOTO_MAX_BYTES };
})();
