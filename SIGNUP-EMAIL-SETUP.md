# Signup confirmation email — setup guide

## What was fixed in code (already done, needs your pull/push)

1. **`emailRedirectTo` now includes `?confirmed=1`.** The confirmation link Supabase emails out redirects back to `index.html`. There was already code in `js/index.js` waiting for a `?confirmed=1` flag to show a nice message — it just never received it, because `js/auth.js` was building the redirect URL without it. Now fixed.
2. **New "Email verified" modal on the login page.** Instead of a small line of text, clicking the confirmation link now opens a proper modal: a green checkmark, "Email verified," a short message telling the person to log in with the credentials they created, and a "Continue to login" button. It matches the site's existing modal styling (same one used for the About/Contact popups).

That part is done and committed. What's below is the part I can't do for you — Supabase's actual confirmation **email** (subject line and HTML body) is configured in the Supabase Dashboard, not in this codebase, so there's no file for me to edit or commit.

## Why the email currently looks generic

Right now the "Confirm signup" email is Supabase's out-of-the-box default template — plain text, no branding, sent with a generic subject like "Confirm your signup." That's what you're seeing. Below is a replacement that matches SEA-V's branding.

## What to do in the Supabase Dashboard

1. Go to **Authentication → Emails** (sometimes labelled "Email Templates") in your `sea-v` project.
2. Open the **Confirm signup** template.
3. Set the **Subject** to:
   ```
   Confirm your SEA-V account
   ```
4. Replace the **Message body** with the HTML below (this uses Supabase's `{{ .ConfirmationURL }}` variable, which Supabase fills in automatically — don't change that part).
5. Save.
6. **One more thing to check while you're in there:** go to **Authentication → URL Configuration → Redirect URLs** and confirm `https://www.sea-v.com/*` (or at least `https://www.sea-v.com/index.html`) is on the allow-list. The confirmation link won't work if the redirect URL isn't allow-listed — I can't check this setting from here, only you can see it in the dashboard.

## The email template

```html
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f6f9; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9; padding: 32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">

            <!-- Header -->
            <tr>
              <td style="background-color:#0b1c2e; padding:28px 32px; text-align:center;">
                <img src="https://www.sea-v.com/img/logo.png" width="44" height="44" alt="SEA-V" style="display:block; margin:0 auto 10px; border-radius:8px;" />
                <span style="color:#ffffff; font-size:19px; font-weight:700; letter-spacing:0.05em;">SEA-V</span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 16px; color:#0b1733; font-size:21px; font-weight:700; line-height:1.3;">
                  Confirm your email address
                </h1>
                <p style="margin:0 0 20px; color:#334155; font-size:15px; line-height:1.6;">
                  Thanks for signing up for SEA-V — the digital career platform for yacht crew. Confirm
                  your email address to activate your account and start building your maritime career
                  profile.
                </p>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td style="padding:8px 32px 32px;" align="center">
                <a href="{{ .ConfirmationURL }}"
                   style="display:inline-block; padding:14px 34px; background-color:#2d7cff; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:999px;">
                  Verify email address
                </a>
              </td>
            </tr>

            <!-- Fallback link -->
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0 0 6px; color:#64748b; font-size:12.5px; line-height:1.6;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0; word-break:break-all; color:#2d7cff; font-size:12.5px; line-height:1.6;">
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:20px 32px 28px; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                  This link is single-use and will expire for your security. If you didn't create a
                  SEA-V account, you can safely ignore this email — no account will be created.
                </p>
              </td>
            </tr>

          </table>

          <!-- Footer -->
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td align="center" style="padding: 0 32px;">
                <p style="margin:0; color:#94a3b8; font-size:11.5px; line-height:1.6;">
                  SEA-V — Maritime Career Platform for Yacht Crew<br />
                  <a href="https://www.sea-v.com" style="color:#94a3b8;">sea-v.com</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:admin@sea-v.com" style="color:#94a3b8;">admin@sea-v.com</a>
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
```

## Design notes

- Light background, not the app's dark navy theme — email clients apply their own dark-mode inversion to HTML emails, and a fully dark-styled email can render unpredictably (washed-out text, broken contrast) across Gmail/Outlook/Apple Mail. A light card with a navy header bar is the safer, more universally-professional choice for email specifically, even though it doesn't match the app's dark UI.
- Table-based layout with inline styles throughout — this isn't stylistic preference, it's a compatibility requirement. Outlook in particular ignores most CSS that isn't inline, and many clients strip `<style>` blocks entirely.
- The plain-text fallback link (in case the button doesn't render as clickable in some clients) and the "if you didn't request this, ignore it" line are both standard security/deliverability practice for transactional auth emails.

## What I didn't touch

Supabase has separate templates for **Reset Password**, **Magic Link**, **Change Email**, and **Reauthentication** — all still on Supabase's generic default. You only asked about the signup confirmation one, so I left those alone, but the same treatment (swap in a branded template like the one above, just with different heading/body copy) would make sense for Reset Password too, since that's also a real-account-holder-facing email. Happy to draft that one whenever you want it.
