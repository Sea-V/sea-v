// /js/contact.js — wires up the contact.html form
//
// The form's action="mailto:...&method="post" was relying entirely on the
// browser's native support for POST-submitting a form to a mailto: URL.
// Most current browsers (Chrome in particular) don't support that at all —
// clicking "Send message" silently does nothing: no navigation, no mail
// client opens, no error shown. Firefox/Safari support it inconsistently.
// This intercepts the submit and builds the mailto: link in JS instead,
// the same technique already used by js/certificates-export.js for the
// "Email certificate summary" action, which is known to work reliably.
(function () {
  "use strict";

  const form = document.querySelector(".legal-contact-form");
  if (!form) return;

  const RECIPIENT = "admin@sea-v.com";

  function fieldValue(name) {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value.trim() : "";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = fieldValue("name");
    const email = fieldValue("email");
    const subjectInput = fieldValue("subject");
    const message = fieldValue("message");

    if (!name || !email || !subjectInput || !message) {
      // Native "required" validation should already block this, but bail
      // out safely if the handler ever runs before that (e.g. a future
      // markup change removes the required attributes).
      return;
    }

    const subject = encodeURIComponent(subjectInput);
    const body = encodeURIComponent(
      `From: ${name} <${email}>\n\n${message}`
    );

    const mailtoUrl = `mailto:${RECIPIENT}?subject=${subject}&body=${body}`;

    // mailto: only works if the visitor has a desktop mail client
    // configured — plenty of people (webmail-only users, Chromebooks,
    // work machines) don't. Always show the direct address so there's a
    // manual fallback regardless of whether the mail client actually opens.
    if (window.Seav?.notify) {
      window.Seav.notify(
        "success",
        "Opening your email app…",
        `If nothing happens, email us directly at ${RECIPIENT}.`
      );
    }

    window.location.href = mailtoUrl;
  });
})();
