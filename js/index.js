// /js/index.js
(function () {
  "use strict";

  function goToDashboard() {
    // Uses your top logo link as the source of truth
    const brand = document.querySelector('a.brand[href]');
    if (brand) {
      window.location.href = brand.getAttribute("href");
      return;
    }
    // Fallback (safe default if brand is missing)
    window.location.href = "dashboard.html";
  }

  function initIndexAuthDemo() {
    const signupForm = document.getElementById("signupForm");
    const signupMsg = document.getElementById("signupMsg");

    if (signupForm && signupMsg) {
      signupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        signupMsg.textContent = "✅ Profile created (demo). Redirecting to dashboard...";
        signupMsg.style.color = "#5bbcff";
        setTimeout(goToDashboard, 700);
      });
    }

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
  }

  document.addEventListener("DOMContentLoaded", initIndexAuthDemo);

})();
