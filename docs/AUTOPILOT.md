# Autopilot guide

Autopilot is the autojobs layer on top of career-ops: it collects new roles from your
sources, evaluates them, tailors a CV, and fills the application forms through a real
browser. It stops on each review page for you unless you turn on `auto_submit`.

```
sources ──► data/pipeline.md ──► evaluate ──► tailored PDF ──► fill form ──► review gate ──► tracker
 simplify                          (score)                      (browser)    (you / auto)
 stories
```

## 1. Set up

```bash
git clone https://github.com/stericishere/autojobs && cd autojobs
npm install
npx playwright install chromium    # used for PDF rendering
npm run setup                      # = node init.mjs
```

`init` creates your private files (`config/profile.yml`, `portals.yml`, `modes/_profile.md`,
`modes/_custom.md`, `data/*`) from the templates, then asks for:

- contact details, target roles and the term to scan;
- US work authorization and sponsorship (blank = the agent asks you on each form);
- browser backend, auto-submit (default off), Instagram story sources;
- education (school, degree, field, dates, optional GPA) and work history, one job at a time;
- your existing CV: a `.md` file becomes `cv.md`; a PDF, DOCX or TXT is copied to
  `documents/cv/` for the agent to convert.

It never overwrites a file that exists (rerunning it is safe; if `config/profile.yml` already
exists it skips the profile questions), and every file it writes is git-ignored, so your data
stays on your machine. **Leave anything you are unsure about blank**: blank means the agent asks
you instead of guessing.

Then:

1. Optional: fill the rest of the `application:` block in `config/profile.yml` (address, EEO
   answers, relocation, how you heard about roles).
2. Start your agent in the folder (`claude`, or `claude --chrome` for the Chrome backend).
   If you gave a PDF/DOCX CV, say **"run intake"** and it builds `cv.md` from it with you; with no
   CV at all, it builds one with you from a paste, a LinkedIn URL or a conversation.
3. Say **"run autopilot"**.

## 2. Pick a browser

| | Ego Lite (`autopilot.browser: ego`) | Chrome (`autopilot.browser: chrome`) |
|---|---|---|
| What | Agent-friendly Chromium with a CLI, `ego-browser` | Your own Chrome through the Claude in Chrome extension |
| Install | https://lite.ego.app, finish onboarding (puts `ego-browser` on PATH) | Chrome Web Store → "Claude", sign in (Pro, Max, Team or Enterprise plan) |
| Start | `claude` | `claude --chrome`, or `/chrome` inside a session |
| Form filling | Scripted drivers (`autopilot/ego/*.mjs`): Greenhouse and Workday end to end | Agent-driven: reads the page, fills fields, clicks options, following `modes/ats/*.md` |
| Scheduled / headless runs | Yes | No (needs an interactive session and per-site approval) |
| Resume upload | `setInputFiles` | Extension file upload; the agent checks the file landed and asks you if not |

Both use the same answers (`autopilot/answers.mjs`) and the same page helpers
(`autopilot/page/*.js`), so switching is one line in `config/profile.yml`.

Ego Lite is a separate browser profile: sign in to Instagram (for story sources) and to any job
portal you already have accounts on inside it. With Chrome, your existing sign-ins are used.

## 3. Sources

- **SimplifyJobs** (`autopilot.sources.simplify`): `npm run scan:simplify`. Zero LLM cost. Set the
  repo (internships or new grad), terms, locations and excluded companies.
- **Instagram stories** (`autopilot.sources.stories.instagram`): creators who post job lists. The
  agent captures each frame, reads it, and resolves every job to its official posting before
  anything is evaluated. Use only accounts you can view, and respect Instagram's terms.
- Everything career-ops already scans (`portals.yml`, `npm run scan`) feeds the same pipeline.

## 4. Safety rails (defaults)

- `auto_submit: false`: the agent stops on every review page. You submit, or say "submit it".
- With `auto_submit: true`, a form is submitted only when every field was answered from your
  profile: no open questions, no guesses, resume attached.
- Export control / ITAR / clearance / "citizenship in the listed countries" questions are always
  yours. Salary numbers are never entered unless you give one for that posting.
- Roles under `autopilot.min_score` (default 4.0) are reported, not applied to.
- Passwords live only in the macOS Keychain (`security add-generic-password -a <email> -s autojobs-portals -w`).
  CAPTCHAs, email codes and browser permission prompts are handed to you.
- Every question and answer is logged to `data/answer-bank.md`.

Quality over volume: apply where you fit. Recruiters remember spam.

## 5. Scheduling (Ego Lite only)

A scheduled run collects and evaluates; it never fills forms. Example `crontab -e` line for 1pm
daily:

```
0 13 * * * cd /path/to/autojobs && claude -p "Run career-ops autopilot steps 1-2 (collect and evaluate only)" >> data/autopilot/cron.log 2>&1
```

See `docs/AUTOMATION.md` for launchd and Windows recipes. Fill the queued roles later in an
interactive session.

## 6. Adding an ATS

1. Write `modes/ats/<ats>.md` with the quirks you hit (what breaks, what works).
2. If it is worth scripting, add browser-side helpers in `autopilot/page/<ats>.js` (no Node APIs;
   return data and coordinates) and an ego driver in `autopilot/ego/<ats>.mjs` that answers from
   `autopilot/answers.mjs` and returns `{ answered, todo }` without submitting.
3. Add the answer rules you needed to `buildRules` with a test in `tests/autopilot-answers.test.mjs`.
