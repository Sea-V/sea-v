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

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    });
  }

  document.addEventListener("DOMContentLoaded", initSignup);

})();