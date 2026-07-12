// /js/confirm-account.js — the true "click here to confirm" signup step
//
// The Confirm signup email now links here with ?token_hash=...&type=signup
// (and optionally &email=...) instead of Supabase's own auto-verifying
// .ConfirmationURL. Nothing is confirmed just by opening this page or this
// link — verification only happens when the visitor explicitly clicks
// "Confirm my account," which calls supabase.auth.verifyOtp(). That call
// always establishes a live session on success (inherent to the Supabase
// API — can't be avoided), so we immediately sign back out afterwards and
// send the visitor to the login page instead of leaving them silently
// logged in from having opened an email link.
(function () {
  "use strict";

  function show(id) {
    ["caLoading", "caReady", "caError", "caSuccess"].forEach((stateId) => {
      const el = document.getElementById(stateId);
      if (el) el.hidden = stateId !== id;
    });
  }

  function setErrorText(text) {
    const el = document.getElementById("caErrorText");
    if (el) el.textContent = text;
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

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") || "signup";
    const email = params.get("email") || "";

    if (!tokenHash) {
      setErrorText(
        "This confirmation link is missing or incomplete. Copy the full link from your email, or request a new one from the sign up page."
      );
      show("caError");
      return;
    }

    let client;
    try {
      client = await waitForSupabase();
    } catch (err) {
      console.error("[SEA-V] Confirm account: Supabase client unavailable:", err);
      setErrorText("Couldn't connect right now. Refresh the page and try again.");
      show("caError");
      return;
    }

    const emailLine = document.getElementById("caEmailLine");
    if (emailLine && email) {
      emailLine.textContent = `Confirm the account for ${email} to finish setting up SEA-V.`;
    }

    show("caReady");

    const confirmBtn = document.getElementById("caConfirmBtn");
    confirmBtn?.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Confirming…";

      try {
        const { error } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type
        });
        if (error) throw error;

        // Don't leave the visitor auto-logged-in from opening an email link —
        // they land back on the login page and log in with their own
        // credentials on purpose.
        await client.auth.signOut();

        show("caSuccess");
        window.setTimeout(() => {
          window.location.href = "index.html?confirmed=1";
        }, 900);
      } catch (err) {
        console.error("[SEA-V] Account confirmation failed:", err);
        const reason = String(err?.message || "").toLowerCase();
        const message =
          reason.includes("expired") || reason.includes("invalid") || reason.includes("used")
            ? "This link has expired or was already used. Try logging in — if that doesn't work, sign up again to get a fresh confirmation email."
            : "Something went wrong confirming your account. Try again, or request a new confirmation email from the sign up page.";
        setErrorText(message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm my account";
        show("caError");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
