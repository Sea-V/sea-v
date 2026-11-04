// /js/dashboard-home.js
// The home page and the first-run setup (v601). What to say comes from
// js/seav-home-logic.js; opening the real Add forms comes from js/dashboard.js
// (SeavDashboard.openAdd). All crew-typed text goes through Seav.escapeHtml.
(function () {
  "use strict";

  const esc = (value) => window.Seav.escapeHtml(String(value ?? ""));
  const el = (id) => document.getElementById(id);
  const Logic = () => window.SeavHomeLogic;
  const state = () => window.SeavState || {};
  const TICK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function photoUrl(file, bucketKey, fallback) {
    return window.Seav.getFileDisplayUrl?.(file, window.SeavApiCore?.STORAGE_BUCKETS?.[bucketKey] || fallback) || file?.url || "";
  }

  function monthYear(dateText) {
    const parse = window.SeavData?.parseDateOnly;
    const date = dateText && parse ? parse(dateText) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : "";
  }

  /* ---------- The CV card: a summary on paper, always in view ---------- */
  function cvCardHtml({ name, rank, photo, yachts, certs, about }) {
    const lines = (rows, emptyText) => rows.length
      ? rows.map(([title, sub]) => `<strong class="home-cv-line">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</strong>`).join("")
      : `<small class="home-cv-empty">${esc(emptyText)}</small>`;
    return `
      <div class="home-cv" aria-label="Your CV summary">
        <div class="home-cv-top">
          ${photo ? `<img class="home-cv-photo" src="${esc(photo)}" alt="" />` : `<div class="home-cv-photo"><small>Add photo</small></div>`}
          <div class="home-cv-who">
            <strong class="home-cv-name">${esc(name || "Your name")}</strong>
            <small class="home-cv-role">${esc(rank || "Your role")}</small>
          </div>
        </div>
        <div class="home-cv-body">
          <strong class="home-cv-heading">Yachting experience</strong>
          ${lines(yachts, "Your yachts will show here")}
          <strong class="home-cv-heading">Certificates</strong>
          ${lines(certs, "Your certificates will show here")}
          <strong class="home-cv-heading">About me</strong>
          ${about ? `<small class="home-cv-about">${esc(about)}</small>` : `<small class="home-cv-empty">A line or two about you</small>`}
        </div>
      </div>`;
  }

  function moreRow(total, shown, noun) {
    return total > shown ? [[`+ ${total - shown} more ${noun}`, ""]] : [];
  }

  function yachtRows(vessels) {
    const sorted = [...vessels].sort((a, b) => String(b.from || "").localeCompare(String(a.from || "")));
    const rows = sorted.slice(0, 2).map((v) => {
      const dates = [monthYear(v.from), v.to ? monthYear(v.to) : (v.from ? "present" : "")].filter(Boolean).join(" – ");
      return [v.name || "Unnamed vessel", [v.vessel_role || v.role, dates].filter(Boolean).join(" · ")];
    });
    return rows.concat(moreRow(sorted.length, 2, sorted.length === 3 ? "yacht" : "yachts"));
  }

  function certRows(certs) {
    const rows = certs.slice(0, 3).map((c) => [c.name, c.expiry ? `to ${monthYear(c.expiry)}` : ""]);
    return rows.concat(moreRow(certs.length, 3, "certificates"));
  }

  /* ---------- Home ---------- */
  let milesToken = 0;

  function runAction(action) {
    if (action?.href) {
      window.location.href = action.href;
    } else if (action?.add) {
      window.SeavDashboard?.openAdd?.(action.add, action.vessel ? { vessel: action.vessel } : {});
    }
  }

  function renderNext(next) {
    const box = el("homeNext");
    if (!box) return;
    if (!next) {
      box.innerHTML = `
        <strong class="home-card-title">Your next step</strong>
        <strong class="home-next-title">You are all up to date</strong>
        <p class="home-text">We'll let you know here when something needs doing.</p>`;
      return;
    }
    box.innerHTML = `
      <strong class="home-card-title">Your next step</strong>
      <strong class="home-next-title">${esc(next.title)}</strong>
      <p class="home-text">${esc(next.text)}</p>
      ${next.more ? `<details class="home-more"><summary>${esc(next.more.label)}</summary><p class="home-text">${esc(next.more.text)}</p></details>` : ""}
      <div class="home-actions"><button type="button" class="btn-blue" id="homeNextBtn">${esc(next.cta)}</button></div>`;
    el("homeNextBtn").addEventListener("click", () => runAction(next.action));
  }

  function renderChecklist(readiness, next) {
    const box = el("homeChecklist");
    if (!box) return;
    box.hidden = readiness.complete;
    if (readiness.complete) return;

    // Done items encourage at the very start; after that the list only shrinks.
    const rows = readiness.items.filter((item) => !item.done || readiness.percent <= 40);
    const nextKey = { "first-cert": "cert", "first-yacht": "experience", photo: "photo", about: "about" }[next?.key];
    box.innerHTML = `
      <strong class="home-card-title">To finish your CV</strong>
      <ul class="home-list">
        ${rows.map((item) => `
          <li class="${item.done ? "is-done" : ""}">
            <span class="home-tick" aria-hidden="true">${TICK}</span>
            <strong class="home-list-text">${esc(item.label)}</strong>
            ${!item.done && item.action && item.key !== nextKey ? `<button type="button" class="home-link" data-check="${item.key}">${esc(item.verb)}</button>` : ""}
          </li>`).join("")}
      </ul>`;
    box.querySelectorAll("[data-check]").forEach((button) => {
      button.addEventListener("click", () => {
        runAction(readiness.items.find((item) => item.key === button.getAttribute("data-check"))?.action);
      });
    });
  }

  function tileHtml(href, label, number, unit, id) {
    return `<a class="home-tile" href="${href}"${id ? ` id="${id}"` : ""}>
      <strong class="home-card-title">${esc(label)}</strong>
      <div class="home-tile-num">${esc(number)}${unit ? ` <small>${esc(unit)}</small>` : ""}</div></a>`;
  }

  async function renderTiles(s) {
    const box = el("homeTiles");
    if (!box) return;
    const tiles = [];
    const total = window.SeavData.getSeatimeTotals(s.seatimes || []).total;
    if (total > 0) tiles.push(tileHtml("seatime.html", "Sea time", total.toLocaleString("en-GB"), "days"));
    const passages = s.navigationAreas || [];
    if (passages.length) tiles.push(tileHtml("navigation.html", "Miles", "…", "NM", "homeMilesTile"));
    const certs = Logic().heldCerts(s).length;
    if (certs) tiles.push(tileHtml("certificates.html", "Certificates", String(certs)));
    if ((s.vessels || []).length) tiles.push(tileHtml("vessels.html", "Yachts", String(s.vessels.length)));
    box.innerHTML = tiles.join("");
    box.hidden = !tiles.length;

    if (!passages.length) return;
    const token = ++milesToken;
    const distance = await window.SeavNavigationPassage?.getEntriesDistance?.(passages);
    if (token !== milesToken) return;
    const num = el("homeMilesTile")?.querySelector(".home-tile-num");
    if (num && distance) num.innerHTML = `${esc(Math.round(distance.nm).toLocaleString("en-GB"))} <small>NM</small>`;
  }

  function renderYacht(vessel) {
    const box = el("homeYacht");
    if (!box) return;
    const url = vessel ? photoUrl(vessel.photo, "VESSEL_PHOTOS", "vessel-photos") : "";
    box.hidden = !url;
    if (!url) return;
    const isCurrent = window.SeavData.isVesselOpenEnded?.(vessel);
    const length = String(vessel.vessel_length || vessel.length || "").trim();
    const lengthText = /^[\d.,]+$/.test(length) ? `${length} m` : length;
    const meta = [isCurrent ? "Current yacht" : "Latest yacht", lengthText, vessel.flag].filter(Boolean).join(" · ");
    box.innerHTML = `<img src="${esc(url)}" alt="${esc(vessel.name || "Yacht")}" />
      <div class="home-yacht-caption"><strong>${esc(vessel.name || "")}</strong><small>${esc(meta)}</small></div>`;
  }

  async function shareProfile(profile) {
    if (!profile.publicEnabled || !profile.username) {
      window.location.href = "profile.html";
      return;
    }
    const url = `${window.location.origin}/u/${encodeURIComponent(profile.username)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.Seav.notify("success", "Link copied", "Your public profile link is on your clipboard.");
    } catch {
      window.Seav.notify("error", "Couldn't copy the link", url);
    }
  }

  function renderHome() {
    const s = state();
    const profile = s.profile || {};
    const vessels = s.vessels || [];
    const certs = Logic().heldCerts(s);
    const readiness = Logic().computeReadiness(s);
    const next = Logic().computeNextStep(s);
    const current = window.SeavData.getCurrentVessel?.(vessels);
    const firstName = profile.firstName || String(profile.name || "").trim().split(/\s+/)[0] || "";

    el("homeTitle").textContent = readiness.complete
      ? [profile.rank, current?.name].filter(Boolean).join(" · ") || "Your CV is ready"
      : `Your CV is ${readiness.percent}% ready`;

    const statusLine = Logic().certStatusLine(s);
    el("homeSub").textContent = readiness.complete
      ? ["Your CV is ready to send.", next?.key?.startsWith("cert-") ? "" : statusLine].filter(Boolean).join(" ")
      : current && vessels.length === 1
        ? `Nice work${firstName ? `, ${firstName}` : ""}. ${current.name || "Your yacht"} is on your CV.`
        : `${firstName ? `${firstName}, one` : "One"} step at a time.`;

    const meter = el("homeMeter");
    meter.hidden = readiness.complete;
    meter.querySelector("i").style.width = `${readiness.percent}%`;

    renderNext(next);
    renderChecklist(readiness, next);
    renderYacht(current);
    renderTiles(s);

    el("homeCv").innerHTML = cvCardHtml({
      name: profile.name,
      rank: profile.rank,
      photo: photoUrl(profile.photo, "PROFILE_PHOTOS", "profile-photos"),
      yachts: yachtRows(vessels),
      certs: certRows(certs),
      about: profile.bio
    });
    el("homeCvOpen").textContent = readiness.complete ? "Open my CV" : "Edit my CV";

    // Search and the bell have nothing to offer an empty account.
    document.body.classList.toggle("seav-no-records", !vessels.length && !certs.length && !(s.seatimes || []).length);
  }

  function wireHome() {
    el("homeCvShare")?.addEventListener("click", () => shareProfile(state().profile || {}));
  }

  /* ---------- First-run setup ---------- */
  const setup = { step: 1, first: "", last: "", rank: "", choice: "", yacht: "", yachtRole: "", from: "", certCode: "", expiry: "", saved: null };
  let setupActive = false;
  const CERT_CODES = ["STCW BST", "ENG1"];

  function setupCvHtml() {
    const name = [setup.first, setup.last].filter(Boolean).join(" ");
    const cert = setup.choice === "cert" && setup.certCode ? window.SeavData.findCertificateCatalogItem?.(setup.certCode) : null;
    return cvCardHtml({
      name,
      rank: setup.rank,
      yachts: setup.choice === "yacht" && setup.yacht ? [[setup.yacht, setup.yachtRole || setup.rank]] : [],
      certs: cert ? [[cert.name, ""]] : []
    });
  }

  function refreshSetupCv() {
    const slot = el("setupCv");
    if (slot) slot.innerHTML = setupCvHtml();
  }

  const dots = (n) => `<div class="home-steps" role="img" aria-label="Step ${n} of 3">${[1, 2, 3].map((i) => `<i class="${i <= n ? "is-on" : ""}"></i>`).join("")}</div>`;

  function setupHead(n, title, sub) {
    el("homeShellHeadTitle").innerHTML = `${dots(n)}<h2>${esc(title)}</h2><p>${esc(sub)}</p>`;
  }

  function step1Html() {
    const options = window.SeavData.getPositionOptionsHtml?.(setup.rank, { placeholder: "Choose a role" }) || "";
    return `<form class="home-form" id="setupForm" novalidate>
        <div class="home-two">
          <label>First name<input data-f="first" value="${esc(setup.first)}" autocomplete="given-name" /></label>
          <label>Last name<input data-f="last" value="${esc(setup.last)}" autocomplete="family-name" /></label>
        </div>
        <label>Your role on board, or the one you are after
          <select data-f="rank">${options}</select></label>
        <p class="home-error" id="setupError" role="alert" hidden></p>
        <div class="home-actions"><button type="submit" class="btn-blue">Continue</button></div>
      </form>`;
  }

  function step2Html() {
    const option = (id, title, sub) => `<button type="button" class="home-choice" data-choice="${id}" aria-pressed="${setup.choice === id}"><strong>${title}</strong><small>${sub}</small></button>`;
    const certs = CERT_CODES.map((code) => window.SeavData.findCertificateCatalogItem?.(code)).filter(Boolean);
    const extra = setup.choice === "yacht"
      ? `<div class="home-two">
           <label>Yacht name<input data-f="yacht" value="${esc(setup.yacht)}" autocomplete="off" /></label>
           <label>Your role<input data-f="yachtRole" value="${esc(setup.yachtRole || setup.rank)}" autocomplete="off" /></label>
         </div>
         <label>When you joined<input type="date" data-f="from" value="${esc(setup.from)}" /></label>`
      : setup.choice === "cert"
        ? `<label>Certificate<select data-f="certCode"><option value="">Choose a certificate</option>
             ${certs.map((c) => `<option value="${esc(c.code)}" ${c.code === setup.certCode ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
           </select></label>
           <label>Expiry date, if it has one<input type="date" data-f="expiry" value="${esc(setup.expiry)}" /></label>
           <small class="home-note">Got a different one? You can add any certificate from your home page.</small>`
        : "";
    return `<form class="home-form" id="setupForm" novalidate>
        <div class="home-stack">
          ${option("yacht", "A yacht I have worked on", "Name, role and when you joined")}
          ${option("cert", "A certificate I hold", "Such as STCW Basic Safety or an ENG1")}
          ${option("none", "Nothing yet", "No problem. We'll show you what to get first.")}
        </div>
        ${extra}
        <p class="home-error" id="setupError" role="alert" hidden></p>
        <div class="home-actions">
          <button type="submit" class="btn-blue">Continue</button>
          <button type="button" class="btn-ghost2" id="setupBack">Back</button>
        </div>
      </form>`;
  }

  function step3Html() {
    return `<strong class="home-card-title">Your SEA-V CV</strong>
      <strong class="home-next-title">Yours to download or share when you are ready</strong>
      <p class="home-text">Your public profile stays off until you switch it on.</p>
      <div class="home-actions"><button type="button" class="btn-blue" id="setupDone">Go to my home</button></div>`;
  }

  function renderSetup() {
    const heads = {
      1: ["Let's start your yacht CV", "It takes a couple of minutes, and you can change anything later."],
      2: ["What can you add first?", "Just one thing for now. The rest can wait."],
      3: [`${setup.first || "Great"}, your CV has started`, "It will keep filling in as you add things. From here, we'll show you one step at a time."]
    };
    setupHead(setup.step, ...heads[setup.step]);
    el("setupBody").innerHTML = { 1: step1Html, 2: step2Html, 3: step3Html }[setup.step]();
    refreshSetupCv();
    const focus = el("setupBody").querySelector("input, select");
    if (focus && setup.step === 1) focus.focus();
  }

  function setupError(message) {
    const box = el("setupError");
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
  }

  // Merged onto a FRESH read of the row, never on what the page happens to hold:
  // the profile save writes every column (the 2026-08-07 blank-form data loss).
  async function saveSetupProfile() {
    const { KEYS } = window.SeavData;
    const fresh = setup.saved || await window.SeavAPI.get(KEYS.PROFILE, null);
    if (!fresh) throw new Error("Your profile could not be loaded. Refresh and try again.");
    const profile = {
      ...fresh,
      firstName: setup.first,
      lastName: setup.last,
      name: [setup.first, setup.last].filter(Boolean).join(" "),
      rank: setup.rank
    };
    await window.SeavAPI.save(KEYS.PROFILE, profile);
    setup.saved = profile;
    window.SeavState?.updateProfile?.(profile);
  }

  async function saveSetupRecord() {
    const { KEYS, createId, findCertificateCatalogItem } = window.SeavData;
    if (setup.choice === "yacht") {
      await window.SeavAPI.addItem(KEYS.VESSELS, {
        id: createId("vessel"),
        name: setup.yacht,
        vessel_role: setup.yachtRole || setup.rank,
        from: setup.from,
        to: ""
      });
    } else if (setup.choice === "cert") {
      const item = findCertificateCatalogItem(setup.certCode);
      await window.SeavAPI.addItem(KEYS.CERTS, {
        id: createId("cert"),
        code: item.code,
        name: item.name,
        expiry: setup.expiry,
        isMandatory: !!item.isMandatory,
        isTemplate: false,
        showOnCv: true
      });
    }
    document.dispatchEvent(new CustomEvent("seav:data-updated"));
  }

  async function submitSetup() {
    setupError("");
    if (setup.step === 1) {
      if (!setup.first.trim() || !setup.rank) {
        setupError("Add your first name and choose a role.");
        return;
      }
      setup.first = setup.first.trim();
      setup.last = setup.last.trim();
      setup.yachtRole = setup.yachtRole || setup.rank;
      await saveSetupProfile();
      setup.step = 2;
    } else if (setup.step === 2) {
      if (setup.choice === "yacht" && !setup.yacht.trim()) {
        setupError("Add the yacht's name, or choose Nothing yet.");
        return;
      }
      if (setup.choice === "cert" && !setup.certCode) {
        setupError("Choose a certificate, or choose Nothing yet.");
        return;
      }
      setup.yacht = setup.yacht.trim();
      await saveSetupRecord();
      setup.step = 3;
    }
    renderSetup();
  }

  function showSetup(show) {
    el("homeHead").hidden = show;
    el("homeMain").hidden = show;
    el("setupHead").hidden = !show;
    el("homeSetup").hidden = !show;
  }

  function leaveSetup() {
    setupActive = false;
    document.body.classList.remove("seav-setup");
    showSetup(false);
    window.SeavDashboardHome.render();
  }

  function wireSetup() {
    const root = el("homeSetup");
    root.addEventListener("input", (event) => {
      const key = event.target.getAttribute?.("data-f");
      if (key) {
        setup[key] = event.target.value;
        refreshSetupCv();
      }
    });
    root.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.target.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      try {
        await submitSetup();
      } catch (err) {
        console.error("[SEA-V] First-run setup save failed:", err);
        setupError(err?.message || "That didn't save. Check your connection and try again.");
        if (button) button.disabled = false;
      }
      if (button && document.contains(button)) button.disabled = false;
    });
    root.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-choice]");
      if (choice) {
        setup.choice = choice.getAttribute("data-choice");
        renderSetup();
      } else if (event.target.closest("#setupBack")) {
        setup.step = 1;
        renderSetup();
      } else if (event.target.closest("#setupDone")) {
        leaveSetup();
      }
    });
  }

  // needsFirstRun reads the loaded state; a failed load also looks empty, so a
  // fresh read of the profile row must agree before setup can appear.
  async function maybeStartSetup() {
    if (setupActive) return true;
    if (!Logic().needsFirstRun(state())) return false;
    let fresh = null;
    try {
      fresh = await window.SeavAPI.get(window.SeavData.KEYS.PROFILE, null);
    } catch (err) {
      console.warn("[SEA-V] First-run check failed:", err);
    }
    if (!fresh || (fresh.rank && String(fresh.rank).trim())) return false;
    if (!Logic().needsFirstRun(state())) return false;

    const parts = String(fresh.name || "").trim().split(/\s+/);
    setup.first = fresh.firstName || parts[0] || "";
    setup.last = fresh.lastName || parts.slice(1).join(" ") || "";
    setup.saved = null;
    setupActive = true;
    document.body.classList.add("seav-setup");
    showSetup(true);
    renderSetup();
    return true;
  }

  let wired = false;
  async function render() {
    if (!el("homeMain")) return;
    if (!wired) {
      wired = true;
      wireHome();
      wireSetup();
    }
    if (setupActive || await maybeStartSetup()) return;
    renderHome();
  }

  window.SeavDashboardHome = { render };
})();
