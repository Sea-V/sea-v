// /js/crew-101.js — the Crew 101 guide page. Content is in js/seav-crew-101.js.
(function () {
  "use strict";

  if (!window.Seav || !window.SeavCrew101) {
    console.warn("[SEA-V] Crew 101 dependencies missing.");
    return;
  }

  const C = window.SeavCrew101;
  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));
  const LINK_LABELS = { knots: "Watch", certs: "Find" };

  const head = (topic, extra = "") => `<div class="dash-panel-head">
      <span class="dash-panel-heading"><span class="dash-panel-icon" aria-hidden="true">${topic.icon}</span><h3 class="dash-panel-title">${esc(topic.title)}</h3></span>
      ${extra}
    </div>`;

  const external = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;

  function dataTable(topic) {
    const header = topic.columns
      .map((col, i) => `<th scope="col"${topic.linkColumn && i === topic.columns.length - 1 ? ' class="is-num"' : ""}><small>${esc(col)}</small></th>`)
      .join("");
    const rows = topic.rows
      .map((row) => {
        const cells = row.map((cell, i) =>
          topic.linkColumn && i === row.length - 1
            ? `<td class="is-num">${external(cell, LINK_LABELS[topic.id] || "Open")}</td>`
            : `<td>${esc(cell)}</td>`
        );
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("");
    const more = topic.more
      ? `<small class="dash-panel-note crew101-more">Read more: ${topic.more.map((m) => external(m.url, m.label)).join(" · ")}</small>`
      : "";
    return `<table class="dash-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>${more}`;
  }

  function regulationsTable() {
    const rows = C.regulationRows()
      .map(([source, url, name]) => `<tr><td>${esc(source)}</td><td>${external(url, name)}</td></tr>`)
      .join("");
    return `<table class="dash-table"><thead><tr><th scope="col"><small>Source</small></th><th scope="col"><small>Document</small></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function render() {
    const mount = document.getElementById("crew101Cards");
    if (!mount) return;
    const card = (topic) => {
      if (topic.id === "rules") return `<article class="dash-panel" id="rules">${head(topic)}${regulationsTable()}</article>`;
      return `<article class="dash-panel" id="${esc(topic.id)}">${head(topic)}${dataTable(topic)}</article>`;
    };
    const byId = (ids) => ids.map((id) => card(C.TOPICS.find((t) => t.id === id))).join("");
    mount.innerHTML = `<div class="crew101-col">${byId(["bring", "certs"])}</div>
      <div class="crew101-col">${byId(["knots", "deck", "etiquette", "rules"])}</div>`;

    document.getElementById("crew101Jump").innerHTML = C.TOPICS
      .map((topic) => `<a class="crew101-jump-link" href="#${esc(topic.id)}">${esc(topic.title)}</a>`)
      .join("");

    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }

  function init() {
    const mount = document.getElementById("crew101Cards");
    if (!mount) return;

    mount.addEventListener("click", (event) => {
      // Pressing a row presses its link, as on the dashboard.
      if (event.target.closest("a, button")) return;
      event.target.closest(".dash-table tbody tr")?.querySelector(":scope > td > a")?.click();
    });

    window.Seav.bindStateRefresh(render, { label: "Crew 101 refresh" });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
