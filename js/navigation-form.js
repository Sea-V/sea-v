// /js/navigation-form.js
(function () {
  "use strict";
  const H = window.SeavNavigationHelpers;
  const P = window.SeavNavigationPassage;
  const S = window.SeavNavigationState;
  const M = window.SeavNavigationMap;
  if (!H || !P || !S || !M || !window.Seav) return;

  const Seav = window.Seav;
  const {
    getPortList, getCountryList, roundCoord, getVessels, getSeatimes, getVesselName,
    normalizeText, findPort, lookupPortByName, normalizeWaypointList, normalizeNavEntry, hasCoord,
    getVesselColor
  } = H;
  const buildRecommendedPassageWaypoints = P.buildRecommendedPassageWaypoints;
  const buildRouteThroughAnchors = P.buildRouteThroughAnchors;
  const { formatDateRange } = M;

  function buildCountryOptions(selectedValue = "") {
    return getCountryList().map((country) => {
      const selected = country === selectedValue ? " selected" : "";
      return `<option value="${Seav.escapeHtml(country)}"${selected}>${Seav.escapeHtml(country)}</option>`;
    }).join("");
  }

  function buildPortOptions(country, selectedValue = "") {
    if (!country) {
      return `<option value="">Select country first</option>`;
    }

    const ports = getPortList().filter(
      (item) => normalizeText(item.country) === normalizeText(country)
    ).sort((a, b) => a.port.localeCompare(b.port));

    if (!ports.length) {
      return `<option value="">No ports listed for this country</option>`;
    }

    return (
      `<option value="">Select port / town</option>` +
      ports
        .map((item) => {
          const selected = item.port === selectedValue ? " selected" : "";
          return `<option value="${Seav.escapeHtml(item.port)}"${selected}>${Seav.escapeHtml(item.port)}</option>`;
        })
        .join("")
    );
  }

  function populateCountrySelect(selectEl, selectedValue = "") {
    if (!selectEl) return;

    const countries = getCountryList();
    if (!countries.length) {
      selectEl.innerHTML = `<option value="">Port list still loading…</option>`;
      selectEl.disabled = true;
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML =
      `<option value="">Select country</option>` + buildCountryOptions(selectedValue);
  }

  function populatePortSelect(portSelect, country, selectedValue = "") {
    if (!portSelect) return;

    if (!country) {
      portSelect.innerHTML = `<option value="">Select country first (optional)</option>`;
      portSelect.disabled = true;
      return;
    }

    portSelect.innerHTML = buildPortOptions(country, selectedValue);
    portSelect.disabled = false;
  }

  function wireRouteSelects(countrySelect, portSelect) {
    if (!countrySelect || !portSelect) return;

    countrySelect.addEventListener("change", () => {
      populatePortSelect(portSelect, countrySelect.value, "");
    });
  }

  function populateVesselOptions() {
    const formSelect = document.getElementById("navVessel");
    const filterSelect = document.getElementById("navMapVesselFilter");
    const vessels = window.SeavData?.getSortedVesselOptions?.(getVessels()) || [];

    if (formSelect) {
      const currentValue = formSelect.value || "";
      formSelect.innerHTML = `
        <option value="">Choose from your vessel list</option>
        ${vessels
          .map(
            (v) =>
              `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name || "Unnamed vessel")}</option>`
          )
          .join("")}
      `;
      if (currentValue) formSelect.value = currentValue;
    }

    if (filterSelect) {
      const currentFilter = filterSelect.value || "";
      filterSelect.innerHTML = `
        <option value="">All vessels</option>
        ${vessels
          .map(
            (v) =>
              `<option value="${Seav.escapeHtml(v.id)}">${Seav.escapeHtml(v.name || "Unnamed vessel")}</option>`
          )
          .join("")}
      `;
      filterSelect.value = currentFilter;
    }
  }

  function buildSeatimeLabel(entry) {
    const vesselName = getVesselName(entry.vesselId);
    const role = entry.capacityServed || "Sea time";
    const dates = formatDateRange(entry.dateJoined || "", entry.dateLeft || "") || "No dates";
    return `${vesselName} · ${role} · ${dates}`;
  }

  function populateSeatimeOptions(selectedValue = "") {
    const select = document.getElementById("navSeatime");
    if (!select) return;

    const selectedVesselId = document.getElementById("navVessel")?.value || "";
    const seatimes = [...getSeatimes()].sort((a, b) => {
      const da = a.dateJoined ? new Date(a.dateJoined) : new Date(0);
      const db = b.dateJoined ? new Date(b.dateJoined) : new Date(0);
      return db - da;
    }).filter((entry) => {
      if (!selectedVesselId) return true;
      return entry.vesselId === selectedVesselId || entry.id === selectedValue;
    });

    select.innerHTML = `
      <option value="">${selectedVesselId ? "No linked sea time entry" : "Choose a vessel first, or select any sea time entry"}</option>
      ${seatimes
        .map(
          (entry) =>
            `<option value="${Seav.escapeHtml(entry.id)}">${Seav.escapeHtml(buildSeatimeLabel(entry))}</option>`
        )
        .join("")}
    `;
    select.value = selectedValue || "";
  }

  function applySeatimeLink(seatimeId) {
    const entry = getSeatimes().find((item) => item.id === seatimeId);
    if (!entry) return;

    const vesselInput = document.getElementById("navVessel");
    if (vesselInput && entry.vesselId) vesselInput.value = entry.vesselId;
    populateSeatimeOptions(seatimeId);

    if (entry.dateJoined) Seav.setDateTriplet("navDepartureDate", entry.dateJoined);
    if (entry.dateLeft) Seav.setDateTriplet("navArrivalDate", entry.dateLeft);

    const passageNameInput = document.getElementById("navPassageName");
    if (passageNameInput && !passageNameInput.value.trim()) {
      passageNameInput.value = `${getVesselName(entry.vesselId)} passage plan`;
    }
  }

  function resetRouteForm() {
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");

    populateCountrySelect(fromCountry);
    populateCountrySelect(toCountry);
    populatePortSelect(fromPort, "");
    populatePortSelect(toPort, "");
  }

  function setNavFormMode(editing) {
    const heading = document.querySelector(".navigation-form-section h3");
    const submitBtn = document.getElementById("navSubmitBtn");
    const cancelBtn = document.getElementById("navCancelEditBtn");

    if (heading) {
      heading.textContent = editing ? "Edit passage" : "Log a passage";
    }
    if (submitBtn) {
      submitBtn.textContent = editing ? "Save changes" : "Add passage to chart";
    }
    if (cancelBtn) {
      cancelBtn.hidden = !editing;
    }
  }

  function prefillFromSeatimeParam() {
    const params = new URLSearchParams(window.location.search);
    const seatimeId = params.get("seatime") || params.get("seatimeId") || "";
    if (!seatimeId) return;

    const entry = getSeatimes().find((item) => item.id === seatimeId);
    if (!entry) {
      Seav.notify("info", "Sea time not found", "That sea time entry could not be linked.");
      return;
    }

    applySeatimeLink(seatimeId);
    document.querySelector(".navigation-form-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function getEndpointLocationInput(role) {
    return document.getElementById(role === "from" ? "navFromLocation" : "navToLocation");
  }

  function readEndpointDetails(role) {
    const countryEl = document.getElementById(role === "from" ? "navFromCountry" : "navToCountry");
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const manualEl = getEndpointLocationInput(role);

    const manualName = manualEl?.value.trim() || "";
    const country = countryEl?.value.trim() || "";
    const portFromList = portSelectEl?.value.trim() || "";
    const portName = manualName || portFromList;

    return { country, portName, portFromList, manualName };
  }

  function resolveEndpointCoord(role, details) {
    const coord = getFormEndpointCoord(role);
    if (coord) return coord;

    if (details?.portFromList && details?.country) {
      const found = findPort(details.country, details.portFromList);
      if (found) return { lat: found.lat, lng: found.lng };
    }

    const manual = details?.manualName || details?.portName || "";
    if (manual) {
      const found = lookupPortByName(manual, details?.country || "");
      if (found) return { lat: found.lat, lng: found.lng };
    }

    return null;
  }

  function syncLocationFromPort(role) {
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const manualEl = getEndpointLocationInput(role);
    const portFromList = portSelectEl?.value.trim() || "";
    if (portFromList && manualEl && !manualEl.value.trim()) {
      manualEl.value = portFromList;
    }
  }

  function cleanImportLabel(label) {
    const text = String(label || "").trim();
    if (!text) return "";
    if (/^RTZ waypoint \d+$/i.test(text)) return "";
    if (/^KML (waypoint|track point|point) \d+$/i.test(text)) return "";
    return text;
  }

  function defaultImportLocationName(point) {
    const cleaned = cleanImportLabel(point?.label);
    if (cleaned) return cleaned;
    if (!point) return "";
    return `${Number(point.lat).toFixed(4)}, ${Number(point.lng).toFixed(4)}`;
  }

  function splitImportedRoutePoints(points) {
    if (!points.length) {
      return { from: null, to: null, waypoints: [] };
    }
    if (points.length === 1) {
      return { from: points[0], to: { ...points[0] }, waypoints: [] };
    }

    return {
      from: points[0],
      to: points[points.length - 1],
      waypoints: points.length > 2 ? points.slice(1, -1) : []
    };
  }

  function applyImportedRoutePoints(points) {
    const { from, to, waypoints } = splitImportedRoutePoints(points);
    if (!from || !to) return false;

    S.formEndpointCoords.from = { lat: from.lat, lng: from.lng };
    S.formEndpointCoords.to = { lat: to.lat, lng: to.lng };
    S.formWaypoints = waypoints.map((wp) => ({
      lat: wp.lat,
      lng: wp.lng,
      label: cleanImportLabel(wp.label)
    }));

    const fromLocationInput = getEndpointLocationInput("from");
    const toLocationInput = getEndpointLocationInput("to");
    if (fromLocationInput) fromLocationInput.value = defaultImportLocationName(from);
    if (toLocationInput) toLocationInput.value = defaultImportLocationName(to);

    return true;
  }

  function getFormPortCoord(countryId, portId) {
    const country = document.getElementById(countryId)?.value.trim();
    const port = document.getElementById(portId)?.value.trim();
    if (!country || !port) return null;
    const found = findPort(country, port);
    return found ? { lat: found.lat, lng: found.lng } : null;
  }

  function getFormEndpointCoord(role) {
    const key = role === "from" ? "from" : "to";
    const selected =
      key === "from"
        ? getFormPortCoord("navFromCountry", "navFromPort")
        : getFormPortCoord("navToCountry", "navToPort");
    const adjusted = S.formEndpointCoords[key];

    if (adjusted && Number.isFinite(adjusted.lat) && Number.isFinite(adjusted.lng)) {
      return { lat: adjusted.lat, lng: adjusted.lng };
    }
    if (selected) return selected;

    const manual = getEndpointLocationInput(role)?.value.trim() || "";
    const country =
      document.getElementById(role === "from" ? "navFromCountry" : "navToCountry")?.value.trim() ||
      "";
    const found = lookupPortByName(manual, country);
    return found ? { lat: found.lat, lng: found.lng } : null;
  }

  function syncEndpointCoordsFromPorts() {
    ["from", "to"].forEach((role) => {
      const existing = S.formEndpointCoords[role];
      if (existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lng)) {
        return;
      }

      const coord = getFormPortCoord(
        role === "from" ? "navFromCountry" : "navToCountry",
        role === "from" ? "navFromPort" : "navToPort"
      );
      if (coord) {
        S.formEndpointCoords[role] = {
          lat: roundCoord(coord.lat),
          lng: roundCoord(coord.lng)
        };
      }
    });
    renderEndpointStatus();
    renderWorkingRoute();
  }

  function resetEndpointToPort(role) {
    const key = role === "from" ? "from" : "to";
    const coord =
      key === "from"
        ? getFormPortCoord("navFromCountry", "navFromPort")
        : getFormPortCoord("navToCountry", "navToPort");

    if (coord) {
      S.formEndpointCoords[key] = {
        lat: roundCoord(coord.lat),
        lng: roundCoord(coord.lng)
      };
    } else {
      S.formEndpointCoords[key] = null;
    }

    renderEndpointStatus();
    renderWorkingRoute();
  }

  function updateEndpointFromPort(role) {
    const portSelectEl = document.getElementById(role === "from" ? "navFromPort" : "navToPort");
    const portFromList = portSelectEl?.value.trim() || "";
    if (!portFromList) return;

    resetEndpointToPort(role);
  }

  function formatCoordLabel(coord) {
    if (!coord) return "No point selected.";
    return `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`;
  }

  function renderEndpointStatus() {
    const fromStatus = document.getElementById("navFromPointStatus");
    const toStatus = document.getElementById("navToPointStatus");
    const from = getFormEndpointCoord("from");
    const to = getFormEndpointCoord("to");

    if (fromStatus) {
      fromStatus.textContent = from
        ? `Green start (S): ${formatCoordLabel(from)}`
        : "Green start (S) — set from list, import, or pick on chart.";
    }
    if (toStatus) {
      toStatus.textContent = to
        ? `Red finish (F): ${formatCoordLabel(to)}`
        : "Red finish (F) — set from list, import, or pick on chart.";
    }
  }

  function buildEndpointMarker(role, coord) {
    return M.buildEndpointMarker(coord, role, {
      draggable: true,
      onDrag: (ll) => {
        S.formEndpointCoords[role] = {
          lat: roundCoord(ll.lat),
          lng: roundCoord(ll.lng)
        };
        renderEndpointStatus();
        renderWorkingRoute();
      }
    });
  }

  function renderWaypointList() {
    const list = document.getElementById("navWaypointList");
    const count = document.getElementById("navWaypointCount");
    if (count) count.textContent = String(S.formWaypoints.length);
    if (!list) return;

    if (!S.formWaypoints.length) {
      list.innerHTML =
        `<li class="navigation-waypoint-empty">No waypoints — the track routes automatically along sea lanes.</li>`;
      return;
    }

    list.innerHTML = S.formWaypoints
      .map((wp, index) => {
        return `
          <li class="navigation-waypoint-item">
            <span class="navigation-waypoint-index">${index + 1}</span>
            <span class="navigation-waypoint-coord">
              ${wp.label ? `<strong>${Seav.escapeHtml(wp.label)}</strong>` : ""}
              ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}
            </span>
            <span class="navigation-waypoint-buttons">
              <button type="button" data-wp-up="${index}" title="Move up"${index === 0 ? " disabled" : ""}>&uarr;</button>
              <button type="button" data-wp-down="${index}" title="Move down"${index === S.formWaypoints.length - 1 ? " disabled" : ""}>&darr;</button>
              <button type="button" data-wp-remove="${index}" title="Remove waypoint">&times;</button>
            </span>
          </li>
        `;
      })
      .join("");
  }

  async function renderWorkingRoute() {
    if (!S.map || !S.workingLayer) return;

    const token = (S.workingRouteToken += 1);
    S.workingLayer.clearLayers();

    const from = getFormEndpointCoord("from");
    const to = getFormEndpointCoord("to");

    if (from) S.workingLayer.addLayer(buildEndpointMarker("from", from));
    if (to) S.workingLayer.addLayer(buildEndpointMarker("to", to));
    renderEndpointStatus();

    S.formWaypoints.forEach((wp, index) => {
      const marker = M.buildWaypointMarker(wp, index, {
        draggable: true,
        onDrag: (ll) => {
          S.formWaypoints[index] = {
            ...S.formWaypoints[index],
            lat: roundCoord(ll.lat),
            lng: roundCoord(ll.lng)
          };
          renderWaypointList();
          renderWorkingRoute();
        }
      });

      S.workingLayer.addLayer(marker);
    });

    if (!from || !to) return;

    const vesselId = document.getElementById("navVessel")?.value || "";
    const trackColor = getVesselColor(vesselId);

    const route = await buildRouteThroughAnchors([
      from,
      ...S.formWaypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng })),
      to
    ]);

    if (token !== S.workingRouteToken) return;
    if (!route?.coords?.length || route.coords.length < 2) return;

    const previewLatLngs = route.coords.map((point) => [point[0], point[1]]);
    const previewStyle = {
      color: trackColor,
      weight: 3,
      opacity: 0.95,
      dashArray: "8 6",
      lineJoin: "round"
    };

    if (M.addWrappingPolylines) {
      M.addWrappingPolylines(S.workingLayer, previewLatLngs, previewStyle);
    } else {
      S.workingLayer.addLayer(L.polyline(previewLatLngs, previewStyle));
    }
  }

  function addWaypoint(lat, lng, label) {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      Seav.notify("error", "Invalid coordinates", "Enter numeric latitude and longitude.");
      return false;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      Seav.notify(
        "error",
        "Out of range",
        "Latitude must be between -90 and 90, longitude between -180 and 180."
      );
      return false;
    }

    S.formWaypoints.push({ lat: roundCoord(latNum), lng: roundCoord(lngNum), label: label || "" });
    renderWaypointList();
    renderWorkingRoute();
    return true;
  }

  function applyRecommendedPassage() {
    const fromCountry = document.getElementById("navFromCountry")?.value.trim() || "";
    const fromPort = document.getElementById("navFromPort")?.value.trim() || "";
    const toCountry = document.getElementById("navToCountry")?.value.trim() || "";
    const toPort = document.getElementById("navToPort")?.value.trim() || "";
    const fromSelected = findPort(fromCountry, fromPort);
    const toSelected = findPort(toCountry, toPort);

    if (!fromSelected || !toSelected) {
      Seav.notify(
        "error",
        "Choose ports first",
        "Select the departure and arrival ports before generating a recommended passage."
      );
      return;
    }

    const from = getFormEndpointCoord("from") || {
      lat: fromSelected.lat,
      lng: fromSelected.lng
    };
    const to = getFormEndpointCoord("to") || {
      lat: toSelected.lat,
      lng: toSelected.lng
    };
    const recommended = buildRecommendedPassageWaypoints(
      from,
      to,
      fromSelected,
      toSelected
    );

    if (!recommended.length) {
      Seav.notify(
        "info",
        "No template found",
        "No recommended passage template exists for that route yet. You can still add waypoints manually."
      );
      return;
    }

    S.formWaypoints = recommended.map((point) => ({
      lat: roundCoord(point.lat),
      lng: roundCoord(point.lng),
      label: point.label || "Recommended waypoint"
    }));
    const panel = document.getElementById("navWaypointsPanel");
    if (panel) panel.open = true;
    renderWaypointList();
    renderWorkingRoute();
    Seav.notify(
      "success",
      "Recommended passage added",
      `${recommended.length} waypoint${recommended.length === 1 ? "" : "s"} added from standard maritime corridors.`
    );
  }

  function getXmlElementsByLocalName(root, localName) {
    return Array.from(root.getElementsByTagName("*")).filter(
      (el) => el.localName === localName
    );
  }

  function parseXmlRouteDocument(text) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) {
      throw new Error("The route file is not valid XML.");
    }
    return xml;
  }

  function normalizeImportedPoints(points) {
    const normalized = [];
    points.forEach((point) => {
      const lat = roundCoord(point.lat);
      const lng = roundCoord(point.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const prev = normalized[normalized.length - 1];
      if (prev && prev.lat === lat && prev.lng === lng) return;

      normalized.push({
        lat,
        lng,
        label: point.label || ""
      });
    });
    return normalized;
  }

  function parseKmlCoordinateBlock(text, labelPrefix = "KML waypoint") {
    return String(text || "")
      .trim()
      .split(/\s+/)
      .map((token, index) => {
        const [lngRaw, latRaw] = token.split(",");
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        return {
          lat,
          lng,
          label: `${labelPrefix} ${index + 1}`
        };
      });
  }

  function parseKmlRoute(text) {
    const xml = parseXmlRouteDocument(text);
    const lineStrings = getXmlElementsByLocalName(xml, "LineString");
    const lineRoutes = lineStrings
      .map((line) => {
        const coords = getXmlElementsByLocalName(line, "coordinates")[0];
        return parseKmlCoordinateBlock(coords?.textContent || "");
      })
      .filter((points) => points.length);

    const tracks = getXmlElementsByLocalName(xml, "Track")
      .map((track) =>
        getXmlElementsByLocalName(track, "coord").map((coord, index) => {
          const [lngRaw, latRaw] = String(coord.textContent || "").trim().split(/\s+/);
          return {
            lat: Number(latRaw),
            lng: Number(lngRaw),
            label: `KML track point ${index + 1}`
          };
        })
      )
      .filter((points) => points.length);

    const candidateRoutes = [...lineRoutes, ...tracks].sort((a, b) => b.length - a.length);
    if (candidateRoutes.length) return normalizeImportedPoints(candidateRoutes[0]);

    const pointCoords = getXmlElementsByLocalName(xml, "Point")
      .flatMap((point, index) => {
        const coords = getXmlElementsByLocalName(point, "coordinates")[0];
        return parseKmlCoordinateBlock(coords?.textContent || "", `KML point ${index + 1}`);
      });
    return normalizeImportedPoints(pointCoords);
  }

  function getNumberAttr(el, names) {
    for (const name of names) {
      const value = Number(el?.getAttribute(name));
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  }

  function parseRtzRoute(text) {
    const xml = parseXmlRouteDocument(text);
    const waypoints = getXmlElementsByLocalName(xml, "waypoint").map((waypoint, index) => {
      const position = getXmlElementsByLocalName(waypoint, "position")[0] || waypoint;
      return {
        lat: getNumberAttr(position, ["lat", "latitude", "Latitude", "LAT"]),
        lng: getNumberAttr(position, ["lon", "lng", "long", "longitude", "Longitude", "LON"]),
        label:
          waypoint.getAttribute("name") ||
          waypoint.getAttribute("id") ||
          `RTZ waypoint ${index + 1}`
      };
    });
    return normalizeImportedPoints(waypoints);
  }

  async function importRouteFile(file) {
    if (!file) return;

    const name = String(file.name || "").toLowerCase();
    const text = await file.text();
    let points = [];

    if (name.endsWith(".rtz")) {
      points = parseRtzRoute(text);
    } else if (name.endsWith(".kml")) {
      points = parseKmlRoute(text);
    } else {
      try {
        points = parseRtzRoute(text);
      } catch {
        points = parseKmlRoute(text);
      }
      if (!points.length) points = parseKmlRoute(text);
    }

    if (!applyImportedRoutePoints(points)) {
      Seav.notify(
        "error",
        "No route points found",
        "The KML/RTZ file did not contain usable waypoint coordinates."
      );
      return;
    }

    const panel = document.getElementById("navWaypointsPanel");
    if (panel) panel.open = true;
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();

    const waypointCount = S.formWaypoints.length;
    Seav.notify(
      "success",
      "Route imported",
      waypointCount
        ? `Start (S) and finish (F) set, with ${waypointCount} numbered waypoint${waypointCount === 1 ? "" : "s"}. Add location names if needed.`
        : "Start (S) and finish (F) set from the imported route. Add location names if needed."
    );
  }

  function removeWaypoint(index) {
    if (index < 0 || index >= S.formWaypoints.length) return;
    S.formWaypoints.splice(index, 1);
    renderWaypointList();
    renderWorkingRoute();
  }

  function moveWaypoint(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= S.formWaypoints.length) return;
    const [item] = S.formWaypoints.splice(index, 1);
    S.formWaypoints.splice(target, 0, item);
    renderWaypointList();
    renderWorkingRoute();
  }

  function setEndpointPickMode(role) {
    S.endpointPickRole = role === "from" || role === "to" ? role : null;

    const fromBtn = document.getElementById("navPickFromBtn");
    const toBtn = document.getElementById("navPickToBtn");
    const container = document.getElementById("navMap");

    if (fromBtn) fromBtn.classList.toggle("is-active", S.endpointPickRole === "from");
    if (toBtn) toBtn.classList.toggle("is-active", S.endpointPickRole === "to");

    if (S.endpointPickRole) {
      S.pickMode = false;
      const pickBtn = document.getElementById("navPickOnMapBtn");
      if (pickBtn) {
        pickBtn.textContent = "Pick on chart";
        pickBtn.classList.remove("is-active");
      }
    }

    if (container) {
      container.classList.toggle("is-picking", S.pickMode || !!S.endpointPickRole);
    }
  }

  function setPickMode(on) {
    S.pickMode = !!on;
    if (S.pickMode) setEndpointPickMode(null);

    const btn = document.getElementById("navPickOnMapBtn");
    const container = document.getElementById("navMap");

    if (btn) {
      btn.textContent = S.pickMode ? "Click the chart… (cancel)" : "Pick on chart";
      btn.classList.toggle("is-active", S.pickMode);
    }
    if (container) {
      container.classList.toggle("is-picking", S.pickMode || !!S.endpointPickRole);
    }
  }

  function clearNavEditForm() {
    const form = document.getElementById("navForm");
    const editIdInput = document.getElementById("nav_edit_id");

    form?.reset();
    if (editIdInput) editIdInput.value = "";
    const passageNameInput = document.getElementById("navPassageName");
    if (passageNameInput) passageNameInput.value = "";
    populateSeatimeOptions("");
    Seav.clearDateTriplet("navDepartureDate");
    Seav.clearDateTriplet("navArrivalDate");
    resetRouteForm();
    S.formWaypoints = [];
    S.formEndpointCoords = { from: null, to: null };
    setPickMode(false);
    setEndpointPickMode(null);
    getEndpointLocationInput("from") && (getEndpointLocationInput("from").value = "");
    getEndpointLocationInput("to") && (getEndpointLocationInput("to").value = "");
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();
    setNavFormMode(false);
  }

  function fillNavForm(entry) {
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");
    const vesselInput = document.getElementById("navVessel");
    const operationTypeInput = document.getElementById("navOperationType");
    const noteInput = document.getElementById("navNote");
    const passageNameInput = document.getElementById("navPassageName");
    const seatimeInput = document.getElementById("navSeatime");
    const editIdInput = document.getElementById("nav_edit_id");
    const normalized = normalizeNavEntry(entry || {});

    if (editIdInput) editIdInput.value = normalized.id || "";
    if (passageNameInput) passageNameInput.value = normalized.passageName || "";
    populateSeatimeOptions(normalized.seatimeId || "");
    populateCountrySelect(fromCountry, normalized.fromCountry);
    populatePortSelect(fromPort, normalized.fromCountry, normalized.fromPort);
    populateCountrySelect(toCountry, normalized.toCountry);
    populatePortSelect(toPort, normalized.toCountry, normalized.toPort);

    const fromLocationInput = getEndpointLocationInput("from");
    const toLocationInput = getEndpointLocationInput("to");
    if (fromLocationInput) fromLocationInput.value = normalized.fromPort || "";
    if (toLocationInput) toLocationInput.value = normalized.toPort || "";

    if (vesselInput) vesselInput.value = normalized.vesselId || "";
    if (seatimeInput) seatimeInput.value = normalized.seatimeId || "";
    if (operationTypeInput) operationTypeInput.value = normalized.operationType || "";
    if (noteInput) noteInput.value = normalized.note || "";
    Seav.setDateTriplet("navDepartureDate", normalized.departureDate || "");
    Seav.setDateTriplet("navArrivalDate", normalized.arrivalDate || "");

    S.formWaypoints = normalizeWaypointList(normalized.waypoints).map((wp) => ({
      lat: roundCoord(wp.lat),
      lng: roundCoord(wp.lng),
      label: wp.label || ""
    }));
    S.formEndpointCoords = {
      from: hasCoord(normalized.fromLat, normalized.fromLng)
        ? { lat: roundCoord(normalized.fromLat), lng: roundCoord(normalized.fromLng) }
        : null,
      to: hasCoord(normalized.toLat, normalized.toLng)
        ? { lat: roundCoord(normalized.toLat), lng: roundCoord(normalized.toLng) }
        : null
    };
    if (!S.formEndpointCoords.from || !S.formEndpointCoords.to) {
      syncEndpointCoordsFromPorts();
    }
    setPickMode(false);
    setEndpointPickMode(null);
    renderEndpointStatus();
    renderWaypointList();
    renderWorkingRoute();
    setNavFormMode(true);

    document.querySelector(".navigation-form-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  window.SeavNavigationForm = {
    buildCountryOptions, buildPortOptions, populateCountrySelect, populatePortSelect,
    wireRouteSelects, populateVesselOptions, buildSeatimeLabel,
    populateSeatimeOptions, applySeatimeLink, resetRouteForm, setNavFormMode,
    prefillFromSeatimeParam, getEndpointLocationInput, readEndpointDetails,
    resolveEndpointCoord, syncLocationFromPort, syncEndpointCoordsFromPorts,
    resetEndpointToPort, updateEndpointFromPort,
    renderEndpointStatus, renderWaypointList,
    renderWorkingRoute, addWaypoint, applyRecommendedPassage, importRouteFile,
    removeWaypoint, moveWaypoint, setEndpointPickMode, setPickMode,
    clearNavEditForm, fillNavForm
  };
})();
