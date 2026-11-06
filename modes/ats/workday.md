# ATS playbook: Workday (`*.myworkdayjobs.com`)

Account per tenant (email + password from the keychain). Driver: `autopilot/ego/workday.mjs`.

Steps: sign in or create account → My Information → My Experience → Application
Questions (one or more pages) → Voluntary Disclosures → Self Identify (disability) →
Review. `run()` handles all of them and stops at Review or the first open question.

Quirks that cost real time:

- **Sign-in.** Some tenants show "Sign in with email" first. Some cover the sign-in button
  with a transparent `[data-automation-id=click_filter]`: click that, not the button. A new
  account may need an email verification link: hand it to the user.
- **Sticky footer** intercepts clicks low on the page. Center the element, click by
  coordinates (`clickCenter`).
- **Listboxes** (`button[aria-haspopup=listbox]`) render options in a portal. A stale open
  listbox makes the next one read the wrong options: press Escape first, read options right
  after opening, and verify the button text after picking. `pickListbox` falls back to
  keyboard selection (focus, Enter, type prefix, Enter) when the mouse misses.
- **Prompts** (source, school, field of study) are search boxes: type, press Enter, click a
  `promptOption`. Some are two-level (category → child).
- **Scroll-locked pages.** If the page will not scroll, fill by focus + typing.
- **Dates** are segmented (month / year inputs): click the month segment and type `MMYYYY`.
- **Back navigation** from an edited page opens "Discard application?": save with Next first.
- **"Use my last application"** reuses the tenant profile; check every reused value.
- **Questions** like "held citizenship in any of the listed countries" or export control are
  always the user's. Experience-range questions use `application.years_experience_option`.
- Review the Review page text before handing off: source, education, websites, answers,
  disclosures.
