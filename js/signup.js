// /js/signup.js
(function () {
  "use strict";

  function initSignup() {
    const form = document.getElementById("signupForm");
    const msg = document.getElementById("signupMsg");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (msg) {
        msg.textContent = "✅ Profile created (demo). Redirecting to dashboard...";
        msg.style.color = "#5bbcff";
      }

      // Demo redirect (adjust path if needed)
      setTimeout(function () {
        window.location.href = "../html/dashboard.html";
      }, 700);
    });
  }

  document.addEventListener("DOMContentLoaded", initSignup);
})();