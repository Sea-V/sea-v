// /js/seav-share.js — generates a branded PNG "share card" for a badge unlock
// or a logged passage, then hands it to the OS share sheet (or a plain
// download if the browser/device can't share files). Loaded wherever
// js/badge-unlock.js is loaded, plus navigation.html.
//
// The pipeline (off-screen render -> html2canvas -> share/download) is meant
// to be solid long-term; the card layouts (buildBadgeCardHtml /
// buildPassageCardHtml / buildProfileCardHtml) are what actually change the
// image's look. The passage card renders a real to-scale mini map (real
// country shapes + the entry's actual fromLat/fromLng/toLat/toLng) using the
// same world boundary data js/navigation-map.js uses for the live map's
// green country highlight -- see buildPassageMapSvg. It falls back to a
// plain abstract curve if the entry has no coordinates or the boundary data
// can't be loaded, so sharing never breaks.
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

  // showLink lets a card opt out of printing the raw sea-v.com/u/<username>
  // text on the image itself (see buildProfileCardHtml) — used when a pill
  // already inside the card serves as the visible call-to-action and the
  // real URL should only travel via the share caption / clipboard-copy
  // fallback (see copyLinkFallback), not as text baked into the picture.
  function cardShell(innerHtml, { showLink = true } = {}) {
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
        ${
          showLink
            ? `<div style="border-top:1px solid rgba(255,255,255,0.14);padding-top:20px;text-align:center;">
          <p style="font-size:20px;color:var(--logo-sky,#72e4ff);margin:0;font-weight:600;">${escapeHtml(profileShareLine())}</p>
        </div>`
            : ""
        }
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
            ? `<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:26px;padding:12px 26px;font-size:22px;font-weight:600;line-height:1;display:flex;align-items:center;justify-content:center;">${escapeHtml(data.statLabel)}</div>`
            : ""
        }
      </div>
    `);
  }

  function buildProfileCardHtml(data) {
    // showLink: false — the statLabel pill below ("View my SEA-V career
    // profile") is the only call-to-action printed on this card; the actual
    // sea-v.com/u/<username> URL is deliberately left off the image and only
    // travels via the share caption / clipboard-copy fallback in generate().
    return cardShell(
      `
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
            ? `<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:26px;padding:12px 26px;font-size:22px;font-weight:600;line-height:1;display:flex;align-items:center;justify-content:center;">${escapeHtml(data.statLabel)}</div>`
            : ""
        }
      </div>
    `,
      { showLink: false }
    );
  }

  // Real-coordinate mini map ------------------------------------------------
  // Passage share cards used to draw a purely decorative curve (two fixed
  // dots + a fixed-position arc) with no relation to where the passage
  // actually happened. This builds a real, to-scale mini map instead: the
  // departure/arrival country shapes (from the same world-atlas boundary
  // data js/navigation-map.js already uses for the live map's green
  // country highlight) plotted at their true positions, with the route
  // line and start/finish markers placed at the entry's real fromLat/
  // fromLng/toLat/toLng. Falls back to the old abstract curve (see
  // buildPassageCardHtml) whenever real coordinates or the boundary data
  // aren't available, so share never breaks.
  const WORLD_MAP_W = 2000;
  const WORLD_MAP_H = 1000;
  const MAP_VIEWPORT_ASPECT = 568 / 340; // matches the card's map block size

  function hasRealCoord(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return Number.isFinite(latNum) && Number.isFinite(lngNum) && !(latNum === 0 && lngNum === 0);
  }

  // Flat equirectangular projection -- good enough at share-card thumbnail
  // scale, and avoids Mercator's pole distortion for a tightly-cropped view.
  function projectLngLat(lng, lat) {
    return {
      x: ((Number(lng) + 180) / 360) * WORLD_MAP_W,
      y: ((90 - Number(lat)) / 180) * WORLD_MAP_H
    };
  }

  function ringToPathD(ring) {
    if (!Array.isArray(ring) || ring.length < 2) return "";
    return (
      ring
        .map(([lng, lat], i) => {
          const p = projectLngLat(lng, lat);
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  }

  function geometryToPathD(geometry) {
    if (!geometry) return "";
    const polys =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];
    // Outer ring only (no hole cut-outs) -- irrelevant at this small scale
    // and keeps the path data light for html2canvas to rasterize.
    return polys.map((poly) => (poly[0] ? ringToPathD(poly[0]) : "")).join(" ");
  }

  function findCountryPathD(geo, countryName) {
    if (!geo || !countryName) return "";
    const isoCodes = window.SeavNavigationPorts?.COUNTRY_ISO_NUMERIC || {};
    const id = isoCodes[countryName];
    if (!id) return "";
    const feature = (geo.features || []).find((f) => String(f.id) === String(id));
    return feature ? geometryToPathD(feature.geometry) : "";
  }

  // Crops/zooms to a set of real projected points, like the live map's
  // fitBounds -- generous padding so nearby coastline still shows, capped
  // at the whole world for passages that cross an ocean.
  function computeViewBoxForPoints(points, paddingFactor, minPad) {
    if (!points.length) return { x: 0, y: 0, w: WORLD_MAP_W, h: WORLD_MAP_H };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);

    let padX = Math.max(spanX * paddingFactor, minPad);
    let padY = Math.max(spanY * paddingFactor, minPad);
    let w = spanX + padX * 2;
    let h = spanY + padY * 2;

    if (w / h > MAP_VIEWPORT_ASPECT) {
      const newH = w / MAP_VIEWPORT_ASPECT;
      padY += (newH - h) / 2;
      h = newH;
    } else {
      const newW = h * MAP_VIEWPORT_ASPECT;
      padX += (newW - w) / 2;
      w = newW;
    }

    w = Math.min(w, WORLD_MAP_W);
    h = Math.min(h, WORLD_MAP_H);

    let x = minX - padX;
    let y = minY - padY;
    x = Math.max(Math.min(x, WORLD_MAP_W - w), -w * 0.1);
    y = Math.max(Math.min(y, WORLD_MAP_H - h), -h * 0.1);

    return { x, y, w, h };
  }

  function buildRouteCurveD(fromPt, toPt) {
    const midX = (fromPt.x + toPt.x) / 2;
    const midY = (fromPt.y + toPt.y) / 2;
    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const bow = Math.min(dist * 0.18, 140);
    const nx = -dy / dist;
    const ny = dx / dist;
    const cx = midX + nx * bow;
    const cy = midY + ny * bow;
    return `M${fromPt.x.toFixed(1)},${fromPt.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${toPt.x.toFixed(1)},${toPt.y.toFixed(1)}`;
  }

  function buildRoutePathD(points) {
    if (points.length < 2) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }

  // Bounding box of a feature's own geometry, projected, so it can be
  // cheaply tested against the crop viewport -- lets the map draw every
  // nearby landmass in view (not just the two highlighted countries), like
  // a real map screenshot, without paying to render all ~180 countries
  // worldwide on every card.
  function projectedFeatureBBox(geometry) {
    if (!geometry) return null;
    const polys =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    polys.forEach((poly) => {
      (poly[0] || []).forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });
    if (!Number.isFinite(minLng)) return null;
    const topLeft = projectLngLat(minLng, maxLat);
    const bottomRight = projectLngLat(maxLng, minLat);
    return { x1: topLeft.x, y1: topLeft.y, x2: bottomRight.x, y2: bottomRight.y };
  }

  function bboxIntersectsViewBox(bbox, viewBox) {
    if (!bbox) return false;
    return !(
      bbox.x2 < viewBox.x ||
      bbox.x1 > viewBox.x + viewBox.w ||
      bbox.y2 < viewBox.y ||
      bbox.y1 > viewBox.y + viewBox.h
    );
  }

  // Bright, real-map-style mini map: light land/ocean colors like an actual
  // chart screenshot (not a dark silhouette), every nearby country in view
  // (not just the two endpoints), the real routed track through any
  // waypoints (falls back to a simple curve if no route was passed), and
  // labelled start/finish/waypoint markers using the same colors as the
  // live navigation map (green start, red finish, amber waypoints).
  async function buildPassageMapSvg(entry, routeCoords) {
    if (!entry) return null;
    if (!hasRealCoord(entry.fromLat, entry.fromLng) || !hasRealCoord(entry.toLat, entry.toLng)) {
      return null;
    }

    const loadGeo = window.SeavNavigationMap?.loadWorldGeoJson;
    if (typeof loadGeo !== "function") return null;

    let geo = null;
    try {
      geo = await loadGeo();
    } catch {
      geo = null;
    }
    if (!geo) return null;

    const fromPt = projectLngLat(entry.fromLng, entry.fromLat);
    const toPt = projectLngLat(entry.toLng, entry.toLat);

    const hasRoute = Array.isArray(routeCoords) && routeCoords.length >= 2;
    const routePts = hasRoute
      ? routeCoords.map(([lat, lng]) => projectLngLat(lng, lat))
      : [fromPt, toPt];

    // Waypoints are every point in the route between the true start/end --
    // drawn as their own markers (see below) so the exact course logged
    // shows up, not just a straight departure-to-arrival guess.
    const waypointPts =
      Array.isArray(entry.waypoints) && entry.waypoints.length
        ? entry.waypoints
            .filter((wp) => hasRealCoord(wp?.lat, wp?.lng))
            .map((wp) => projectLngLat(wp.lng, wp.lat))
        : [];

    const viewBox = computeViewBoxForPoints(routePts.concat(waypointPts), 0.5, 70);

    let fromCountryD = "";
    let toCountryD = "";
    try {
      fromCountryD = findCountryPathD(geo, entry.fromCountry);
      toCountryD =
        entry.toCountry && entry.toCountry !== entry.fromCountry
          ? findCountryPathD(geo, entry.toCountry)
          : "";
    } catch {
      fromCountryD = "";
      toCountryD = "";
    }

    // Every other nearby landmass in the cropped view, so the card reads
    // like a real map screenshot instead of two shapes floating in empty
    // ocean. Kept as one combined path (not one <path> per country) so
    // html2canvas has far fewer elements to parse.
    let landD = "";
    try {
      landD = (geo.features || [])
        .map((feature) => {
          const bbox = projectedFeatureBBox(feature.geometry);
          if (!bboxIntersectsViewBox(bbox, viewBox)) return "";
          return geometryToPathD(feature.geometry);
        })
        .filter(Boolean)
        .join(" ");
    } catch {
      landD = "";
    }

    const routeD = hasRoute ? buildRoutePathD(routePts) : buildRouteCurveD(fromPt, toPt);
    const routeColor = window.SeavNavigationHelpers?.getVesselColor?.(entry.vesselId) || "#0f9c86";
    const markerR = Math.max(viewBox.w, viewBox.h) * 0.014;
    const waypointR = markerR * 0.65;
    const strokeUnit = viewBox.w * 0.0022;
    const vb = `${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.w.toFixed(1)} ${viewBox.h.toFixed(1)}`;

    const waypointDots = waypointPts
      .map(
        (p) =>
          `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${waypointR.toFixed(1)}" fill="#b45309" stroke="#ffffff" stroke-width="${(waypointR * 0.35).toFixed(1)}"></circle>`
      )
      .join("");

    // Labels get a light pill behind the text so they stay legible over
    // varied land/ocean colors -- width is an estimate (no canvas text
    // measurement available at build time), generous enough not to clip
    // typical port names.
    function labelGroup(point, label, anchor) {
      if (!label) return "";
      const text = escapeHtml(label);
      const fontSize = viewBox.w * 0.017;
      const estWidth = Math.max(label.length * fontSize * 0.56, fontSize * 2);
      const padX = fontSize * 0.5;
      const boxH = fontSize * 1.7;
      const boxY = point.y - markerR - boxH - fontSize * 0.3;
      const boxX = anchor === "end" ? point.x - estWidth - padX : point.x - padX * 0.5;
      return `
        <g>
          <rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${(estWidth + padX).toFixed(1)}" height="${boxH.toFixed(1)}" rx="${(boxH * 0.28).toFixed(1)}" fill="rgba(255,255,255,0.94)"></rect>
          <text x="${(boxX + (estWidth + padX) / 2).toFixed(1)}" y="${(boxY + boxH * 0.68).toFixed(1)}" fill="#0b1c2e" font-size="${fontSize.toFixed(1)}" font-weight="700" text-anchor="middle">${text}</text>
        </g>
      `;
    }

    return `
      <svg viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect x="${viewBox.x.toFixed(1)}" y="${viewBox.y.toFixed(1)}" width="${viewBox.w.toFixed(1)}" height="${viewBox.h.toFixed(1)}" fill="#bfe3f0"></rect>
        ${landD ? `<path d="${landD}" fill="#f4efe1" stroke="#c9c2ab" stroke-width="${strokeUnit.toFixed(2)}"></path>` : ""}
        ${fromCountryD ? `<path d="${fromCountryD}" fill="rgba(57,224,196,0.4)" stroke="#0f9c86" stroke-width="${(strokeUnit * 1.4).toFixed(2)}"></path>` : ""}
        ${toCountryD ? `<path d="${toCountryD}" fill="rgba(57,224,196,0.4)" stroke="#0f9c86" stroke-width="${(strokeUnit * 1.4).toFixed(2)}"></path>` : ""}
        <path d="${routeD}" fill="none" stroke="#ffffff" stroke-width="${(viewBox.w * 0.006).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="${routeD}" fill="none" stroke="${escapeHtml(routeColor)}" stroke-width="${(viewBox.w * 0.0032).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"></path>
        ${waypointDots}
        <circle cx="${fromPt.x.toFixed(1)}" cy="${fromPt.y.toFixed(1)}" r="${markerR.toFixed(1)}" fill="#15803d" stroke="#ffffff" stroke-width="${(markerR * 0.32).toFixed(1)}"></circle>
        <circle cx="${toPt.x.toFixed(1)}" cy="${toPt.y.toFixed(1)}" r="${markerR.toFixed(1)}" fill="#b91c1c" stroke="#ffffff" stroke-width="${(markerR * 0.32).toFixed(1)}"></circle>
        ${labelGroup(fromPt, entry.fromPort, "start")}
        ${labelGroup(toPt, entry.toPort, "end")}
      </svg>
    `;
  }

  function buildPassageCardHtml(data) {
    const mapBlock = data.mapSvg
      ? `<div style="width:100%;height:340px;border-radius:22px;overflow:hidden;border:1px solid rgba(57,224,196,0.3);">${data.mapSvg}</div>`
      : `
        <div style="display:flex;justify-content:center;">
          <svg width="460" height="220" viewBox="0 0 460 220" aria-hidden="true">
            <circle cx="50" cy="170" r="9" fill="var(--page-navigation,#39e0c4)"></circle>
            <circle cx="410" cy="46" r="9" fill="var(--page-navigation,#39e0c4)"></circle>
            <path d="M50 170 Q 230 20 410 46" fill="none" stroke="var(--page-navigation,#39e0c4)" stroke-width="3" stroke-dasharray="6 9"></path>
            <text x="14" y="204" fill="#ffffff" font-size="22" font-weight="600">${escapeHtml(data.fromLabel)}</text>
            <text x="270" y="30" fill="#ffffff" font-size="22" font-weight="600">${escapeHtml(data.toLabel)}</text>
          </svg>
        </div>
      `;

    const detailRows = [
      data.vesselName ? { label: "Vessel", value: data.vesselName } : null,
      data.routeText ? { label: "Route", value: data.routeText } : null,
      data.dateText ? { label: "Dates", value: data.dateText } : null
    ].filter(Boolean);

    return cardShell(`
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px;">
        ${mapBlock}
        <div style="text-align:center;">
          <p style="font-size:34px;font-weight:800;margin:0 0 8px;">${escapeHtml(data.title)}</p>
          <p style="font-size:20px;color:rgba(255,255,255,0.68);margin:0;">${escapeHtml(data.subtitle)}</p>
        </div>
        ${
          detailRows.length
            ? `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:16px 20px;display:flex;flex-direction:column;gap:10px;">
          ${detailRows
            .map(
              (row) => `
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:18px;">
              <span style="color:rgba(255,255,255,0.55);font-weight:600;">${escapeHtml(row.label)}</span>
              <span style="color:#ffffff;font-weight:700;text-align:right;">${escapeHtml(row.value)}</span>
            </div>`
            )
            .join("")}
        </div>`
            : ""
        }
        ${
          data.distanceLabel
            ? `<div style="align-self:center;background:rgba(57,224,196,0.16);border:1px solid rgba(57,224,196,0.4);border-radius:26px;padding:10px 26px;font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(data.distanceLabel)}</div>`
            : ""
        }
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

  async function sharePassage(entry, extra = {}) {
    if (!entry) return "error";

    const subtitleParts = [extra.vesselName, extra.dateText].filter(Boolean);
    const routeText = [
      [entry.fromPort, entry.fromCountry].filter(Boolean).join(", "),
      [entry.toPort, entry.toCountry].filter(Boolean).join(", ")
    ]
      .filter(Boolean)
      .join(" → ");

    let mapSvg = null;
    try {
      mapSvg = await buildPassageMapSvg(entry, extra.routeCoords);
    } catch (err) {
      // Real map is a nice-to-have on top of the always-working abstract
      // fallback in buildPassageCardHtml -- never let its failure block
      // sharing the passage entirely.
      console.warn("[SEA-V] Passage share mini map failed, using fallback card:", err);
      mapSvg = null;
    }

    return generate(
      buildPassageCardHtml,
      {
        title: entry.passageName || extra.routeLabel || "Passage logged",
        subtitle: subtitleParts.join(" · "),
        fromLabel: entry.fromPort || "Departure",
        toLabel: entry.toPort || "Arrival",
        distanceLabel: extra.distanceText || "",
        mapSvg,
        vesselName: extra.vesselName || "",
        routeText,
        dateText: extra.dateText || ""
      },
      `seav-passage-${entry.id || "route"}`,
      `Logged a new passage on SEA-V${extra.routeLabel ? `: ${extra.routeLabel}` : ""}.`
    );
  }

  async function shareProfile() {
    let profile = window.SeavState?.profile || {};
    const bucket = window.SeavApiCore?.STORAGE_BUCKETS?.PROFILE_PHOTOS || "profile-photos";

    // js/state.js hydrates profile.photo's signed URL in the background
    // after the dashboard loads (hydrateStoredFilesInBackground) — if Share
    // is clicked before that finishes, or a previously-signed URL has since
    // expired, profile.photo has no usable url yet and the card silently
    // fell back to the initials avatar instead of the real photo. Hydrate
    // it here, synchronously with the click, so the share card is never
    // missing the photo. Fetched into a local copy, not written back to
    // SeavState, to keep this a read-only side effect of sharing.
    if (
      window.SeavApiCore?.storedFileNeedsHydration?.(profile.photo, bucket) &&
      window.SeavApiCore?.hydrateProfilePhoto
    ) {
      profile = await window.SeavApiCore.hydrateProfilePhoto(profile);
    }

    const name = profile.name || "Seafarer";
    const subtitleParts = [profile.rank, profile.qualification].filter(Boolean);
    const imageSrc = window.Seav?.getFileDisplayUrl
      ? window.Seav.getFileDisplayUrl(profile.photo, bucket)
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
