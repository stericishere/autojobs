# ATS playbook: other UI kits seen on company-hosted forms

## Gravity UI selects (e.g. careers pages built with `g-select-control`)

- The button has `aria-controls="select-popup-{id}"` once opened. Read and click options only
  inside that popup: closed popups stay in the DOM and options from them get clicked by
  mistake otherwise.
- Multi-selects stay open after a click; selecting the same option again toggles it off.
  Verify the button text after every pick. To reset, use the field's clear button
  (`[data-qa=select-clear]`).
- Filterable selects (phone country) focus a filter input on open: type, then click the
  option in the popup.

## Eightfold (Microsoft and others)

- Typing into a combobox does not select. Open with ArrowDown or a click, type, then
  mouse-click the option in `[role=option]`.
- The sticky footer intercepts clicks: center before clicking.

## Taleo

- Account per company. Long multi-page flow; cover letters are often a required text box.
  Draft the letter with the `cover` mode and show it to the user before pasting.

## Any unknown ATS

Use `autopilot/page/common.js`: `window.__aj.labelOf`, `center`, `optionAt`, `errors`.
Read the whole form before filling, batch the open questions to the user once, and keep the
review gate.
