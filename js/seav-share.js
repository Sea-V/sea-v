// /js/seav-share.js — generates a branded PNG "share card" for a badge unlock
// or a logged passage, then hands it to the OS share sheet (or a plain
// download if the browser/device can't share files). Loaded wherever
// js/badge-unlock.js is loaded, plus navigation.html.
//
// This is the groundwork pass: the pipeline (off-screen render -> html2canvas
// -> share/download) is meant to be solid long-term. The two card layouts
// below (badge + passage) are a first draft and expected to be redesigned
// later without touching this plumbing — see buildBadgeCardHtml /
// buildPassageCardHtml, the only two functions that describe what the image
// actually looks like.
(function () {
  "use strict";

  if (!window.Seav) return;

  const CARD_WIDTH = 640;
  const CARD_HEIGHT = 1138; // 9:16, matches Instagram/WhatsApp story crop

  const TIER_COLORS = {
    bronze: "#cd7f32",
    silver: "#c8d3de",
    gold: "#ffd25a",
    platinum: "#72e4ff",
    default: "#ffb347"
  };

  function escapeHtml(value) {
    return window.Seav.escapeHtml ? window.Seav.escapeHtml(value) : String(value || "");
  }

  function profileShareLine() {
    const profile = window.SeavState?.profile || {};
    const username = String(profile.username || "").trim();
    return username ? `sea-v.com/u/${username}` : "sea-v.com";
  }

  function cardShell(innerHtml) {
    return `
      <div style="
        width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;box-sizing:border-box;
        background:var(--page-shell-bg,#0e1c2e);color:#ffffff;
        font-family:inherit;padding:44px 36px;display:flex;flex-direction:column;
      ">
        <div style="display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800;color:var(--logo-sky,#72e4ff);letter-spacing:0.5px;">
          SEA-V
        </div>
        ${innerHtml}
        <div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:20px;text-align:center;">
          <p style="font-size:20px;color:var(--logo-sky,#72e4ff);margin:0;font-weight:600;">${escapeHtml(profileShareLine())}</p>
        </div>
      </div>
    `;
  }

  function buildBadgeCardHtml(data) {
    return cardShell(`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;">
        <div style="width:180px;height:180px;border-radius:50%;background:${escapeHtml(data.badgeColor)};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${
            data.imageSrc
              ? `<img src="${escapeHtml(data.imageSrc)}" alt="" crossorigin="anonymous" style="width:120px;height:120px;object-fit:contain;" />`
              : ""
          }
        </div>
        <div>
          <p style="font-size:40px;font-weight:800;margin:0 0 10px;">${escapeHtml(data.title)}</p>
          <p style="font-size:24px;color:rgba(255,255,255,0.68);margin:0;">${escapeHtml(data.subtitle)}</p>
        </div>
        ${
          data.statLabel
            ? `<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:26px;padding:12px 26px;font-size:22px;font-weight:600;">${escapeHtml(data.statLabel)}</div>`
            : ""
        }
      </div>
    `);
  }

  function buildProfileCardHtml(data) {
    return cardShell(`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;">
        <div style="width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.08);border:3px solid var(--logo-sky,#72e4ff);display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${
            data.imageSrc
              ? `<img src="${escapeHtml(data.imageSrc)}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;" />`
              : `<span style="font-size:64px;font-weight:800;color:var(--logo-sky,#72e4ff);">${escapeHtml(data.initial)}</span>`
          }
        </div>
        <div>
          <p style="font-size:40px;font-weight:800;margin:0 0 10px;">${escapeHtml(data.title)}</p>
          <p style="font-size:24px;color:rgba(255,255,255,0.68);margin:0;">${escapeHtml(data.subtitle)}</p>
        </div>
        ${
          data.statLabel
            ? `<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:26px;padding:12px 26px;font-size:22px;font-weight:600;">${escapeHtml(data.statLabel)}</div>`
            : ""
        }
      </div>
    `);
  }

  function buildPassageCardHtml(data) {
    return cardShell(`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;">
        <svg width="460" height="220" viewBox="0 0 460 220" aria-hidden="true">
          <circle cx="50" cy="170" r="9" fill="var(--page-navigation,#39e0c4)"></circle>
          <circle cx="410" cy="46" r="9" fill="var(--page-navigation,#39e0c4)"></circle>
          <path d="M50 170 Q 230 20 410 46" fill="none" stroke="var(--page-navigation,#39e0c4)" stroke-width="3" stroke-dasharray="6 9"></path>
          <text x="14" y="204" fill="#ffffff" font-size="22" font-weight="600">${escapeHtml(data.fromLabel)}</text>
          <text x="270" y="30" fill="#ffffff" font-size="22" font-weight="600">${escapeHtml(data.toLabel)}</text>
          ${
            data.distanceLabel
              ? `<text x="150" y="104" fill="var(--page-navigation,#39e0c4)" font-size="24" font-weight="700">${escapeHtml(data.distanceLabel)}</text>`
              : ""
          }
        </svg>
        <div style="text-align:center;">
          <p style="font-size:40px;font-weight:800;margin:0 0 10px;">${escapeHtml(data.title)}</p>
          <p style="font-size:24px;color:rgba(255,255,255,0.68);margin:0;">${escapeHtml(data.subtitle)}</p>
        </div>
      </div>
    `);
  }

  function renderOffscreen(html) {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.zIndex = "-1";
    host.style.pointerEvents = "none";
    host.innerHTML = html;
    document.body.appendChild(host);
    return host;
  }

  async function rasterize(node) {
    if (!window.html2canvas) throw new Error("html2canvas-missing");
    return window.html2canvas(node, {
      backgroundColor: null,
      scale: 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      useCORS: true
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("toBlob-failed"));
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function shareOrDownload(blob, { filename, title, text }) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return "shared";
      }
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      // Any other share failure: fall through to a plain download instead.
    }
    downloadBlob(blob, filename);
    return "downloaded";
  }

  // Best-effort clipboard copy — used as a fallback for the share link,
  // since navigator.share({ files, text }) frequently drops the `text`
  // (and any link inside it) once a file is attached: many share targets
  // (Instagram, WhatsApp, etc.) hand the receiving app only the image, not
  // the caption. Copying the link separately means the user always has it
  // to paste, regardless of what the receiving app does with `text`.
  async function copyLinkFallback(linkUrl) {
    if (!linkUrl || !navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(linkUrl);
      return true;
    } catch (err) {
      console.warn("[SEA-V] Could not copy share link to clipboard:", err);
      return false;
    }
  }

  async function generate(buildHtml, data, filenameBase, shareText, linkUrl) {
    if (!window.html2canvas) {
      window.Seav.notify?.(
        "error",
        "Share isn't ready",
        "This page is still loading the share tool — give it a second and try again."
      );
      return "unavailable";
    }

    const host = renderOffscreen(buildHtml(data));
    try {
      const canvas = await rasterize(host.firstElementChild || host);
      const blob = await canvasToBlob(canvas);
      const result = await shareOrDownload(blob, {
        filename: `${filenameBase}.png`,
        title: "SEA-V",
        text: shareText || ""
      });

      const linkCopied = await copyLinkFallback(linkUrl);

      if (result === "downloaded") {
        window.Seav.notify?.(
          "success",
          "Image saved",
          linkCopied
            ? "Share it from your downloads or photo library — your profile link was also copied, paste it alongside the image."
            : "Share it from your downloads or photo library."
        );
      } else if (result === "shared" && linkCopied) {
        window.Seav.notify?.(
          "success",
          "Link copied too",
          "Some apps drop the caption when you share an image — your profile link was copied, paste it in if it's missing."
        );
      }
      return result;
    } catch (err) {
      console.error("[SEA-V] Share card generation failed:", err);
      window.Seav.notify?.("error", "Couldn't create image", "Please try again.");
      return "error";
    } finally {
      host.remove();
    }
  }

  function shareBadge(payload) {
    if (!payload) return Promise.resolve("error");

    const profile = window.SeavState?.profile || {};
    const name = profile.name || "Seafarer";
    const rank = profile.rank || "";
    const tier = String(payload.tier || "default").toLowerCase();

    return generate(
      buildBadgeCardHtml,
      {
        title: payload.title || "New badge",
        subtitle: rank ? `${name} · ${rank}` : name,
        statLabel: payload.statLabel || "",
        imageSrc: payload.image || "",
        badgeColor: TIER_COLORS[tier] || TIER_COLORS.default
      },
      `seav-badge-${(payload.code || "milestone").toLowerCase()}`,
      `I just earned "${payload.title}" on SEA-V.`
    );
  }

  function sharePassage(entry, extra = {}) {
    if (!entry) return Promise.resolve("error");

    const subtitleParts = [extra.vesselName, extra.dateText].filter(Boolean);

    return generate(
      buildPassageCardHtml,
      {
        title: entry.passageName || extra.routeLabel || "Passage logged",
        subtitle: subtitleParts.join(" · "),
        fromLabel: entry.fromPort || "Departure",
        toLabel: entry.toPort || "Arrival",
        distanceLabel: extra.distanceText || ""
      },
      `seav-passage-${entry.id || "route"}`,
      `Logged a new passage on SEA-V${extra.routeLabel ? `: ${extra.routeLabel}` : ""}.`
    );
  }

  function shareProfile() {
    const profile = window.SeavState?.profile || {};
    const name = profile.name || "Seafarer";
    const subtitleParts = [profile.rank, profile.qualification].filter(Boolean);
    const imageSrc = window.Seav?.getFileDisplayUrl
      ? window.Seav.getFileDisplayUrl(
          profile.photo,
          window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos"
        )
      : "";
    const initial = String(name).trim().charAt(0).toUpperCase() || "S";

    // The card image prints this same URL on its face (see profileShareLine
    // in cardShell), but that's just a picture of text — not a real,
    // clickable/copyable link. The actual URL needs to travel in the share
    // text (and get copied as a fallback) or recipients only ever get a
    // picture with no way to reach the profile.
    const profileUrl = `https://${profileShareLine()}`;

    return generate(
      buildProfileCardHtml,
      {
        title: name,
        subtitle: subtitleParts.join(" · ") || "Maritime crew",
        statLabel: "View my SEA-V career profile",
        imageSrc,
        initial
      },
      `seav-profile-${(profile.username || "career").toLowerCase()}`,
      `Check out my SEA-V career profile: ${profileUrl}`,
      profileUrl
    );
  }

  window.SeavShare = { shareBadge, sharePassage, shareProfile };
})();
