// /js/navigation.js
(function () {
  "use strict";

  // Full country list
  const COUNTRIES = [
    "Argentina", "Australia", "Bahamas", "Belgium", "Brazil", "Canada", "Chile",
    "China", "Croatia", "Cyprus", "Denmark", "France", "Germany", "Greece",
    "Hong Kong", "Iceland", "India", "Indonesia", "Ireland", "Italy", "Japan",
    "Malta", "Mexico", "Monaco", "Montenegro", "Morocco", "Netherlands",
    "New Zealand", "Norway", "Panama", "Portugal", "Qatar", "Saudi Arabia",
    "Singapore", "South Africa", "Spain", "Sweden", "Thailand", "Turkey",
    "UAE", "UK", "USA"
  ];

  // Curated port list for MVP
  const PORTS = [
    { country: "France", port: "Antibes", lat: 43.5804, lng: 7.1251 },
    { country: "France", port: "Nice", lat: 43.7102, lng: 7.2620 },
    { country: "France", port: "Marseille", lat: 43.2965, lng: 5.3698 },
    { country: "France", port: "La Ciotat", lat: 43.1735, lng: 5.6053 },

    { country: "Monaco", port: "Monaco", lat: 43.7384, lng: 7.4246 },

    { country: "Spain", port: "Palma", lat: 39.5696, lng: 2.6502 },
    { country: "Spain", port: "Barcelona", lat: 41.3874, lng: 2.1686 },
    { country: "Spain", port: "Ibiza", lat: 38.9067, lng: 1.4206 },

    { country: "Italy", port: "Genoa", lat: 44.4056, lng: 8.9463 },
    { country: "Italy", port: "Naples", lat: 40.8518, lng: 14.2681 },

    { country: "Croatia", port: "Split", lat: 43.5081, lng: 16.4402 },
    { country: "Croatia", port: "Dubrovnik", lat: 42.6507, lng: 18.0944 },

    { country: "Greece", port: "Athens", lat: 37.9838, lng: 23.7275 },
    { country: "Greece", port: "Corfu", lat: 39.6243, lng: 19.9217 },

    { country: "Turkey", port: "Bodrum", lat: 37.0344, lng: 27.4305 },

    { country: "Montenegro", port: "Tivat", lat: 42.4304, lng: 18.7062 },

    { country: "USA", port: "Fort Lauderdale", lat: 26.1224, lng: -80.1373 },
    { country: "USA", port: "Miami", lat: 25.7617, lng: -80.1918 },
    { country: "USA", port: "Newport", lat: 41.4901, lng: -71.3128 },
    { country: "USA", port: "Savannah", lat: 32.0809, lng: -81.0912 },

    { country: "Bahamas", port: "Nassau", lat: 25.0443, lng: -77.3504 },

    { country: "Canada", port: "Halifax", lat: 44.6488, lng: -63.5752 },
    { country: "Canada", port: "Vancouver", lat: 49.2827, lng: -123.1207 },

    { country: "Panama", port: "Colon", lat: 9.3545, lng: -79.9001 },
    { country: "Panama", port: "Panama City", lat: 8.9824, lng: -79.5199 },

    { country: "Chile", port: "Puerto Williams", lat: -54.9336, lng: -67.6083 },
    { country: "Chile", port: "Punta Arenas", lat: -53.1638, lng: -70.9171 },
    { country: "Chile", port: "Puerto Montt", lat: -41.4693, lng: -72.9424 },

    { country: "Argentina", port: "Ushuaia", lat: -54.8019, lng: -68.3030 },

    { country: "Portugal", port: "Lisbon", lat: 38.7223, lng: -9.1393 },
    { country: "Portugal", port: "Funchal", lat: 32.6669, lng: -16.9241 },

    { country: "South Africa", port: "Cape Town", lat: -33.9249, lng: 18.4241 },

    { country: "UAE", port: "Dubai", lat: 25.2048, lng: 55.2708 },

    { country: "Singapore", port: "Singapore", lat: 1.3521, lng: 103.8198 },

    { country: "Australia", port: "Sydney", lat: -33.8688, lng: 151.2093 },
    { country: "New Zealand", port: "Auckland", lat: -36.8509, lng: 174.7645 }
  ];

  let map;
  let markersLayer;

  function loadNavEntries() {
    return Seav.load("seav_navigation_areas", []);
  }

  function saveNavEntries(entries) {
    Seav.save("seav_navigation_areas", entries);
  }

  function buildPopup(entry) {
    const noteHtml = entry.note
      ? `<div class="nav-popup-meta">${entry.note}</div>`
      : "";

    return `
      <div class="nav-popup-title">${entry.port}</div>
      <div class="nav-popup-meta">${entry.country}</div>
      ${noteHtml}
    `;
  }

  function renderMarkers() {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const entries = loadNavEntries();

    entries.forEach((entry) => {
      const marker = L.marker([entry.lat, entry.lng]).addTo(markersLayer);
      marker.bindPopup(buildPopup(entry));
    });
  }

  function populateCountries() {
    const countryList = document.getElementById("countryList");
    if (!countryList) return;

    countryList.innerHTML = COUNTRIES
      .slice()
      .sort()
      .map(country => `<option value="${country}"></option>`)
      .join("");
  }

  function populatePortsForCountry(country) {
    const portList = document.getElementById("portList");
    if (!portList) return;

    const filtered = PORTS
      .filter(p => !country || p.country.toLowerCase() === country.toLowerCase())
      .map(p => p.port)
      .sort();

    portList.innerHTML = filtered
      .map(port => `<option value="${port}"></option>`)
      .join("");
  }

  function initForm() {
    const form = document.getElementById("navForm");
    const countryInput = document.getElementById("navCountry");
    const portInput = document.getElementById("navPort");
    const noteInput = document.getElementById("navNote");

    if (!form || !countryInput || !portInput) return;

    populateCountries();
    populatePortsForCountry("");

    countryInput.addEventListener("input", () => {
      populatePortsForCountry(countryInput.value.trim());
      portInput.value = "";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const country = countryInput.value.trim();
      const port = portInput.value.trim();
      const note = noteInput?.value.trim() || "";

      if (!country || !port) {
        alert("Please select a country and port.");
        return;
      }

      const selected = PORTS.find(p =>
        p.country.toLowerCase() === country.toLowerCase() &&
        p.port.toLowerCase() === port.toLowerCase()
      );

      if (!selected) {
        alert("Please select a valid country and port from the list.");
        return;
      }

      const entries = loadNavEntries();

      const exists = entries.some(entry =>
        entry.country === selected.country &&
        entry.port === selected.port
      );

      if (exists) {
        alert("This port is already on your map.");
        return;
      }

      entries.push({
        country: selected.country,
        port: selected.port,
        lat: selected.lat,
        lng: selected.lng,
        note
      });

      saveNavEntries(entries);
      renderMarkers();

      form.reset();
      populatePortsForCountry("");
    });
  }

  function initNavigationMap() {
    const mapContainer = document.getElementById("navMap");
    if (!mapContainer || typeof L === "undefined") return;

    map = L.map("navMap", {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    renderMarkers();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigationMap();
    initForm();
  });
})();