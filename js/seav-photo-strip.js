// /js/seav-photo-strip.js
//
// Captioned photo evidence: a tight row of thumbnails, each with a short
// label and an optional one-line description, plus a viewer that opens a
// photo large with its caption. Built for onboard experience (v536, per
// Jack: one full-width photo "takes the entire row up", and employers need
// to see what they are looking at). Land-based experience is meant to use
// the same strip, so nothing here is onboard-specific.
//
// Photo shape (stored-file metadata + two text keys, see
// docs/schema-onboard-experiences-photos.sql):
//   { bucket, path, filename, mime, size, uploadedAt, url?, label, caption }
//
// Labels and captions render in <strong>/<small>/<figcaption> on purpose:
// css/core/typography.css forces 14px !important on p/span/label/button,
// which would silently override the caption size.
(function () {
  "use strict";

  if (!window.Seav) return;

  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));

  function photoUrl(photo, bucket) {
    return window.Seav.getFileDisplayUrl?.(photo, bucket) || photo?.url || "";
  }

  function isImageFile(file) {
    const mime = String(file?.mime || "").toLowerCase();
    if (mime) return mime.startsWith("image/");
    return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(String(file?.filename || file?.path || ""));
  }

  // The photos an entry should show. js/api-mappers.js already folds a
  // pre-v536 image `attachment` into `photos`, but a localStorage snapshot
  // written by older code can still hold the old shape, so the same rule is
  // applied here rather than rendering an old photo as a file link.
  function getEntryPhotos(entry) {
    if (Array.isArray(entry?.photos) && entry.photos.length) return entry.photos;
    const attachment = entry?.attachment;
    if (attachment && isImageFile(attachment) && (attachment.path || attachment.url)) {
      return [{ ...attachment, label: entry.title || "Photo", caption: "" }];
    }
    return [];
  }

  // A non-image attachment (PDF), which stays a plain link beside the strip.
  function getEntryDocument(entry) {
    const attachment = entry?.attachment;
    if (!attachment || isImageFile(attachment)) return null;
    return attachment;
  }

  function buildPhotoStrip(photos, options = {}) {
    const items = (photos || [])
      .map((photo) => ({ photo, url: photoUrl(photo, options.bucket || null) }))
      .filter((item) => item.url);
    if (!items.length) return "";

    return `
      <div class="seav-photo-strip" data-seav-photo-group>
        ${items
          .map(({ photo, url }, index) => {
            const label = String(photo.label || "").trim() || "Photo";
            const caption = String(photo.caption || "").trim();
            return `
              <figure class="seav-photo-tile">
                <button type="button" class="seav-photo-thumb" data-seav-photo-index="${index}" aria-label="Open photo: ${esc(label)}">
                  <img src="${esc(url)}" alt="${esc(caption ? `${label}: ${caption}` : label)}" loading="lazy" />
                </button>
                <figcaption class="seav-photo-text">
                  <strong class="seav-photo-label">${esc(label)}</strong>
                  ${caption ? `<small class="seav-photo-caption">${esc(caption)}</small>` : ""}
                </figcaption>
              </figure>
            `;
          })
          .join("")}
      </div>
    `;
  }

  /* ---------- viewer ---------- */

  let viewer = null;
  let slides = [];
  let current = 0;

  function ensureViewer() {
    if (viewer) return viewer;
    viewer = document.createElement("dialog");
    viewer.className = "seav-photo-viewer";
    viewer.setAttribute("aria-label", "Photo");
    viewer.innerHTML = `
      <figure class="seav-photo-viewer-figure">
        <img class="seav-photo-viewer-img" alt="" />
        <figcaption class="seav-photo-viewer-text">
          <strong class="seav-photo-label"></strong>
          <small class="seav-photo-caption"></small>
          <small class="seav-photo-viewer-count"></small>
        </figcaption>
      </figure>
      <button type="button" class="seav-photo-viewer-btn seav-photo-viewer-close" data-seav-viewer="close" aria-label="Close photo">&times;</button>
      <button type="button" class="seav-photo-viewer-btn seav-photo-viewer-prev" data-seav-viewer="prev" aria-label="Previous photo">&#8249;</button>
      <button type="button" class="seav-photo-viewer-btn seav-photo-viewer-next" data-seav-viewer="next" aria-label="Next photo">&#8250;</button>
    `;
    document.body.appendChild(viewer);

    viewer.addEventListener("click", (e) => {
      // A click on the dialog box itself (not its contents) is the backdrop.
      if (e.target === viewer) return viewer.close();
      const action = e.target.closest("[data-seav-viewer]")?.getAttribute("data-seav-viewer");
      if (action === "close") viewer.close();
      else if (action === "prev") show(current - 1);
      else if (action === "next") show(current + 1);
    });
    viewer.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(current - 1);
      else if (e.key === "ArrowRight") show(current + 1);
    });
    return viewer;
  }

  function show(index) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    const slide = slides[current];
    viewer.querySelector(".seav-photo-viewer-img").src = slide.src;
    viewer.querySelector(".seav-photo-viewer-img").alt = slide.alt;
    viewer.querySelector(".seav-photo-viewer-text .seav-photo-label").textContent = slide.label;
    const captionEl = viewer.querySelector(".seav-photo-viewer-text .seav-photo-caption");
    captionEl.textContent = slide.caption;
    captionEl.hidden = !slide.caption;
    viewer.querySelector(".seav-photo-viewer-count").textContent =
      slides.length > 1 ? `${current + 1} of ${slides.length}` : "";
    viewer.classList.toggle("is-single", slides.length < 2);
  }

  function openFromThumb(thumb) {
    const group = thumb.closest("[data-seav-photo-group]");
    if (!group) return;
    slides = Array.from(group.querySelectorAll(".seav-photo-tile")).map((tile) => ({
      src: tile.querySelector("img")?.src || "",
      alt: tile.querySelector("img")?.alt || "",
      label: tile.querySelector(".seav-photo-label")?.textContent || "",
      caption: tile.querySelector(".seav-photo-caption")?.textContent || ""
    }));
    ensureViewer();
    show(Number(thumb.getAttribute("data-seav-photo-index")) || 0);
    if (typeof viewer.showModal === "function") viewer.showModal();
    else viewer.setAttribute("open", "");
  }

  document.addEventListener("click", (e) => {
    const thumb = e.target.closest(".seav-photo-thumb");
    if (!thumb) return;
    e.preventDefault();
    openFromThumb(thumb);
  });

  window.SeavPhotoStrip = {
    getEntryPhotos,
    getEntryDocument,
    buildPhotoStrip,
    isImageFile
  };
})();
