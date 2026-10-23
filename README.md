# PayPal AI Hackathon 2026

Working folder for the PayPal AI Hackathon on Devpost ("Build what's next with PayPal and AI").

- Hackathon page: https://paypalaihackathon.devpost.com/
- Official rules: https://paypalaihackathon.devpost.com/rules
- My submissions: https://devpost.com/submit-to/31302-paypal-ai-hackathon/manage/submissions
- PayPal Developer dashboard: https://developer.paypal.com/dashboard/

## Status (2026-10-23)

- Registered on Devpost as Dinesh417G, working solo.
- PayPal Developer account signed in. The sandbox REST app "Default Application" and two sandbox
  test accounts (one business, one personal, both India) were created automatically.
- No project idea chosen yet; nothing built.

## Deadline

12 Nov 2026, 12:00 PM PT = 13 Nov 2026, 01:30 IST.

## What has to be built

- A new app, or a meaningful update to an existing one, that integrates the PayPal developer
  platform (free sandbox) and an AI tool, model or platform. PayPal must be central and AI must
  do real work.
- Sponsor tools are optional (AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL,
  Postman, Render, Zapier); some carry their own prizes.

## Judging (equal weight)

Technological implementation (PayPal + AI, non-trivial and working), design (complete product,
not just a proof of concept), potential impact (specific problem, real audience), innovation,
presentation (video shows it end-to-end; problem, audience, why it matters).

## Prizes (from the official rules, 2026-10-23)

- 1st $12,000, 2nd $8,000, 3rd $5,000.
- $5,000 each: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal,
  Best Use of Agentic Commerce.
- Sponsor prizes, among others: AG Grid ($5,000 / $2,000 / 3 x $1,000), Bryntum (3 x $1,000),
  APIMatic (3 x $1,000 + subscription), Channel3 ($1,500), Render (credits).

## What has to be submitted

1. Text description of features and functionality.
2. Explanation of the tools used (which model or AI service, and how).
3. Public GitHub, GitLab or Bitbucket repo, open-source licence visible in the About section,
   with all source, assets and setup instructions.
4. Working demo: complete run instructions in the repo or a hosted URL. Mockups don't count.
   Put the sandbox test-account logins and keys judges need into the setup instructions
   (sandbox only, never the real PayPal login).
5. Demo video under 3 minutes, public on YouTube or Vimeo, showing it working, with no
   third-party copyrighted music.

## Setup checklist (checked 2026-10-23)

Ready:
- [x] Toolchain: git 2.51, Node 22.18, npm 11, pnpm 11, Python 3.13, Docker CLI 29.8, rtk.
- [x] GitHub CLI signed in as Dinesh417G (scopes repo, workflow).
- [x] Vercel CLI signed in as dinesh417g (team "dinesh417g's projects") for a hosted demo URL.
- [x] PayPal Developer sandbox: app "Default Application", IN business + IN personal test accounts.
- [x] Repo scaffolding: `.gitignore` (ignores `.env`), `.env.example`, MIT `LICENSE`,
      `scripts/check-setup.mjs`.

To do:
- [ ] Owner: copy the sandbox Client ID and Secret (Apps & Credentials > Sandbox > Default
      Application) into `D:\paypal\.env`, then run
      `node --env-file-if-exists=.env scripts/check-setup.mjs`. It should print "auth OK".
- [ ] Owner: in Sandbox > Accounts, create a **US business** and a **US personal** test account
      (PayPal does no India-domestic payments, so USD flows need US accounts).
- [ ] AI provider key: none on this PC. Choose with the concept: an Anthropic API key, or Vercel
      AI Gateway (no key on Vercel, `vercel env pull` locally).
- [ ] Public GitHub repo (`gh repo create`, MIT licence shows in About): needs the owner's go-ahead.
- [ ] Screen recorder: no OBS or ffmpeg. Windows Snipping Tool records the screen and Clipchamp
      edits; or install OBS with winget.
- [ ] YouTube channel to upload the demo video (owner's Google account).
- [ ] Concept-specific setup: PayPal APIs to enable, Agent Toolkit / MCP server, sponsor tools.
      Decide once the idea is fixed. Docker engine was not answering; start it only if needed.
