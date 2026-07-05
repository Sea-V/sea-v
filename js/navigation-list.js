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
  const buildRouteForEntry = P.buildRouteForEntry;
  const buildSeatimeLabel = F.buildSeatimeLabel;

  async function buildDistanceMap(entries) {
    const distances = new Map();

    await Promise.all(
      entries.filter(entryHasRoute).map(async (entry) => {
        const route = await buildRouteForEntry(entry);
        if (route?.distanceNm) {
          distances.set(entry.id, route.distanceNm);
        }
      })
    );

    return distances;
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

    list.innerHTML = sorted
      .map((entry) => {
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
                ${Seav.escapeHtml(vesselName)} · ${Seav.escapeHtml(dateText)} · ${Seav.escapeHtml(entry.operationType || "—")}
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
              ${Seav.seavAction("edit", "Edit", `data-edit-nav-id="${Seav.escapeHtml(entry.id)}"`)}
              ${Seav.seavAction("delete", "Delete", `data-del-nav-id="${Seav.escapeHtml(entry.id)}"`)}
            </div>
          </div>
        `;
      })
      .join("");
  }


  window.SeavNavigationList = { buildDistanceMap, renderNavEntriesList };
})();
