// /js/cv-export-docx.js
// Builds a minimal but valid .docx (OOXML) Word document straight from the
// CV document model (the same model used to render the on-screen preview),
// using JSZip — the same client-side archive library already used by
// certificates-export.js and payslips-export.js. No external docx library.
(function () {
  "use strict";
  const M = window.SeavCvModel;
  if (!M) return;
  const { formatVesselSubline, formatProfileDob, splitProfileLines, splitParagraphs } = M;

  const ACCENT = "1F3864";
  const MUTED = "555555";

  const CONTENT_TYPES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

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
    return paragraph(`•  ${text}`, runOpts, { indentLeft: 360, ...paraOpts });
  }

  function sectionHeading(text) {
    return paragraph(text, { bold: true, size: 28, color: ACCENT }, { spacingBefore: 240, spacingAfter: 120 });
  }

  function buildDocumentXml(doc) {
    const profile = doc.profile || {};
    const sections = doc.sections || {};
    const body = [];

    body.push(paragraph(profile.name || "Your Name", { bold: true, size: 48, color: ACCENT }, { spacingAfter: 40 }));
    if (doc.headline) {
      body.push(paragraph(doc.headline, { italic: true, size: 24, color: MUTED }, { spacingAfter: 120 }));
    }

    if (sections.showContact) {
      const contactParts = [profile.phone, profile.email, profile.location].filter(Boolean);
      if (contactParts.length) {
        body.push(paragraph(contactParts.join("   |   "), { size: 20, color: MUTED }, { spacingAfter: 200 }));
      }
    }

    (doc.summaryParagraphs || []).forEach((p) => {
      body.push(paragraph(p, { size: 22 }, { spacingAfter: 160 }));
    });

    body.push(sectionHeading("Yachting Experience"));
    if (!doc.vessels.length) {
      body.push(
        paragraph(
          "Include at least one vessel in the CV editor.",
          { italic: true, size: 22, color: MUTED },
          { spacingAfter: 160 }
        )
      );
    } else {
      doc.vessels.forEach((vessel) => {
        const role = vessel.cvRole || "Crew member";
        const titleLine = [vessel.dateRange, role, vessel.name || "Yacht"].filter(Boolean).join("   |   ");
        body.push(paragraph(titleLine, { bold: true, size: 22 }, { spacingBefore: 160, spacingAfter: 20 }));

        const subline = formatVesselSubline ? formatVesselSubline(vessel) : "";
        if (subline) {
          body.push(paragraph(subline, { italic: true, size: 20, color: MUTED }, { spacingAfter: 60 }));
        }

        if (vessel.cvDescription) {
          (splitParagraphs ? splitParagraphs(vessel.cvDescription) : [vessel.cvDescription]).forEach((p) => {
            body.push(paragraph(p, { size: 22 }, { spacingAfter: 80 }));
          });
        }

        (vessel.cvBullets || []).forEach((b) => {
          body.push(bulletParagraph(b, { size: 22 }, { spacingAfter: 40 }));
        });
      });
    }

    const dob = formatProfileDob ? formatProfileDob(profile.dob) : profile.dob || "";
    if (dob) {
      body.push(sectionHeading("Date of Birth"));
      body.push(paragraph(dob, { size: 22 }, { spacingAfter: 160 }));
    }

    const nationalityLines = [];
    if (profile.nationality) nationalityLines.push(profile.nationality);
    (splitProfileLines ? splitProfileLines(profile.passportsHeld) : []).forEach((l) => nationalityLines.push(l));
    (splitProfileLines ? splitProfileLines(profile.visasHeld) : []).forEach((l) => nationalityLines.push(l));
    if (nationalityLines.length) {
      body.push(sectionHeading("Nationality & Visas"));
      nationalityLines.forEach((l) => body.push(paragraph(l, { size: 22 }, { spacingAfter: 40 })));
      body.push(emptyParagraph());
    }

    if (profile.availability) {
      body.push(sectionHeading("Availability"));
      body.push(paragraph(profile.availability, { size: 22 }, { spacingAfter: 160 }));
    }

    if (sections.showCerts && doc.certStrip?.length) {
      body.push(sectionHeading("Yacht Qualifications"));
      doc.certStrip.forEach((c) => body.push(bulletParagraph(c, { size: 22 }, { spacingAfter: 40 })));
      body.push(emptyParagraph());
    }

    if (sections.showEducation && doc.specialistQualifications?.length) {
      body.push(sectionHeading("Other Qualifications"));
      doc.specialistQualifications.forEach((item) => {
        const label = [item.title, item.year ? `(${item.year})` : ""].filter(Boolean).join(" ");
        body.push(bulletParagraph(label, { size: 22 }, { spacingAfter: 40 }));
      });
      body.push(emptyParagraph());
    }

    if (sections.showHighlights && doc.highlights?.length) {
      body.push(sectionHeading("Milestones"));
      doc.highlights.forEach((h) => body.push(bulletParagraph(h, { size: 22 }, { spacingAfter: 40 })));
      body.push(emptyParagraph());
    }

    if (sections.showReferences && doc.references?.length) {
      body.push(sectionHeading("References"));
      doc.references.forEach((ref) => {
        body.push(paragraph(ref.name, { bold: true, size: 22 }, { spacingBefore: 100, spacingAfter: 20 }));
        if (ref.detail) body.push(paragraph(ref.detail, { size: 20, color: MUTED }, { spacingAfter: 20 }));
        if (ref.email) body.push(paragraph(ref.email, { size: 20, color: MUTED }, { spacingAfter: 20 }));
      });
    }

    if (sections.showSeavBranding) {
      body.push(
        paragraph("Built with SEA-V", { italic: true, size: 16, color: MUTED }, { spacingBefore: 300, align: "center" })
      );
    }

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

  async function buildCvDocxBlob(documentModel) {
    if (typeof JSZip === "undefined") {
      throw new Error("Export library not loaded. Refresh the page and try again.");
    }
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.folder("_rels").file(".rels", RELS_XML);
    zip.folder("word").file("document.xml", buildDocumentXml(documentModel));
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
