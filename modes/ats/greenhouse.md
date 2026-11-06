# ATS playbook: Greenhouse (job-boards.greenhouse.io, boards.greenhouse.io, embedded `?gh_jid=`)

No account. One page. Driver: `autopilot/ego/greenhouse.mjs` (`fill`, `submit`).

- Dropdowns are react-selects: click the field, then click the option element. Typing alone
  does not select. Some option lists are long single answers ("I agree", "I understand")
  rather than Yes/No, so read the options before choosing.
- `#country` is the phone country picker: type the country, pick "Canada +1" style option.
- `#candidate-location` is a city typeahead: type the city, pick "City, Region, Country".
- Checkbox groups ("How did you hear", "sources used to research us") are real checkboxes;
  an "Other" box usually reveals a required "please specify" text field.
- Employment/education blocks (`company-name-0`, `school--0`, month pickers) appear on some
  boards; month and degree fields are react-selects, years are plain inputs.
- Long forms with a sticky header: if a click is intercepted, center the element first
  (`window.__aj.center(...)`) and click its coordinates.
- Submit: the first click may only scroll to an error. `submit()` clicks again and checks for
  the confirmation page; `invalid` lists the fields still flagged.
- Company-hosted pages (`careers.company.com/job?gh_jid=`) may use their own UI kit
  (see `modes/ats/other.md`, Gravity UI) but post to Greenhouse.
