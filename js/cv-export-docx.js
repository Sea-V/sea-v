// /js/cv-export-docx.js
// Builds a valid .docx (OOXML) Word document straight from the CV document
// model (the same model used to render the on-screen preview), using JSZip —
// the same client-side archive library already used by
// certificates-export.js and payslips-export.js. No external docx library.
//
// Layout mirrors the on-screen CV: a two-column Word table (sidebar cell +
// main content cell), with the profile photo embedded as a real image.
(function () {
  "use strict";
  const M = window.SeavCvModel;
  if (!M) return;
  const { formatVesselSubline, formatProfileDob, splitProfileLines, splitProfileList, splitParagraphs } = M;

  const ACCENT = "1F3864";
  const MUTED = "555555";

  const SIDEBAR_WIDTH_DXA = 3060;
  const MAIN_WIDTH_DXA = 6578;
  const PHOTO_DISPLAY_WIDTH_PX = 132;
  const EMU_PER_PX = 9525;

  const RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const DOCUMENT_RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdPhoto" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo.png"/>' +
    "</Relationships>";

  function contentTypesXml(includePhoto) {
    const photoOverride = includePhoto ? '<Default Extension="png" ContentType="image/png"/>' : "";
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      photoOverride +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>"
    );
  }

  function xmlEscape(str) {
    return String(str ?? "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function rPrXml({ bold, italic, size, color } = {}) {
    const parts = [];
    if (bold) parts.push("<w:b/>");
    if (italic) parts.push("<w:i/>");
    if (color) parts.push(`<w:color w:val="${color}"/>`);
    if (size) parts.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
    return parts.length ? `<w:rPr>${parts.join("")}</w:rPr>` : "";
  }

  function runsFromText(text, runOpts) {
    const lines = String(text ?? "").split(/\n+/);
    const rPr = rPrXml(runOpts);
    return lines
      .map((line, i) => {
        const run = `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
        return i < lines.length - 1 ? `${run}<w:r><w:br/></w:r>` : run;
      })
      .join("");
  }

  function pPrXml({ spacingBefore, spacingAfter, align, indentLeft } = {}) {
    const parts = [];
    if (spacingBefore !== undefined || spacingAfter !== undefined) {
      const before = spacingBefore !== undefined ? ` w:before="${spacingBefore}"` : "";
      const after = spacingAfter !== undefined ? ` w:after="${spacingAfter}"` : "";
      parts.push(`<w:spacing${before}${after}/>`);
    }
    if (align) parts.push(`<w:jc w:val="${align}"/>`);
    if (indentLeft) parts.push(`<w:ind w:left="${indentLeft}"/>`);
    return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
  }

  function paragraph(text, runOpts = {}, paraOpts = {}) {
    return `<w:p>${pPrXml(paraOpts)}${runsFromText(text, runOpts)}</w:p>`;
  }

  function emptyParagraph() {
    return "<w:p/>";
  }

  function bulletParagraph(text, runOpts = {}, paraOpts = {}) {
    return paragraph(`•  ${text}`, runOpts, { indentLeft: 300, ...paraOpts });
  }

  function sectionHeading(text) {
    return paragraph(text, { bold: true, size: 26, color: ACCENT }, { spacingBefore: 220, spacingAfter: 100 });
  }

  function sidebarHeading(text) {
    return paragraph(text, { bold: true, size: 19, color: ACCENT }, { spacingBefore: 160, spacingAfter: 50 });
  }

  function photoParagraph(photoAsset) {
    if (!photoAsset) return "";
    return (
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:r><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
      `<wp:extent cx="${photoAsset.emuWidth}" cy="${photoAsset.emuHeight}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="1" name="Profile Photo"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr><pic:cNvPr id="0" name="photo.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="rIdPhoto" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${photoAsset.emuWidth}" cy="${photoAsset.emuHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
    );
  }

  function buildSidebarCell(doc, photoAsset) {
    const profile = doc.profile || {};
    const sections = doc.sections || {};
    const parts = [];

    if (photoAsset) parts.push(photoParagraph(photoAsset));

    if (sections.showContact) {
      const contactParts = [profile.phone, profile.email, profile.location].filter(Boolean);
      if (contactParts.length) {
        parts.push(sidebarHeading("Contact"));
        contactParts.forEach((p) => parts.push(paragraph(p, { size: 18 }, { spacingAfter: 30 })));
      }
    }

    const dob = formatProfileDob ? formatProfileDob(profile.dob) : profile.dob || "";
    if (dob) {
      parts.push(sidebarHeading("Date of Birth"));
      parts.push(paragraph(dob, { size: 18 }, { spacingAfter: 30 }));
    }

    // Each line is tagged with what it actually is (Nationality/Passport/Visa)
    // so e.g. a British nationality + a British passport don't show up as two
    // unlabelled "British" lines with no indication of what either one means.
    const nationalityLines = [];
    if (profile.nationality) nationalityLines.push(`Nationality: ${profile.nationality}`);
    (splitProfileList ? splitProfileList(profile.passportsHeld) : []).forEach((l) =>
      nationalityLines.push(`Passport: ${l}`)
    );
    (splitProfileLines ? splitProfileLines(profile.visasHeld) : []).forEach((l) =>
      nationalityLines.push(`Visa: ${l}`)
    );
    if (nationalityLines.length) {
      parts.push(sidebarHeading("Nationality & Visas"));
      nationalityLines.forEach((l) => parts.push(paragraph(l, { size: 18 }, { spacingAfter: 20 })));
    }

    if (profile.availability) {
      parts.push(sidebarHeading("Availability"));
      parts.push(paragraph(profile.availability, { size: 18 }, { spacingAfter: 30 }));
    }

    if (sections.showCerts && doc.certStrip?.length) {
      parts.push(sidebarHeading("Yacht Qualifications"));
      doc.certStrip.forEach((c) => parts.push(bulletParagraph(c, { size: 18 }, { spacingAfter: 20 })));
    }

    if (sections.showEducation && doc.specialistQualifications?.length) {
      parts.push(sidebarHeading("Other Qualifications"));
      doc.specialistQualifications.forEach((item) => {
        const label = [item.title, item.year ? `(${item.year})` : ""].filter(Boolean).join(" ");
        parts.push(bulletParagraph(label, { size: 18 }, { spacingAfter: 20 }));
      });
    }

    if (sections.showHighlights && doc.highlights?.length) {
      parts.push(sidebarHeading("Milestones"));
      doc.highlights.forEach((h) => parts.push(bulletParagraph(h, { size: 18 }, { spacingAfter: 20 })));
    }

    if (!parts.length) parts.push(emptyParagraph());
    return parts.join("");
  }

  function buildMainCell(doc) {
    const profile = doc.profile || {};
    const sections = doc.sections || {};
    const parts = [];

    parts.push(paragraph(profile.name || "Your Name", { bold: true, size: 40, color: ACCENT }, { spacingAfter: 30 }));
    if (doc.headline) {
      parts.push(paragraph(doc.headline, { italic: true, size: 21, color: MUTED }, { spacingAfter: 120 }));
    }

    (doc.summaryParagraphs || []).forEach((p) => {
      parts.push(paragraph(p, { size: 20 }, { spacingAfter: 140 }));
    });

    parts.push(sectionHeading("Yachting Experience"));
    if (!doc.vessels?.length) {
      parts.push(
        paragraph(
          "Include at least one vessel in the CV editor.",
          { italic: true, size: 20, color: MUTED },
          { spacingAfter: 140 }
        )
      );
    } else {
      doc.vessels.forEach((vessel) => {
        const role = vessel.cvRole || "Crew member";
        const titleLine = [vessel.dateRange, role, vessel.name || "Yacht"].filter(Boolean).join("   |   ");
        parts.push(paragraph(titleLine, { bold: true, size: 20 }, { spacingBefore: 140, spacingAfter: 20 }));

        const subline = formatVesselSubline ? formatVesselSubline(vessel) : "";
        if (subline) {
          parts.push(paragraph(subline, { italic: true, size: 18, color: MUTED }, { spacingAfter: 50 }));
        }

        if (vessel.cvDescription) {
          (splitParagraphs ? splitParagraphs(vessel.cvDescription) : [vessel.cvDescription]).forEach((p) => {
            parts.push(paragraph(p, { size: 20 }, { spacingAfter: 70 }));
          });
        }

        (vessel.cvBullets || []).forEach((b) => {
          parts.push(bulletParagraph(b, { size: 20 }, { spacingAfter: 30 }));
        });
      });
    }

    if (sections.showReferences && doc.references?.length) {
      parts.push(sectionHeading("References"));
      doc.references.forEach((ref) => {
        parts.push(paragraph(ref.name, { bold: true, size: 20 }, { spacingBefore: 90, spacingAfter: 20 }));
        if (ref.detail) parts.push(paragraph(ref.detail, { size: 18, color: MUTED }, { spacingAfter: 20 }));
        if (ref.email) parts.push(paragraph(ref.email, { size: 18, color: MUTED }, { spacingAfter: 20 }));
      });
    }

    if (!parts.length) parts.push(emptyParagraph());
    return parts.join("");
  }

  function buildDocumentXml(doc, photoAsset) {
    const sections = doc.sections || {};
    const body = [];

    if (sections.showSeavBranding) {
      body.push(
        paragraph("Built with SEA-V", { italic: true, size: 15, color: MUTED }, { spacingAfter: 100, align: "right" })
      );
    }

    const sidebarCellXml = buildSidebarCell(doc, photoAsset);
    const mainCellXml = buildMainCell(doc);

    const borderNone = (tag) => `<w:${tag} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;
    const tableXml =
      "<w:tbl>" +
      "<w:tblPr>" +
      `<w:tblW w:w="${SIDEBAR_WIDTH_DXA + MAIN_WIDTH_DXA}" w:type="dxa"/>` +
      "<w:tblBorders>" +
      borderNone("top") +
      borderNone("left") +
      borderNone("bottom") +
      borderNone("right") +
      borderNone("insideH") +
      borderNone("insideV") +
      "</w:tblBorders>" +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tblCellMar>' +
      "</w:tblPr>" +
      `<w:tblGrid><w:gridCol w:w="${SIDEBAR_WIDTH_DXA}"/><w:gridCol w:w="${MAIN_WIDTH_DXA}"/></w:tblGrid>` +
      "<w:tr>" +
      `<w:tc><w:tcPr><w:tcW w:w="${SIDEBAR_WIDTH_DXA}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${sidebarCellXml}</w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="${MAIN_WIDTH_DXA}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${mainCellXml}</w:tc>` +
      "</w:tr>" +
      "</w:tbl>";

    body.push(tableXml);
    body.push(emptyParagraph());

    const sectPr =
      "<w:sectPr>" +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
      "</w:sectPr>";

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${body.join("")}${sectPr}</w:body>` +
      "</w:document>"
    );
  }

  function safeFileName(name) {
    return String(name || "file")
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Loads an image blob into whatever the browser can hand to canvas
  // drawImage — createImageBitmap where available, a plain <img> otherwise.
  function loadDrawable(blob) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(blob)
        .then((bitmap) => ({ drawable: bitmap, width: bitmap.width, height: bitmap.height }))
        .catch(() => loadDrawableViaImg(blob));
    }
    return loadDrawableViaImg(blob);
  }

  function loadDrawableViaImg(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        resolve({ drawable: img, width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  // Fetches the profile photo and re-encodes it as PNG via canvas so the
  // embedded image is always in a format Word can render, regardless of the
  // original upload format. Fails soft (returns null) — a missing photo
  // should never block the rest of the export.
  async function tryLoadPhotoAsset(photoUrl) {
    if (!photoUrl) return null;
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const loaded = await loadDrawable(blob);
      if (!loaded || !loaded.width || !loaded.height) return null;

      const canvas = document.createElement("canvas");
      canvas.width = loaded.width;
      canvas.height = loaded.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(loaded.drawable, 0, 0);

      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!pngBlob) return null;
      const arrayBuffer = await pngBlob.arrayBuffer();

      const displayWidth = PHOTO_DISPLAY_WIDTH_PX;
      const displayHeight = Math.round((loaded.height / loaded.width) * displayWidth) || displayWidth;

      return {
        arrayBuffer,
        emuWidth: displayWidth * EMU_PER_PX,
        emuHeight: displayHeight * EMU_PER_PX
      };
    } catch (err) {
      console.warn("[SEA-V] CV Word export: profile photo could not be embedded", err);
      return null;
    }
  }

  async function buildCvDocxBlob(documentModel) {
    if (typeof JSZip === "undefined") {
      throw new Error("Export library not loaded. Refresh the page and try again.");
    }

    const photoAsset = await tryLoadPhotoAsset(documentModel?.photoUrl);

    const zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypesXml(!!photoAsset));
    zip.folder("_rels").file(".rels", RELS_XML);

    const wordFolder = zip.folder("word");
    wordFolder.file("document.xml", buildDocumentXml(documentModel, photoAsset));
    if (photoAsset) {
      wordFolder.folder("_rels").file("document.xml.rels", DOCUMENT_RELS_XML);
      wordFolder.folder("media").file("photo.png", photoAsset.arrayBuffer);
    }

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function exportCvAsDocx(documentModel) {
    const blob = await buildCvDocxBlob(documentModel);
    const name = safeFileName(documentModel?.profile?.name || "sea-v-cv");
    downloadBlob(blob, `${name}-cv.docx`);
  }

  window.SeavCvExportDocx = { exportCvAsDocx, buildCvDocxBlob };
})();
