// /js/seav-vessel-finder.js
// "Find your yacht" on the vessel form (v609). Searches the shared yacht directory
// (docs/schema-vessel-directory.sql) and copies its facts into the form's EMPTY fields.
// Copied once: the crew member's record then stands on its own, so a later directory
// change never alters what they logged. Directory text goes in via textContent only.
(function () {
  "use strict";

  const FIELD_INPUTS = {
    name: "vs_name",
    flag: "vs_flag",
    gt: "vs_gt",
    vessel_length: "vs_length",
    builder: "vs_builder",
    imo: "vs_imo",
    mmsi: "vs_mmsi",
    official_number: "vs_official_number",
    call_sign: "vs_call_sign",
    year_built: "vs_year_built"
  };
  const NUMBER_ONLY = ["vessel_length", "year_built"];

  const el = (id) => document.getElementById(id);
  let results = [];
  let activeIndex = -1;
  let searchToken = 0;
  let debounce = null;

  function closeList() {
    const list = el("vsFinderList");
    const input = el("vs_directory_search");
    if (list) list.hidden = true;
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    activeIndex = -1;
  }

  function showLinkNote(text) {
    const note = el("vsFinderNote");
    const row = el("vsFinderLinked");
    const search = el("vsFinderSearchRow");
    if (note) note.textContent = text;
    if (row) row.hidden = false;
    if (search) search.hidden = true;
  }

  function setLink(directoryId) {
    const hidden = el("vs_directory_id");
    if (hidden) hidden.value = directoryId || "";
    const input = el("vs_directory_search");
    if (input) input.value = "";
    closeList();
    if (directoryId) {
      showLinkNote("Linked to the SEA-V yacht directory.");
    } else {
      const row = el("vsFinderLinked");
      const search = el("vsFinderSearchRow");
      if (row) row.hidden = true;
      if (search) search.hidden = false;
    }
  }

  function renderList(message) {
    const list = el("vsFinderList");
    const input = el("vs_directory_search");
    if (!list || !input) return;
    list.textContent = "";
    if (message) {
      const li = document.createElement("li");
      li.className = "vessel-finder-empty";
      li.textContent = message;
      list.appendChild(li);
    }
    results.forEach((entry, index) => {
      const li = document.createElement("li");
      li.className = "vessel-finder-option";
      li.id = `vsFinderOption${index}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(index === activeIndex));
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const meta = document.createElement("small");
      meta.textContent = [
        entry.imo ? `IMO ${entry.imo}` : entry.mmsi ? `MMSI ${entry.mmsi}` : "",
        entry.vessel_length ? `${entry.vessel_length} m` : "",
        entry.flag
      ].filter(Boolean).join(" · ");
      li.append(name, meta);
      li.addEventListener("mousedown", (event) => {
        event.preventDefault(); // Keep the input's focus until the choice lands.
        choose(entry);
      });
      list.appendChild(li);
    });
    list.hidden = !message && !results.length;
    input.setAttribute("aria-expanded", String(!list.hidden));
    if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `vsFinderOption${activeIndex}`);
    else input.removeAttribute("aria-activedescendant");
  }

  function choose(entry) {
    Object.entries(FIELD_INPUTS).forEach(([field, inputId]) => {
      const input = el(inputId);
      const value = String(entry[field] || "").trim();
      if (!input || !value || input.value.trim()) return;
      if (NUMBER_ONLY.includes(field) && Number.isNaN(Number(value))) return;
      input.value = value;
    });
    el("vs_directory_id").value = entry.id;
    el("vs_directory_search").value = "";
    closeList();
    showLinkNote(`Filled in from the SEA-V yacht directory: ${entry.name}. Please check the details, as a yacht can change after you served.`);
  }

  async function runSearch(query) {
    const token = ++searchToken;
    let found = [];
    try {
      found = await window.SeavAPI.searchVesselDirectory(query);
    } catch (err) {
      console.warn("[SEA-V] Yacht directory search failed:", err);
      if (token === searchToken) closeList();
      return;
    }
    if (token !== searchToken) return;
    results = found;
    activeIndex = -1;
    renderList(found.length ? "" : "Not in the directory yet. Add the details below as normal.");
  }

  function init() {
    const input = el("vs_directory_search");
    if (!input || input.dataset.wired) return;
    input.dataset.wired = "1";

    input.addEventListener("input", () => {
      window.clearTimeout(debounce);
      const query = input.value.trim();
      if (query.length < 2) {
        searchToken += 1;
        results = [];
        closeList();
        return;
      }
      debounce = window.setTimeout(() => runSearch(query), 250);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Enter here must never submit the vessel form.
        if (activeIndex >= 0 && results[activeIndex]) choose(results[activeIndex]);
      } else if (event.key === "Escape" && !el("vsFinderList").hidden) {
        event.stopPropagation(); // Close the list, not the whole modal.
        closeList();
      } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + step + results.length) % results.length;
        renderList("");
      }
    });

    input.addEventListener("blur", () => window.setTimeout(closeList, 120));

    el("vsFinderUnlink")?.addEventListener("click", () => setLink(""));
  }

  window.SeavVesselFinder = { init, setLink };
})();
