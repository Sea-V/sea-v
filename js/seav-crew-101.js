// /js/seav-crew-101.js
// Crew 101 (v618, Jack 2026-11-06): the basics for a first yacht. The content lives
// here, for js/crew-101.js (the guide page) and the
// dashboard card. Wording is a first draft for Jack to fine-tune. Links checked
// 2026-11-06. There is deliberately no plain-English COLREGs summary: Jack did not
// want one, as "not professional". The official text stays under Regulations.
(function () {
  "use strict";

  const line = (d) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICONS = {
    book: line("M12 7c-2-1.6-4.5-2-8-2v12c3.5 0 6 .4 8 2 2-1.6 4.5-2 8-2V5c-3.5 0-6 .4-8 2ZM12 7v12"),
    bag: line("M6 8h12l1 11H5L6 8ZM9 8V6.5a3 3 0 0 1 6 0V8"),
    knot: line("M6 18c6 0 3-12 9-12a3 3 0 0 1 0 6c-5 0-4 6-9 6ZM4 18h2M15 6h5"),
    anchor: line("M12 8v12M7 12H4c.5 4.5 4 8 8 8s7.5-3.5 8-8h-3M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"),
    people: line("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.5-3.5 2.6-5 5.5-5s5 1.5 5.5 5M16 5.5a3 3 0 0 1 0 5.5M17.5 14.2c1.7.6 2.7 2.2 3 4.8"),
    cert: line("M7 4.5h10v15H7zM10 8.5h4M10 12h4"),
    rules: line("M6 5.5h11a1.5 1.5 0 0 1 1.5 1.5v12H7.5A1.5 1.5 0 0 1 6 17.5v-12ZM6 17.5A1.5 1.5 0 0 1 7.5 16h11")
  };

  const KNOT_SITE = "https://www.animatedknots.com/";

  // Every topic is a card on the guide page, and a row on the dashboard card.
  const TOPICS = [
    {
      id: "bring",
      title: "What to bring",
      covers: "Soft bag, documents, kit",
      icon: ICONS.bag,
      columns: ["Item", "Why"],
      rows: [
        ["Soft, folding bag", "Hard cases have nowhere to go in a crew cabin."],
        ["Passport, 6+ months left", "Some countries refuse less. Check your contract's return date."],
        ["Original certificates and copies", "STCW, ENG1, any others. Keep scans on your phone too."],
        ["Non-marking deck shoes", "Black soles mark teak. The yacht usually supplies uniform."],
        ["Sunglasses, hat, sun cream", "You will be outside more than you expect."],
        ["Small torch, notebook, pen", "For night watches and everything you are told."],
        ["Adaptors and a few photos", "Cabins are small. Bring what makes it feel like home."]
      ],
      more: [{ label: "Viking Crew packing list", url: "https://vikingcrew.com/what-to-bring-on-board-green-yacht-crew-tips" }]
    },
    {
      id: "knots",
      title: "Knots",
      covers: "The seven to know first",
      icon: ICONS.knot,
      columns: ["Knot", "Used for", "Video"],
      linkColumn: true,
      rows: [
        ["Bowline", "A fixed loop that will not slip, and still unties", `${KNOT_SITE}bowline-knot`],
        ["Cleat hitch", "Tying a line off on a cleat. The most used on deck", `${KNOT_SITE}cleat-hitch-knot-dock-line`],
        ["Clove hitch", "Fenders to a rail, quick and adjustable", `${KNOT_SITE}clove-hitch-knot-rope-end`],
        ["Round turn and two half hitches", "Securing to a ring or a post", `${KNOT_SITE}round-turn-two-half-hitches-knot`],
        ["Figure of eight", "A stopper at the end of a line", `${KNOT_SITE}figure-8-knot`],
        ["Sheet bend", "Joining two lines of different sizes", `${KNOT_SITE}sheet-bend-knot`],
        ["Rolling hitch", "Taking the load off another line", `${KNOT_SITE}rolling-hitch-knot`]
      ],
      more: [{ label: "Quay Crew on knots", url: "https://quaygroup.com/blog/the-knots-you-need-to-know/" }]
    },
    {
      id: "deck",
      title: "Seamanship basics",
      covers: "Lines, fenders, staying safe",
      icon: ICONS.anchor,
      columns: ["Basic", "What it means"],
      rows: [
        ["One hand for you, one for the yacht", "Hold on when moving around at sea."],
        ["Never stand in a bight", "A loop of line under load can take your foot or leg."],
        ["Stay clear of lines under load", "If one parts, it snaps back with no warning."],
        ["Fender height, not guesswork", "Set them for the dock or tender you are actually coming alongside."],
        ["Shout, point, keep watching", "If someone goes overboard, never take your eyes off them."],
        ["Say back what you hear", "Repeat orders on deck and on the radio, so mistakes get caught."]
      ]
    },
    {
      id: "etiquette",
      title: "Crew etiquette",
      covers: "Guests, hierarchy, discretion",
      icon: ICONS.people,
      columns: ["Rule", "In practice"],
      rows: [
        ["Respect the chain of command", "Take a problem to your head of department first."],
        ["Guests come first and see little of you", "Quiet, tidy, helpful, out of the way."],
        ["What happens onboard stays onboard", "No guest names, no photos online. You may have signed an NDA."],
        ["Your cabin is shared", "Keep it tidy. Respect someone sleeping off a night watch."],
        ["Stay out of guest areas off duty", "Unless you are told otherwise."],
        ["Know the alcohol and drugs policy", "Most yachts are strict, and it can end a career."]
      ],
      more: [
        { label: "The Islander", url: "https://theislander.online/2026/06/crew-life/tzarinas-steps-to-the-etiquette-on-board-a-superyacht/" },
        { label: "Dockwalk", url: "https://www.dockwalk.com/crewlife/tips-for-being-a-courteous-crewmate" }
      ]
    },
    {
      id: "certs",
      title: "Certificates",
      covers: "STCW, ENG1 and where to get them",
      icon: ICONS.cert,
      columns: ["Certificate", "What it is", "Find it"],
      linkColumn: true,
      rows: [
        ["ENG1 medical", "The seafarer medical most yachts ask for", "https://www.gov.uk/government/publications/mca-approved-doctors-uk-based"],
        ["STCW Basic Safety", "Sea survival, fire, first aid, personal safety", "https://www.gov.uk/guidance/mca-approved-training-providers-atp"]
      ]
    },
    { id: "rules", title: "Regulations and guidance", covers: "MLC, MGNs, safe working, your flag", icon: ICONS.rules }
  ];

  const REGULATIONS = [
    ["ILO", "https://www.ilo.org/international-labour-standards/maritime-labour-convention-2006", "MLC 2006: your rights at work"],
    ["MCA", "https://www.gov.uk/government/publications/code-of-safe-working-practices-for-merchant-seafarers-2026-edition", "Code of Safe Working Practices, 2026"],
    ["MCA", "https://www.gov.uk/government/publications/msn-1781-mf-amendment-3-the-merchant-shipping-regulations-1996-colreg", "COLREGs: MSN 1781"],
    ["MCA", "https://www.gov.uk/government/publications/msn-1858-mf-amendment-2-uk-requirements-for-deck-officers-on-large-yachts-24m-and-over", "MSN 1858: deck officers on large yachts"],
    ["MCA", "https://www.gov.uk/government/collections/active-marine-guidance-notes-mgns", "Marine Guidance Notes (MGNs)"],
    ["MCA", "https://www.gov.uk/government/collections/merchant-shipping-notices-msns", "Merchant Shipping Notices (MSNs)"],
    ["MCA", "https://www.gov.uk/government/collections/marine-information-notes-mins", "Marine Information Notes (MINs)"],
    ["Red Ensign Group", "https://www.gov.uk/government/publications/red-ensign-group-yacht-code", "REG Yacht Code"]
  ];

  // Lower-case flag as crew type it. A flag not listed simply adds no row.
  const FLAG_REGISTRIES = {
    "cayman islands": ["https://www.cishipping.com/", "Cayman Islands Shipping Registry"],
    "isle of man": ["https://www.iomshipregistry.com/", "Isle of Man Ship Registry"],
    "marshall islands": ["https://www.register-iri.com/", "Marshall Islands Registry"],
    bermuda: ["https://www.bermudashipping.bm/", "Bermuda Shipping and Maritime"],
    "united kingdom": ["https://www.gov.uk/government/organisations/maritime-and-coastguard-agency", "UK Maritime and Coastguard Agency"]
  };

  function regulationRows() {
    const vessels = window.SeavState?.vessels || [];
    const flag = vessels.length ? window.SeavData.getCurrentVessel(vessels)?.flag : "";
    const registry = FLAG_REGISTRIES[String(flag || "").trim().toLowerCase()];
    return registry ? [...REGULATIONS, ["Your flag", registry[0], registry[1]]] : REGULATIONS;
  }

  window.SeavCrew101 = { ICONS, TOPICS, regulationRows };
})();
