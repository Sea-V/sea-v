// /js/settings.js
(function () {
  "use strict";

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function exportAllSeavData() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith("seav_")) continue;

      try {
        out[k] = JSON.parse(localStorage.getItem(k));
      } catch {
        out[k] = localStorage.getItem(k);
      }
    }
    return out;
  }

  function initSettings() {
    // Only run on settings page
    if (!document.getElementById("setPublicEnabled") && !document.getElementById("btnClearData")) return;

    const chkPublic = document.getElementById("setPublicEnabled");
    const viewPublic = document.getElementById("setViewPublic");
    const msgPublic = document.getElementById("setPublicMsg");

    const btnExport = document.getElementById("btnExportData");
    const btnClear = document.getElementById("btnClearData");
    const msgData = document.getElementById("setDataMsg");

    // Load profile
    const p = Seav.load("seav_profile", {
      name: "Demo User",
      rank: "",
      nationality: "",
      dob: "",
      location: "",
      email: "",
      phone: "",
      photo: null,
      publicEnabled: false,
    });

    // Public profile toggle
    if (chkPublic) {
      chkPublic.checked = !!p.publicEnabled;

      const refreshPublicUi = () => {
        if (!viewPublic) return;
        // Keep the link visible but you can “soft-disable” it if you want
        viewPublic.style.opacity = chkPublic.checked ? "1" : "0.55";
      };

      refreshPublicUi();

      chkPublic.addEventListener("change", () => {
        p.publicEnabled = !!chkPublic.checked;
        Seav.save("seav_profile", p);

        if (msgPublic) {
          msgPublic.textContent = p.publicEnabled
            ? "Public profile enabled."
            : "Public profile disabled.";
        }

        refreshPublicUi();

        // If dashboard is open in another tab and you later add a bus/event system,
        // you can sync. For now this is enough.
      });
    }

    // Export JSON
    if (btnExport) {
      btnExport.addEventListener("click", (e) => {
        e.preventDefault();
        const data = exportAllSeavData();
        downloadText("seav-export.json", JSON.stringify(data, null, 2));
        if (msgData) msgData.textContent = "Export downloaded (seav-export.json).";
      });
    }

    // Clear all seav_ keys
    if (btnClear) {
      btnClear.addEventListener("click", (e) => {
        e.preventDefault();
        const ok = confirm("Clear ALL SEA-V prototype data on this browser?");
        if (!ok) return;

        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("seav_")) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));

        if (msgData) msgData.textContent = "All SEA-V data cleared.";

        // Reset toggle UI
        if (chkPublic) chkPublic.checked = false;
        if (msgPublic) msgPublic.textContent = "";
        if (viewPublic) viewPublic.style.opacity = "0.55";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initSettings);
})();