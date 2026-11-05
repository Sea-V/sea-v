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
    vessel_type: "vs_type",
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

  // A search box with a results list under it, used by the vessel form and the
  // getting-started guide. Directory text goes in via textContent only.
  function attachYachtSearch({ input, list, onChoose, emptyMessage }) {
    let results = [];
    let activeIndex = -1;
    let searchToken = 0;
    let debounce = null;

    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }

    function choose(entry) {
      searchToken += 1;
      window.clearTimeout(debounce);
      close();
      onChoose(entry);
    }

    function renderList(message) {
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
        li.id = `${list.id}Option${index}`;
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
      if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `${list.id}Option${activeIndex}`);
      else input.removeAttribute("aria-activedescendant");
    }

    async function runSearch(query) {
      const token = ++searchToken;
      let found = [];
      try {
        found = await window.SeavAPI.searchVesselDirectory(query);
      } catch (err) {
        console.warn("[SEA-V] Yacht directory search failed:", err);
        if (token === searchToken) close();
        return;
      }
      if (token !== searchToken) return;
      results = found;
      activeIndex = -1;
      renderList(found.length ? "" : emptyMessage);
    }

    input.addEventListener("input", () => {
      window.clearTimeout(debounce);
      const query = input.value.trim();
      if (query.length < 2) {
        searchToken += 1;
        results = [];
        close();
        return;
      }
      debounce = window.setTimeout(() => runSearch(query), 250);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Enter here must never submit the form.
        if (activeIndex >= 0 && results[activeIndex]) choose(results[activeIndex]);
      } else if (event.key === "Escape" && !list.hidden) {
        event.stopPropagation(); // Close the list, not the whole modal.
        close();
      } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + step + results.length) % results.length;
        renderList("");
      }
    });

    input.addEventListener("blur", () => {
      // Cancel what is still on its way, or the list opens after they have moved on.
      searchToken += 1;
      window.clearTimeout(debounce);
      window.setTimeout(close, 120);
    });

    return { close };
  }

  /* ---------- The vessel form ---------- */
  let formSearch = null;

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
    formSearch?.close();
    if (directoryId) {
      showLinkNote("Linked to the SEA-V yacht directory.");
    } else {
      const row = el("vsFinderLinked");
      const search = el("vsFinderSearchRow");
      if (row) row.hidden = true;
      if (search) search.hidden = false;
    }
  }

  function chooseForForm(entry) {
    Object.entries(FIELD_INPUTS).forEach(([field, inputId]) => {
      const input = el(inputId);
      const value = String(entry[field] || "").trim();
      if (!input || !value || input.value.trim()) return;
      if (NUMBER_ONLY.includes(field) && Number.isNaN(Number(value))) return;
      input.value = value;
    });
    el("vs_directory_id").value = entry.id;
    el("vs_directory_search").value = "";
    showLinkNote(`Filled in from the SEA-V yacht directory: ${entry.name}. Please check the details, as a yacht can change after you served.`);
  }

  function init() {
    const input = el("vs_directory_search");
    if (!input || input.dataset.wired) return;
    input.dataset.wired = "1";
    formSearch = attachYachtSearch({
      input,
      list: el("vsFinderList"),
      onChoose: chooseForForm,
      emptyMessage: "Not in the directory yet. Add the details below as normal."
    });
    el("vsFinderUnlink")?.addEventListener("click", () => setLink(""));
  }

  /* ---------- A yacht's history (v610), opened from its card on the Vessels page ---------- */
  const HISTORY_LABELS = {
    name: "Name",
    imo: "IMO",
    mmsi: "MMSI",
    official_number: "Official number",
    flag: "Flag",
    call_sign: "Call sign",
    gt: "Gross tonnage",
    vessel_length: "Length",
    builder: "Builder",
    vessel_type: "Type",
    year_built: "Year built"
  };
  const HISTORY_SOURCES = { wikidata: "from Wikidata", crew: "from a crew record", admin: "reviewed by SEA-V" };

  function historyLine(row) {
    if (row.field === "added") return "Added to the directory";
    if (row.field === "former_name") return `Formerly named ${row.old_value}`;
    const label = HISTORY_LABELS[row.field] || row.field;
    return row.old_value ? `${label}: ${row.old_value} → ${row.new_value || "removed"}` : `${label} added: ${row.new_value}`;
  }

  async function fillHistory(details) {
    const body = details.querySelector(".vessel-yacht-history-body");
    if (!body || details.dataset.loaded) return;
    details.dataset.loaded = "1";
    let rows;
    try {
      rows = await window.SeavAPI.fetchVesselDirectoryHistory(details.getAttribute("data-yacht-history"));
    } catch (err) {
      console.warn("[SEA-V] Yacht history failed:", err);
      delete details.dataset.loaded;
      body.textContent = "Couldn't load the history. Close this and try again.";
      return;
    }
    body.textContent = "";
    rows.forEach((row) => {
      const line = document.createElement("div");
      line.className = "vessel-yacht-history-row";
      const what = document.createElement("strong");
      what.textContent = historyLine(row);
      const meta = document.createElement("small");
      const date = new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      meta.textContent = `${date} · ${HISTORY_SOURCES[row.source] || row.source}`;
      line.append(what, meta);
      body.appendChild(line);
    });
    if (!rows.length) body.textContent = "Nothing recorded yet.";
  }

  // 'toggle' does not bubble, hence capture. Cards are rendered lazily, so this is delegated.
  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (details?.matches?.("[data-yacht-history]") && details.open) fillHistory(details);
  }, true);

  window.SeavVesselFinder = { init, setLink, attachYachtSearch };
})();
