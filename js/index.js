// /js/index.js
(function () {
  "use strict";

  function goToDashboard() {
    const brand = document.querySelector('a.brand[href]');
    if (brand) {
      window.location.href = brand.getAttribute("href");
      return;
    }

    window.location.href = "dashboard.html";
  }

  function initIndexAuthDemo() {
    const loginForm = document.getElementById("loginForm");
    const loginMsg = document.getElementById("loginMsg");

    if (loginForm && loginMsg) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        loginMsg.textContent = "✅ Logged in (demo). Redirecting to dashboard...";
        loginMsg.style.color = "#5bbcff";
        setTimeout(goToDashboard, 700);
      });
    }

    const toggle = document.getElementById("togglePassword");
    const password = document.getElementById("loginPassword");

    if (toggle && password) {
      toggle.addEventListener("change", () => {
        password.type = toggle.checked ? "text" : "password";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initIndexAuthDemo);
})();