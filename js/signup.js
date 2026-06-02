(function () {
  "use strict";

  function initSignup() {
    const form = document.getElementById("signupForm");
    const msg = document.getElementById("signupMsg");
    const resendBtn = document.getElementById("btnResendConfirm");

    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const name = form.querySelector('input[type="text"]')?.value?.trim() || "";
      const email = form.querySelector('input[type="email"]')?.value?.trim() || "";
      const passwords = form.querySelectorAll('input[type="password"]');
      const password = passwords[0]?.value || "";
      const confirm = passwords[1]?.value || "";

      if (password.length < 8) {
        if (msg) {
          msg.textContent = "Password must be at least 8 characters.";
          msg.style.color = "#ff8fab";
        }
        return;
      }

      if (password !== confirm) {
        if (msg) {
          msg.textContent = "Passwords do not match.";
          msg.style.color = "#ff8fab";
        }
        return;
      }

      if (msg) {
        msg.textContent = "Creating your account…";
        msg.style.color = "#5bbcff";
      }

      if (resendBtn) resendBtn.hidden = true;

      try {
        await window.SeavAuth.whenReady();
        const result = await window.SeavAuth.signUpWithPassword({ email, password, name });

        if (result.session) {
          try {
            await window.SeavAuth.ensureProfileRow(result.user || window.SeavAuth.getUser(), name);
          } catch (profileErr) {
            console.warn("[SEA-V] Profile bootstrap after signup:", profileErr);
          }
          if (msg) {
            msg.textContent = "Account created. Redirecting to dashboard…";
            msg.style.color = "#5bbcff";
          }
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 500);
          return;
        }

        if (msg) {
          msg.textContent =
            "Account created. Check your email and click the confirmation link, then log in here.";
          msg.style.color = "#5bbcff";
        }

        if (resendBtn) {
          resendBtn.hidden = false;
          resendBtn.dataset.email = email;
        }
      } catch (err) {
        console.error("[SEA-V] Signup failed:", err);
        if (msg) {
          msg.textContent = window.SeavAuth.authErrorMessage(err);
          msg.style.color = "#ff8fab";
        }
      }
    });

    if (resendBtn) {
      resendBtn.addEventListener("click", async () => {
        const email =
          resendBtn.dataset.email ||
          form.querySelector('input[type="email"]')?.value?.trim() ||
          "";

        if (!email) {
          if (msg) {
            msg.textContent = "Enter your email address first.";
            msg.style.color = "#ff8fab";
          }
          return;
        }

        try {
          await window.SeavAuth.whenReady();
          await window.SeavAuth.resendConfirmationEmail(email);
          if (msg) {
            msg.textContent = "Confirmation email sent again — check inbox and spam.";
            msg.style.color = "#5bbcff";
          }
        } catch (err) {
          if (msg) {
            msg.textContent = window.SeavAuth.authErrorMessage(err);
            msg.style.color = "#ff8fab";
          }
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initSignup);
})();
