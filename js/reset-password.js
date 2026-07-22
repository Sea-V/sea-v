// /js/reset-password.js — password recovery landing page
//
// The Reset password email links here with ?token_hash=...&type=recovery
// (mirroring confirm-account.js's approach for signup) instead of Supabase's
// own auto-verifying .ConfirmationURL. That default flow silently logs the
// visitor in via a URL hash access_token and drops them straight on the
// dashboard without ever asking for a new password — the link looked like
// it worked but never actually changed anything. Using token_hash +
// verifyOtp here instead means nothing happens until the visitor sets a new
// password. verifyOtp does establish a session (unavoidable, inherent to the
// API), so once the password is updated we sign back out and send the
// visitor to the login page to sign in on purpose, same pattern as
// confirm-account.js.
(function () {
  "use strict";

  function show(id) {
    ["rpLoading", "rpReady", "rpError", "rpSuccess"].forEach((stateId) => {
      const el = document.getElementById(stateId);
      if (el) el.hidden = stateId !== id;
    });
  }

  function setErrorText(text) {
    const el = document.getElementById("rpErrorText");
    if (el) el.textContent = text;
  }

  function setMsg(text, color) {
    const el = document.getElementById("rpMsg");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = color || "#ff8fab";
  }

  function waitForSupabase(maxMs = 4000) {
    if (window.SeavSupabase) return Promise.resolve(window.SeavSupabase);
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.SeavSupabase) {
          clearInterval(timer);
          resolve(window.SeavSupabase);
          return;
        }
        if (Date.now() - started >= maxMs) {
          clearInterval(timer);
          reject(new Error("Supabase client not loaded."));
        }
      }, 50);
    });
  }

  function isExpiredOrUsedError(err) {
    const reason = String(err?.message || "").toLowerCase();
    return (
      reason.includes("expired") ||
      reason.includes("invalid") ||
      reason.includes("used")
    );
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") || "recovery";

    if (!tokenHash) {
      setErrorText(
        "This password reset link is missing or incomplete. Copy the full link from your email, or request a new one from the login page."
      );
      show("rpError");
      return;
    }

    let client;
    try {
      client = await waitForSupabase();
    } catch (err) {
      console.error("[SEA-V] Reset password: Supabase client unavailable:", err);
      setErrorText("Couldn't connect right now. Refresh the page and try again.");
      show("rpError");
      return;
    }

    show("rpReady");

    const form = document.getElementById("resetPasswordForm");
    const passwordInput = document.getElementById("rpPassword");
    const confirmInput = document.getElementById("rpPasswordConfirm");
    const toggle = document.getElementById("toggleRpPassword");
    const submitBtn = document.getElementById("rpSubmitBtn");

    if (toggle && passwordInput && confirmInput) {
      toggle.addEventListener("change", () => {
        const t = toggle.checked ? "text" : "password";
        passwordInput.type = t;
        confirmInput.type = t;
      });
    }

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const password = passwordInput?.value || "";
      const confirm = confirmInput?.value || "";

      if (password.length < 8) {
        setMsg("Password must be at least 8 characters.", "#ff8fab");
        passwordInput?.focus();
        return;
      }

      if (password !== confirm) {
        setMsg("Passwords do not match.", "#ff8fab");
        confirmInput?.focus();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      setMsg("Verifying link…", "#5bbcff");

      try {
        const { error: verifyError } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type
        });
        if (verifyError) throw verifyError;

        setMsg("Setting new password…", "#5bbcff");

        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;

        await client.auth.signOut();

        try {
          sessionStorage.setItem(
            "seav_auth_notice",
            "Password updated. Log in with your new password."
          );
        } catch (storageErr) {
          console.warn("[SEA-V] Could not set login notice:", storageErr);
        }

        show("rpSuccess");
        window.setTimeout(() => {
          window.location.href = "index.html";
        }, 900);
      } catch (err) {
        console.error("[SEA-V] Reset password failed:", err);
        if (isExpiredOrUsedError(err)) {
          setErrorText(
            "This link has expired or was already used. Request a new password reset email from the login page."
          );
          show("rpError");
          return;
        }
        setMsg(
          err?.message || "Something went wrong updating your password. Try again.",
          "#ff8fab"
        );
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
