// /js/login.js
(function () {
  "use strict";

  function initLogin() {
    const form = document.getElementById("loginForm");
    const msg = document.getElementById("loginMsg");

    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (msg) {
        msg.textContent = "✅ Logged in (demo). Redirecting to dashboard...";
        msg.style.color = "#5bbcff";
      }

      setTimeout(function () {
        window.location.href = "../html/dashboard.html";
      }, 700);
    });
  }

  document.addEventListener("DOMContentLoaded", initLogin);
})();