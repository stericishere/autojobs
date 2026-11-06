# ATS playbook: iCIMS (`careers-*.icims.com`, `*.icims.com/jobs/...`)

Account per company (email + password). The form lives in an iframe
(`#icims_content_iframe`); some sections (self-ID) sit in a nested cross-origin iframe.

- Work in the frame: query `iframe.contentDocument` for fields. For cross-origin frames you
  cannot read, take a screenshot and click by coordinates.
- Dropdowns are "Type to Search" widgets (`a[aria-label=...]` opening `li[id^=result-selectable]`):
  click the widget, optionally type, click the option. Coordinates = iframe rect + element rect.
- Required "languages" style multi-selects may need the decline option if the profile has
  no value.
- The e-signature checkbox resets after any validation error: re-tick it before every
  submit attempt.
- Each step has its own Submit/Next button inside the frame.
