// /js/index.js
(function () {
  "use strict";

  function setLoginMessage(text, color) {
    const loginMsg = document.getElementById("loginMsg");
    if (!loginMsg) return;
    loginMsg.textContent = text;
    loginMsg.style.color = color;
  }

  function openEmailConfirmedModal() {
    const modal = document.getElementById("emailConfirmedModal");
    const overlay = document.getElementById("emailConfirmedOverlay");
    if (!modal || !overlay) {
      // Fall back to the inline message if the modal markup is missing.
      setLoginMessage("Email confirmed — you can log in now.", "#5bbcff");
      return;
    }
    modal.hidden = false;
    overlay.hidden = false;

    const closeBtn = document.getElementById("emailConfirmedClose");
    const continueBtn = document.getElementById("emailConfirmedContinue");
    const close = () => {
      modal.hidden = true;
      overlay.hidden = true;
    };
    closeBtn?.addEventListener("click", close);
    continueBtn?.addEventListener("click", close);
    overlay.addEventListener("click", close);

    // Let the click land in the email field so a returning user can just
    // start typing their password.
    document.querySelector('#loginForm input[type="email"]')?.focus();
  }

  function initIndexAuth() {
    const loginForm = document.getElementById("loginForm");
    const resetLink = document.getElementById("forgotPasswordLink");

    const storedNotice = sessionStorage.getItem("seav_auth_notice");
    if (storedNotice) {
      setLoginMessage(storedNotice, "#ff8fab");
      sessionStorage.removeItem("seav_auth_notice");
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      openEmailConfirmedModal();
      // Drop ?confirmed=1 from the URL so refreshing (or sharing the link)
      // doesn't reopen the modal.
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector('input[type="email"]')?.value?.trim();
        const password = document.getElementById("loginPassword")?.value || "";

        if (!email || !password) {
          setLoginMessage("Enter your email and password.", "#ff8fab");
          return;
        }

        setLoginMessage("Signing in…", "#5bbcff");

        try {
          await window.SeavAuth.whenReady();
          await window.SeavAuth.loginWithPassword(email, password);
          try {
            await window.SeavAuth.ensureProfileRow(window.SeavAuth.getUser());
          } catch (profileErr) {
            console.warn("[SEA-V] Profile bootstrap on login:", profileErr);
          }
          setLoginMessage("Signed in. Redirecting…", "#5bbcff");
          window.SeavAuth.redirectAfterLogin();
        } catch (err) {
          console.error("[SEA-V] Login failed:", err);
          setLoginMessage(window.SeavAuth.authErrorMessage(err), "#ff8fab");
        }
      });
    }

    if (resetLink) {
      resetLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = loginForm?.querySelector('input[type="email"]')?.value?.trim();
        if (!email) {
          setLoginMessage("Enter your email above, then click reset password.", "#ff8fab");
          return;
        }
        try {
          await window.SeavAuth.whenReady();
          await window.SeavAuth.requestPasswordReset(email);
          setLoginMessage("Password reset email sent (if an account exists).", "#5bbcff");
        } catch (err) {
          setLoginMessage(window.SeavAuth.authErrorMessage(err), "#ff8fab");
        }
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

  document.addEventListener("DOMContentLoaded", initIndexAuth);
})();
