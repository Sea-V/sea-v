// /js/navigation-list.js
(function () {
  "use strict";
  const H = window.SeavNavigationHelpers;
  const P = window.SeavNavigationPassage;
  const M = window.SeavNavigationMap;
  const F = window.SeavNavigationForm;
  const S = window.SeavNavigationState;
  if (!H || !P || !M || !F || !S || !window.Seav) return;

  const Seav = window.Seav;
  const {
    loadNavEntries, getVesselName, getVesselColor, getSeatimes, formatNm, formatRouteLabel, entryHasRoute
  } = H;
  const { formatDateRange } = M;
  const getEntryRoute = P.getEntryRoute;
  const buildSeatimeLabel = F.buildSeatimeLabel;

  async function buildDistanceMap(entries) {
    const distances = new Map();

    await Promise.all(
      entries.filter(entryHasRoute).map(async (entry) => {
        const route = await getEntryRoute(entry);
        if (route?.distanceNm) {
          distances.set(entry.id, route.distanceNm);
        }
      })
    );

    return distances;
  }

  function buildEntryRow(entry, distanceMap) {
    const vesselName = getVesselName(entry.vesselId);
    const distanceNm = distanceMap.get(entry.id);
    const distanceText = distanceNm ? formatNm(distanceNm) : "";
    const dateText =
      formatDateRange(
        entry.departureDate || entry.visitedDate || "",
        entry.arrivalDate || ""
      ) || "—";

    const routeLabel = formatRouteLabel(entry);
    const title = entry.passageName || routeLabel;
    const linkedSeatime = entry.seatimeId
      ? getSeatimes().find((item) => item.id === entry.seatimeId)
      : null;

    const vesselColor = getVesselColor(entry.vesselId);

    return `
      <div class="list-row navigation-log-row">
        <div class="navigation-log-main">
          <div class="list-title navigation-log-title">
            <span class="navigation-log-color" style="background:${Seav.escapeHtml(vesselColor)}"></span>
            ${Seav.escapeHtml(title)}
          </div>
          ${
            entry.passageName
              ? `<div class="list-sub navigation-log-route">${Seav.escapeHtml(routeLabel)}</div>`
              : ""
          }
          <div class="list-sub">
            ${Seav.escapeHtml(vesselName)} · ${Seav.escapeHtml(dateText)} · ${Seav.escapeHtml(entry.operationType || "—")}${entry.isTidal ? " · Tidal waters" : ""}
          </div>
          ${
            linkedSeatime
              ? `<div class="list-sub navigation-log-seatime">Linked sea time: ${Seav.escapeHtml(buildSeatimeLabel(linkedSeatime))}</div>`
              : ""
          }
          ${
            distanceText
              ? `<div class="navigation-log-leg">${Seav.escapeHtml(distanceText)}</div>`
              : ""
          }
          ${
            entry.note
              ? `<div class="list-sub navigation-log-note">${Seav.escapeHtml(entry.note)}</div>`
              : ""
          }
        </div>
        <div class="seav-actions seav-actions--inline">
          ${Seav.seavAction("secondary", "Share", `data-share-nav-id="${Seav.escapeHtml(entry.id)}"`)}
          ${Seav.seavAction("edit", "Edit", `data-edit-nav-id="${Seav.escapeHtml(entry.id)}"`)}
          ${Seav.seavAction("delete", "Delete", `data-del-nav-id="${Seav.escapeHtml(entry.id)}"`)}
        </div>
      </div>
    `;
  }

  function buildVesselGroups(entries, distanceMap) {
    const groups = new Map();

    entries.forEach((entry) => {
      const key = entry.vesselId || "";
      if (!groups.has(key)) {
        groups.set(key, {
          vesselId: key,
          vesselName: getVesselName(key),
          vesselColor: getVesselColor(key),
          entries: [],
          totalNm: 0,
          latest: 0
        });
      }
      const group = groups.get(key);
      group.entries.push(entry);
      group.totalNm += Number(distanceMap.get(entry.id) || 0);

      const sortDate = entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
      const time = sortDate ? new Date(sortDate).getTime() : 0;
      if (time > group.latest) group.latest = time;
    });

    return [...groups.values()].sort((a, b) => b.latest - a.latest);
  }

  async function renderNavEntriesList() {
    const list = document.getElementById("navEntriesList");
    if (!list) return;

    const entries = await loadNavEntries();

    if (!entries.length) {
      list.innerHTML = `
        <div class="list-row">
          <div>
            <div class="list-title">No passages logged yet</div>
            <div class="list-sub">Log your first departure and arrival above to start your world chart.</div>
          </div>
        </div>
      `;
      return;
    }

    const distanceMap = await buildDistanceMap(entries);
    const sortDate = (entry) =>
      entry.departureDate || entry.visitedDate || entry.arrivalDate || "";
    const sorted = [...entries].sort((a, b) => {
      const da = sortDate(a) ? new Date(sortDate(a)) : new Date(0);
      const db = sortDate(b) ? new Date(sortDate(b)) : new Date(0);
      return db - da;
    });

    const groups = buildVesselGroups(sorted, distanceMap);

    list.innerHTML = groups
      .map((group, index) => {
        const passageWord = group.entries.length === 1 ? "passage" : "passages";
        const totalNmText = group.totalNm ? formatNm(group.totalNm) : "";

        return `
          <details class="navigation-vessel-group"${index === 0 ? " open" : ""}>
            <summary class="navigation-vessel-group-summary">
              <span class="navigation-log-color" style="background:${Seav.escapeHtml(group.vesselColor)}"></span>
              <span class="navigation-vessel-group-title">
                <strong>${Seav.escapeHtml(group.vesselName)}</strong>
                <small>${group.entries.length} ${passageWord}${totalNmText ? ` · ${Seav.escapeHtml(totalNmText)}` : ""}</small>
              </span>
              <span class="navigation-vessel-group-count">${group.entries.length}</span>
            </summary>
            <div class="navigation-vessel-group-body">
              ${group.entries.map((entry) => buildEntryRow(entry, distanceMap)).join("")}
            </div>
          </details>
        `;
      })
      .join("");
  }


  window.SeavNavigationList = { buildDistanceMap, renderNavEntriesList };
})();
