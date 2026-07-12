# Signup confirmation email — setup guide

## What was fixed in code (already done, needs your pull/push)

1. **New page: `confirm-account.html`.** This is the actual fix for "opening the email link logged me straight into the account." Supabase's default confirmation link (`{{ .ConfirmationURL }}`) verifies the account *and* logs you in the instant it's opened — before any page or button gets a chance to render. There's no way to add a manual confirm step on top of that link; the only way to get a genuine "click here to confirm" step is to stop using that link entirely and drive verification ourselves. That's what this page does: the email now links to `confirm-account.html?token_hash=...&type=signup`, which shows a plain "Confirm my account" button and does **nothing** until it's clicked. Only the click calls Supabase's `verifyOtp()`. Since `verifyOtp()` still hands back a live session (that's built into the API, not something we can turn off), the page immediately signs that session back out and sends you to the login page — so you land on login and have to type your credentials, rather than being silently signed in.
2. **"Email verified" modal on the login page**, shown after the confirm step above completes: a green checkmark, "Email verified," and a message telling you to log in with the credentials you created.

That part is done and committed. What's below is the part I can't do for you — the confirmation **email**'s subject and HTML body live in the Supabase Dashboard, not in this codebase.

## What to do in the Supabase Dashboard

1. Go to **Authentication → Emails** in your `sea-v` project and open the **Confirm signup** template.
2. Set the **Subject** to:
   ```
   Confirm your SEA-V account
   ```
3. Replace the **Message body** with the HTML below. The important part is the button/link — it now points at `confirm-account.html` using `{{ .SiteURL }}` and `{{ .TokenHash }}` instead of Supabase's `{{ .ConfirmationURL }}`. Don't change those template variables.
4. Save.
5. **Check your Site URL is correct:** go to **Authentication → URL Configuration → Site URL** and confirm it's set to `https://www.sea-v.com` (no trailing slash). The email link is built as `{{ .SiteURL }}/confirm-account.html?...`, so if Site URL is wrong or blank, the link in the email will be broken. I can't check this setting from here — only you can see it in the dashboard.

(The "Redirect URLs" allow-list you may remember from before doesn't matter for this flow — that only governs `{{ .ConfirmationURL }}`, which we're no longer using. The new link goes straight to your site and calls `verifyOtp()` directly, so there's nothing else to allow-list.)

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
                  Activate your account
                </h1>
                <p style="margin:0 0 20px; color:#334155; font-size:15px; line-height:1.6;">
                  Thanks for signing up for SEA-V — the digital career platform for yacht crew. Continue
                  below to confirm your account and start building your maritime career profile.
                </p>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td style="padding:8px 32px 32px;" align="center">
                <a href="{{ .SiteURL }}/confirm-account.html?token_hash={{ .TokenHash }}&type=signup&email={{ .Email }}"
                   style="display:inline-block; padding:14px 34px; background-color:#2d7cff; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:999px;">
                  Continue to confirm account
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
                  {{ .SiteURL }}/confirm-account.html?token_hash={{ .TokenHash }}&type=signup&email={{ .Email }}
                </p>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:20px 32px 28px; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                  This link is single-use and will expire for your security. Opening it will not sign
                  you in automatically — you'll be asked to confirm on the SEA-V site, then log in
                  with your own credentials. If you didn't create a SEA-V account, you can safely
                  ignore this email — no account will be created.
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
- The plain-text fallback link and the security note are both standard practice for transactional auth emails. The security note now also explains the new behaviour up front (no auto sign-in) so it isn't a surprise.
- Button copy says "Continue to confirm account," not "Verify" or "Confirm" — the actual confirming click happens on `confirm-account.html`, not in the email. That distinction matters: an email client or security scanner that pre-opens links in the background can't accidentally confirm the account, since opening the link alone does nothing.

## What I didn't touch

Supabase has separate templates for **Reset Password**, **Magic Link**, **Change Email**, and **Reauthentication** — all still on Supabase's generic default. You only asked about the signup confirmation one, so I left those alone. Reset Password in particular is a real account-holder-facing email worth the same branded treatment eventually — happy to draft that one whenever you want it.
