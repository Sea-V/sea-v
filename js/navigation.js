// /js/navigation.js — page init & wiring
(function () {
  "use strict";
  if (!window.Seav || !window.SeavAPI || !window.SeavState || !window.SeavData) {
    console.warn("[SEA-V] Navigation dependencies missing.");
    return;
  }
  const H = window.SeavNavigationHelpers;
  const M = window.SeavNavigationMap;
  const F = window.SeavNavigationForm;
  const L = window.SeavNavigationList;
  const S = window.SeavNavigationState;
  if (!H || !M || !F || !L || !S) {
    console.warn("[SEA-V] Navigation module load incomplete.", {
      helpers: !!H,
      map: !!M,
      form: !!F,
      list: !!L,
      state: !!S
    });
    return;
  }

  const STORAGE_KEY = H.STORAGE_KEY;
  const loadNavEntries = H.loadNavEntries;
  const refreshMap = () => M.refreshMap();
  const renderNavEntriesList = () => L.renderNavEntriesList();
  const initNavigationMap = () => M.initNavigationMap();
  const clearNavEditForm = () => F.clearNavEditForm();
  const fillNavForm = (e) => F.fillNavForm(e);
  const populateVesselOptions = () => F.populateVesselOptions();
  const populateSeatimeOptions = () => F.populateSeatimeOptions();
  const resetRouteForm = () => F.resetRouteForm();
  const prefillFromSeatimeParam = () => F.prefillFromSeatimeParam();
  const populateCountrySelect = F.populateCountrySelect;
  const populatePortSelect = F.populatePortSelect;
  const wireRouteSelects = F.wireRouteSelects;
  const renderWorkingRoute = () => F.renderWorkingRoute();
  const importRouteFile = (f) => F.importRouteFile(f);
  const applyRecommendedPassage = () => F.applyRecommendedPassage();
  const setPickMode = (v) => F.setPickMode(v);
  const setEndpointPickMode = (v) => F.setEndpointPickMode(v);
  const addWaypoint = (...a) => F.addWaypoint(...a);
  const removeWaypoint = (...a) => F.removeWaypoint(...a);
  const moveWaypoint = (...a) => F.moveWaypoint(...a);
  const renderWaypointList = () => F.renderWaypointList();
  const renderEndpointStatus = () => F.renderEndpointStatus();
  const syncLocationFromPort = (r) => F.syncLocationFromPort(r);
  const updateEndpointFromPort = (r) => F.updateEndpointFromPort(r);
  const resetEndpointToPort = (r) => F.resetEndpointToPort(r);
  const applySeatimeLink = (id) => F.applySeatimeLink(id);
  const setNavFormMode = (v) => F.setNavFormMode(v);
  const readEndpointDetails = F.readEndpointDetails;
  const resolveEndpointCoord = F.resolveEndpointCoord;
  const getEndpointLocationInput = F.getEndpointLocationInput;
  const normalizeText = H.normalizeText;
  const formatRouteLabel = H.formatRouteLabel;
  const formatNm = H.formatNm;
  const getVesselName = H.getVesselName;
  const getSeatimes = H.getSeatimes;
  const normalizeNavEntry = H.normalizeNavEntry;
  const Seav = window.Seav;

  function initForm() {
    const form = document.getElementById("navForm");
    const fromCountry = document.getElementById("navFromCountry");
    const fromPort = document.getElementById("navFromPort");
    const toCountry = document.getElementById("navToCountry");
    const toPort = document.getElementById("navToPort");
    const vesselInput = document.getElementById("navVessel");
    const operationTypeInput = document.getElementById("navOperationType");
    const noteInput = document.getElementById("navNote");
    const filterSelect = document.getElementById("navMapVesselFilter");

    const cancelEditBtn = document.getElementById("navCancelEditBtn");

    if (!form || !fromCountry || !fromPort || !toCountry || !toPort) return;

    clearNavEditForm();
    populateVesselOptions();
    populateSeatimeOptions();
    wireRouteSelects(fromCountry, fromPort);
    wireRouteSelects(toCountry, toPort);

    fromCountry.addEventListener("change", () => {
      syncLocationFromPort("from");
      renderWorkingRoute();
    });
    fromPort.addEventListener("change", () => {
      syncLocationFromPort("from");
      updateEndpointFromPort("from");
    });
    toCountry.addEventListener("change", () => {
      syncLocationFromPort("to");
      renderWorkingRoute();
    });
    toPort.addEventListener("change", () => {
      syncLocationFromPort("to");
      updateEndpointFromPort("to");
    });

    getEndpointLocationInput("from")?.addEventListener("input", () => {
      renderEndpointStatus();
      renderWorkingRoute();
    });
    getEndpointLocationInput("to")?.addEventListener("input", () => {
      renderEndpointStatus();
      renderWorkingRoute();
    });

    if (!H.getCountryList().length) {
      window.setTimeout(() => {
        resetRouteForm();
      }, 150);
    }

    filterSelect?.addEventListener("change", async () => {
      S.activeVesselFilter = filterSelect.value || "";
      await refreshMap();
    });

    vesselInput?.addEventListener("change", () => {
      populateSeatimeOptions();
    });

    document.getElementById("navSeatime")?.addEventListener("change", (event) => {
      applySeatimeLink(event.currentTarget.value || "");
    });

    cancelEditBtn?.addEventListener("click", () => {
      clearNavEditForm();
      populateVesselOptions();
    });

    document.getElementById("navResetFromPointBtn")?.addEventListener("click", () => {
      resetEndpointToPort("from");
    });

    document.getElementById("navResetToPointBtn")?.addEventListener("click", () => {
      resetEndpointToPort("to");
    });

    document.getElementById("navPickFromBtn")?.addEventListener("click", () => {
      setEndpointPickMode(S.endpointPickRole === "from" ? null : "from");
    });

    document.getElementById("navPickToBtn")?.addEventListener("click", () => {
      setEndpointPickMode(S.endpointPickRole === "to" ? null : "to");
    });

    document.getElementById("navPickOnMapBtn")?.addEventListener("click", () => {
      setPickMode(!S.pickMode);
    });

    document.getElementById("navRecommendPassageBtn")?.addEventListener("click", () => {
      applyRecommendedPassage();
    });

    document.getElementById("navRouteFile")?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input?.files?.[0];
      try {
        await importRouteFile(file);
      } catch (error) {
        console.error("[SEA-V] Route import failed:", error);
        Seav.notify(
          "error",
          "Import failed",
          error?.message || "The KML/RTZ route could not be imported."
        );
      } finally {
        if (input) input.value = "";
      }
    });

    document.getElementById("navAddWaypointBtn")?.addEventListener("click", () => {
      const latEl = document.getElementById("navWaypointLat");
      const lngEl = document.getElementById("navWaypointLng");
      if (addWaypoint(latEl?.value, lngEl?.value)) {
        if (latEl) latEl.value = "";
        if (lngEl) lngEl.value = "";
      }
    });

    document.getElementById("navWaypointList")?.addEventListener("click", (event) => {
      const up = event.target.closest("[data-wp-up]");
      const down = event.target.closest("[data-wp-down]");
      const remove = event.target.closest("[data-wp-remove]");

      if (up) moveWaypoint(Number(up.getAttribute("data-wp-up")), -1);
      else if (down) moveWaypoint(Number(down.getAttribute("data-wp-down")), 1);
      else if (remove) removeWaypoint(Number(remove.getAttribute("data-wp-remove")));
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const editId = document.getElementById("nav_edit_id")?.value.trim() || "";
      const fromDetails = readEndpointDetails("from");
      const toDetails = readEndpointDetails("to");
      const vesselId = vesselInput?.value || "";
      const seatimeId = document.getElementById("navSeatime")?.value || "";
      const departureDate = Seav.readDateTriplet("navDepartureDate");
      const arrivalDate = Seav.readDateTriplet("navArrivalDate");
      const visitedDate = departureDate || arrivalDate;
      const operationType = operationTypeInput?.value || "";
      const note = noteInput?.value.trim() || "";
      const passageName =
        document.getElementById("navPassageName")?.value.trim() || "";

      if (!fromDetails.portName || !toDetails.portName) {
        Seav.notify(
          "error",
          "Missing locations",
          "Enter a departure and arrival location, or pick them from the port lists."
        );
        return;
      }

      const fromChartCoord = resolveEndpointCoord("from", fromDetails);
      const toChartCoord = resolveEndpointCoord("to", toDetails);

      if (!fromChartCoord || !toChartCoord) {
        Seav.notify(
          "error",
          "Missing chart points",
          "Set start and finish positions by importing RTZ/KML, picking on the chart, or choosing ports from the list."
        );
        return;
      }

      if (departureDate && arrivalDate && new Date(arrivalDate) < new Date(departureDate)) {
        Seav.notify(
          "error",
          "Check the dates",
          "Arrival date cannot be before the departure date."
        );
        return;
      }

      const entries = await loadNavEntries();
      const exists = entries.some(
        (entry) =>
          entry.id !== editId &&
          normalizeText(entry.fromPort) === normalizeText(fromDetails.portName) &&
          normalizeText(entry.toPort) === normalizeText(toDetails.portName) &&
          normalizeText(entry.fromCountry || "") === normalizeText(fromDetails.country || "") &&
          normalizeText(entry.toCountry || "") === normalizeText(toDetails.country || "") &&
          entry.vesselId === vesselId &&
          (entry.departureDate || entry.visitedDate || "") === (departureDate || "") &&
          (entry.arrivalDate || "") === (arrivalDate || "")
      );

      if (exists) {
        Seav.notify("info", "Already logged", "This passage is already on your chart.");
        return;
      }

      try {
        await Seav.withSaving(async () => {
        const existing = editId ? entries.find((entry) => entry.id === editId) || null : null;
        const payload = {
          id: editId || window.SeavData.createId("nav"),
          fromCountry: fromDetails.country,
          fromPort: fromDetails.portName,
          fromLat: fromChartCoord.lat,
          fromLng: fromChartCoord.lng,
          toCountry: toDetails.country,
          toPort: toDetails.portName,
          toLat: toChartCoord.lat,
          toLng: toChartCoord.lng,
          country: toDetails.country,
          port: toDetails.portName,
          lat: toChartCoord.lat,
          lng: toChartCoord.lng,
          vesselId,
          seatimeId,
          operationType,
          passageName,
          visitedDate,
          departureDate,
          arrivalDate,
          note,
          waypoints: S.formWaypoints.map((wp) => ({
            lat: wp.lat,
            lng: wp.lng,
            label: wp.label || ""
          }))
        };

        if (editId) {
          await SeavAPI.updateItemById(STORAGE_KEY, editId, {
            ...existing,
            ...payload,
            id: editId
          });
        } else {
          await SeavAPI.addItem(STORAGE_KEY, payload);
        }

        clearNavEditForm();
        populateVesselOptions();
        populateSeatimeOptions();

        if (window.SeavState?.refresh) {
          await window.SeavState.refresh();
        }

        await refreshMap();
        await renderNavEntriesList();

        Seav.notify(
          "success",
          editId ? "Passage updated" : "Passage logged",
          `${fromDetails.portName} → ${toDetails.portName} ${editId ? "updated on" : "added to"} your chart.`
        );

        if (window.Seav.app?.refreshAll) {
          await window.Seav.app.refreshAll();
        }
        }, { sub: editId ? "Updating navigation passage" : "Logging navigation passage" });
      } catch (error) {
        console.error("[SEA-V] Navigation passage save failed:", error);
        const raw =
          error?.message ||
          error?.error_description ||
          error?.hint ||
          "";
        const detail =
          /seatime_id/i.test(raw) && /column/i.test(raw)
            ? "Your database is missing the navigation_areas.seatime_id column. Run docs/navigation-complete-migration.sql in the Supabase SQL Editor, then try again."
            : raw || "The passage could not be saved. Check your connection and database columns.";
        Seav.notify("error", "Save failed", detail);
      }
    });

    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-nav-id]");
      if (editBtn) {
        e.preventDefault();

        const id = editBtn.getAttribute("data-edit-nav-id");
        const entries = await loadNavEntries();
        const entry = entries.find((item) => item.id === id);

        if (!entry) {
          Seav.notify("error", "Not found", "That passage could not be loaded.");
          return;
        }

        fillNavForm(entry);
        return;
      }

      const delBtn = e.target.closest("[data-del-nav-id]");
      if (!delBtn) return;

      e.preventDefault();

      const id = delBtn.getAttribute("data-del-nav-id");
      const entry = normalizeNavEntry(
        (window.SeavState?.navigationAreas || []).find((item) => item.id === id) || {}
      );
      const routeLabel = formatRouteLabel(entry);

      if (
        !Seav.confirmDelete({
          itemName: routeLabel,
          itemLabel: "navigation passage"
        })
      ) {
        return;
      }

      await SeavAPI.deleteItemById(STORAGE_KEY, id);

      if (document.getElementById("nav_edit_id")?.value.trim() === id) {
        clearNavEditForm();
        populateVesselOptions();
      }

      await refreshMap();
      await renderNavEntriesList();

      if (window.Seav.app?.refreshAll) {
        await window.Seav.app.refreshAll();
      }
    });
  }

  async function initNavigationData() {
    populateVesselOptions();
    populateSeatimeOptions();
    prefillFromSeatimeParam();
    await refreshMap();
    await renderNavEntriesList();
  }

  async function initNavigationPage() {
    try {
      initForm();
    } catch (error) {
      console.warn("[SEA-V] Navigation form init failed:", error);
    }

    try {
      initNavigationMap();
    } catch (error) {
      console.warn("[SEA-V] Map init failed:", error);
    }

    if (window.SeavState?.ready) {
      window.setTimeout(() => {
        if (S.map) S.map.invalidateSize();
      }, 150);
      await initNavigationData();
      return;
    }

    document.addEventListener(
      "seav:state-ready",
      () => {
        window.setTimeout(() => {
          if (S.map) S.map.invalidateSize();
        }, 150);
        initNavigationData().catch((error) => {
          console.warn("[SEA-V] Navigation refresh failed:", error);
        });
      },
      { once: true }
    );
  }

  document.addEventListener("seav:schema-warning", (event) => {
    const message = event.detail?.message;
    if (!message) return;
    Seav.notify("warning", "Database update needed", message);
  });

  document.addEventListener("DOMContentLoaded", () => {
    initNavigationPage();
  });

  document.addEventListener("seav:data-updated", async () => {
    populateVesselOptions();
    populateSeatimeOptions(document.getElementById("navSeatime")?.value || "");
    await refreshMap();
    await renderNavEntriesList();
  });



})();
