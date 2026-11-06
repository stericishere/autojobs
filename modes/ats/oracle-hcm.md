# ATS playbook: Oracle HCM Candidate Experience (`*.oraclecloud.com/hcmUI/CandidateExperience`)

No password: email + a one-time code sent by email (expires in ~10 minutes).

- Go straight to `.../job/{id}/apply/email`, enter the email, tick the terms checkbox
  (`#legal-disclaimer-checkbox`), Next. The user reads the code from their inbox, or the
  agent reads it if a mail connector is available. Enter it promptly.
- Some sites request browser location: that permission prompt is the user's (Block is fine).
- Comboboxes: type, then mouse-click the matching `[role=gridcell]`/`[role=option]`. A DOM
  `.click()` does not commit the value; verify the input value afterwards.
- Yes/No questions are "pill" radio groups (`[role=radiogroup]` with `aria-label` = question):
  click the option element by coordinates.
- Education and experience are added through "ADD EDUCATION" / "ADD EXPERIENCE" dialogs; use
  `application.education` and `application.experience`. Province/state fields appear only
  after the country is set.
