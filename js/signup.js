(function () {
  "use strict";

  function setSignupMessage(msgEl, text, color) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = color;
  }

  function initSignup() {
    const form = document.getElementById("signupForm");
    const msg = document.getElementById("signupMsg");
    const resendBtn = document.getElementById("btnResendConfirm");
    const submitBtn = document.getElementById("signupSubmitBtn");
    const nameInput = document.getElementById("signupName");
    const emailInput = document.getElementById("signupEmail");
    const passwordInput = document.getElementById("signupPassword");
    const confirmInput = document.getElementById("signupPasswordConfirm");
    const togglePassword = document.getElementById("toggleSignupPassword");

    if (!form) return;

    if (togglePassword && passwordInput && confirmInput) {
      togglePassword.addEventListener("change", () => {
        const type = togglePassword.checked ? "text" : "password";
        passwordInput.type = type;
        confirmInput.type = type;
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const name = nameInput?.value?.trim() || "";
      const email = emailInput?.value?.trim() || "";
      const password = passwordInput?.value || "";
      const confirm = confirmInput?.value || "";

      if (!name) {
        setSignupMessage(msg, "Enter your full name.", "#ff8fab");
        nameInput?.focus();
        return;
      }

      if (!email) {
        setSignupMessage(msg, "Enter your email address.", "#ff8fab");
        emailInput?.focus();
        return;
      }

      if (password.length < 8) {
        setSignupMessage(msg, "Password must be at least 8 characters.", "#ff8fab");
        passwordInput?.focus();
        return;
      }

      if (password !== confirm) {
        setSignupMessage(msg, "Passwords do not match.", "#ff8fab");
        confirmInput?.focus();
        return;
      }

      const acceptLegal = document.getElementById("signupAcceptLegal");
      if (!acceptLegal?.checked) {
        setSignupMessage(msg, "Please accept the Terms of Use and Privacy Policy.", "#ff8fab");
        return;
      }

      setSignupMessage(msg, "Creating your account…", "#5bbcff");
      if (resendBtn) resendBtn.hidden = true;
      if (submitBtn) submitBtn.disabled = true;

      try {
        await window.SeavAuth.whenReady();
        const result = await window.SeavAuth.signUpWithPassword({ email, password, name });

        if (result.session) {
          try {
            await window.SeavAuth.ensureProfileRow(result.user || window.SeavAuth.getUser(), name);
          } catch (profileErr) {
            console.warn("[SEA-V] Profile bootstrap after signup:", profileErr);
          }
          setSignupMessage(msg, "Account created. Redirecting to dashboard…", "#5bbcff");
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 500);
          return;
        }

        setSignupMessage(
          msg,
          "Account created. Check your email and click the confirmation link, then log in.",
          "#5bbcff"
        );

        if (resendBtn) {
          resendBtn.hidden = false;
          resendBtn.dataset.email = email;
        }
      } catch (err) {
        console.error("[SEA-V] Signup failed:", err);
        setSignupMessage(msg, window.SeavAuth.authErrorMessage(err), "#ff8fab");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    if (resendBtn) {
      resendBtn.addEventListener("click", async () => {
        const email =
          resendBtn.dataset.email ||
          emailInput?.value?.trim() ||
          "";

        if (!email) {
          setSignupMessage(msg, "Enter your email address first.", "#ff8fab");
          return;
        }

        resendBtn.disabled = true;

        try {
          await window.SeavAuth.whenReady();
          await window.SeavAuth.resendConfirmationEmail(email);
          setSignupMessage(msg, "Confirmation email sent again — check inbox and spam.", "#5bbcff");
        } catch (err) {
          setSignupMessage(msg, window.SeavAuth.authErrorMessage(err), "#ff8fab");
        } finally {
          resendBtn.disabled = false;
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initSignup);
})();
