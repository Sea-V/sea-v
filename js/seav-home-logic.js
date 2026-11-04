// /js/seav-home-logic.js
// What the home page says (v601, Jack 2026-11-05: "one big ecosystem ... as
// simple as it can be for new green crew"). No DOM: these read the crew member's
// records and answer two questions, how ready is the CV and what is the ONE thing
// to do next. Everything here works from records already in SeavState.
(function () {
  "use strict";

  const has = (value) => value !== undefined && value !== null && String(value).trim() !== "";

  function hasPhoto(profile) {
    const photo = profile?.photo;
    return !!(photo && (photo.path || photo.url || photo.dataUrl));
  }

  // Certificates the crew member actually holds, not the catalogue's templates.
  function heldCerts(state) {
    const isSaved = window.SeavData?.isSavedCert;
    return (state?.certs || []).filter((cert) => (isSaved ? isSaved(cert) : has(cert?.name)));
  }

  // Five equal items, so the figure can always be explained by the list beside it.
  function computeReadiness(state) {
    const profile = state?.profile || {};
    const items = [
      { key: "name", label: "Your name and role", done: has(profile.name) && has(profile.rank) },
      { key: "cert", label: "A certificate", done: heldCerts(state).length > 0, action: { add: "certificate" }, verb: "Add" },
      { key: "photo", label: "A good photo", done: hasPhoto(profile), action: { href: "profile.html" }, verb: "Add" },
      {
        key: "experience",
        label: "A yacht or other experience",
        done: (state?.vessels || []).length > 0 || (state?.landExperiences || []).length > 0,
        action: { add: "vessel" },
        verb: "Add"
      },
      { key: "about", label: "A line or two about you", done: has(profile.bio), action: { href: "profile.html" }, verb: "Write" }
    ];
    const done = items.filter((item) => item.done).length;
    return { items, percent: Math.round((done / items.length) * 100), complete: done === items.length };
  }

  const DAY_MS = 86400000;

  function daysUntil(dateText, today) {
    const parse = window.SeavData?.parseDateOnly || ((text) => new Date(text));
    const date = has(dateText) ? parse(dateText) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return Math.round((date.getTime() - today.getTime()) / DAY_MS);
  }

  function formatMonthYear(dateText) {
    const parse = window.SeavData?.parseDateOnly || ((text) => new Date(text));
    const date = parse(dateText);
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  // The most urgent certificate with a date, medical included: an expired ENG1
  // matters more than any other step.
  function mostUrgentCert(state, today) {
    return heldCerts(state)
      .filter((cert) => !cert.noExpiry)
      .map((cert) => ({ cert, days: daysUntil(cert.expiry, today) }))
      .filter((row) => row.days !== null)
      .sort((a, b) => a.days - b.days)[0] || null;
  }

  const certName = (cert) => cert.name || "certificate";

  // In priority order; the first that applies is the next step. Keep the text
  // plain: a new deckhand reads this.
  function computeNextStep(state, today = new Date()) {
    const profile = state?.profile || {};
    const vessels = state?.vessels || [];
    const seatimes = state?.seatimes || [];
    const urgent = mostUrgentCert(state, today);

    if (urgent && urgent.days < 0) {
      return {
        key: "cert-expired",
        title: `Renew your ${certName(urgent.cert)}`,
        text: `It expired in ${formatMonthYear(urgent.cert.expiry)}. Add the new one once you have it.`,
        cta: "Update it",
        action: { href: `certificates.html?focus=${encodeURIComponent(urgent.cert.id)}` }
      };
    }
    if (urgent && urgent.days <= 90) {
      return {
        key: "cert-expiring",
        title: `Your ${certName(urgent.cert)} expires soon`,
        text: `It runs to ${formatMonthYear(urgent.cert.expiry)}. Book the renewal early, as courses fill up.`,
        cta: "See it",
        action: { href: `certificates.html?focus=${encodeURIComponent(urgent.cert.id)}` }
      };
    }
    if (!heldCerts(state).length) {
      return {
        key: "first-cert",
        title: "Add your STCW Basic Safety",
        text: "It is the first thing a captain looks for.",
        more: {
          label: "What is STCW Basic Safety?",
          text: "The safety course every crew member needs before working on a yacht: sea survival, firefighting, first aid and safety awareness. It usually takes about five days. You also need an ENG1 medical."
        },
        cta: "Add it",
        action: { add: "certificate" }
      };
    }
    if (!vessels.length) {
      return {
        key: "first-yacht",
        title: "Add a yacht you have worked on",
        text: "Your yachts are the heart of your CV. Day work counts too.",
        cta: "Add a yacht",
        action: { add: "vessel" }
      };
    }
    const unlogged = window.SeavData?.getCurrentVessel?.(vessels.filter((v) => !seatimes.some((s) => s.vesselId === v.id)));
    if (unlogged) {
      return {
        key: "log-time",
        title: `Log your time on ${unlogged.name || "your yacht"}`,
        text: "Sea time is what your next certificate is built on. We've filled in the yacht and your dates.",
        cta: "Log my time",
        action: { add: "seatime", vessel: unlogged }
      };
    }
    if (!hasPhoto(profile)) {
      return {
        key: "photo",
        title: "Add a good photo",
        text: "A clear, friendly photo in uniform goes a long way with captains and agents.",
        cta: "Add a photo",
        action: { href: "profile.html" }
      };
    }
    if (!has(profile.bio)) {
      return {
        key: "about",
        title: "Write a line or two about you",
        text: "Who you are and what you are looking for. It sits at the top of your CV.",
        cta: "Write it",
        action: { href: "profile.html" }
      };
    }
    const toSign = [...seatimes]
      .filter((entry) => !entry.testimonialStatus || entry.testimonialStatus === "Changed")
      .sort((a, b) => String(b.dateJoined || "").localeCompare(String(a.dateJoined || "")))[0];
    if (toSign) {
      const vessel = vessels.find((v) => v.id === toSign.vesselId);
      return {
        key: "signature",
        title: `Get the captain's signature on your time aboard ${vessel?.name || "your yacht"}`,
        text: "A signed testimonial is what the PYA or Nautilus will ask for.",
        cta: "Open it",
        action: { href: `seatime.html?focus=${encodeURIComponent(toSign.id)}` }
      };
    }
    if (!profile.publicEnabled) {
      return {
        key: "public",
        title: "Switch on your public profile",
        text: "It gives you one link to send to captains and agents. Only what you choose to show is on it.",
        cta: "Set it up",
        action: { href: "profile.html" }
      };
    }
    return null;
  }

  // The home line under the title: the certificate position in plain words.
  function certStatusLine(state, today = new Date()) {
    const urgent = mostUrgentCert(state, today);
    if (!urgent) return "";
    return `Nothing needs renewing: your ${certName(urgent.cert)} runs to ${formatMonthYear(urgent.cert.expiry)}.`;
  }

  // First-run setup is for an account with nothing in it. Existing crew never see
  // it. It stops as soon as a role is saved, so no separate flag is needed.
  function needsFirstRun(state) {
    return !has(state?.profile?.rank) &&
      !(state?.vessels || []).length &&
      !(state?.seatimes || []).length &&
      !heldCerts(state).length;
  }

  window.SeavHomeLogic = { computeReadiness, computeNextStep, certStatusLine, needsFirstRun, heldCerts };
})();
