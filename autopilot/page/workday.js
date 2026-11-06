// autopilot/page/workday.js — Workday candidate flow, browser side. Load common.js first.
//
// Workday quirks these helpers exist for (see modes/ats/workday.md):
//   - listboxes are <button aria-haspopup=listbox>; options render in a portal and
//     an old one can stay open, so always read options right after opening;
//   - the sticky footer intercepts clicks near the bottom: use aj.center() coords.
(() => {
  const aj = window.__aj;
  const main = () => document.querySelector('main') || document.body;
  const fieldOf = (e) => e.closest('[data-automation-id^=formField]');
  aj.wd = {
    // The progress bar reads "current step 2 of 7" then the step name on its own line.
    step: () => (aj.wd.pageText().match(/current step \d+ of \d+ \| ([^|]+)/) || [])[1]?.trim() || '',
    pageText: () => (main().innerText || '').replace(/\n+/g, ' | '),
    hasSignIn: () => !!document.querySelector('[data-automation-id=password]'),
    isCreateAccount: () => !!document.querySelector('[data-automation-id=verifyPassword]'),
    // Unanswered-or-not, every visible listbox with its question text and current value.
    listboxes: () =>
      [...main().querySelectorAll('button[aria-haspopup=listbox]')].filter(aj.visible).map((b) => ({
        id: b.id,
        question: aj.text(fieldOf(b)?.querySelector('label,legend') || fieldOf(b)).slice(0, 400),
        value: aj.text(b).replace(/^Select One$/, ''),
      })),
    radioGroups: () => {
      const g = {};
      for (const r of main().querySelectorAll('input[type=radio]')) (g[r.name] ||= []).push(r);
      return Object.entries(g).map(([name, rs]) => ({
        name,
        question: aj.text(rs[0].closest('fieldset')?.querySelector('legend') || fieldOf(rs[0])).slice(0, 400),
        options: rs.map((r) => aj.labelOf(r)),
        checked: rs.find((r) => r.checked) ? aj.labelOf(rs.find((r) => r.checked)) : '',
      }));
    },
    checkRadio: (name, label) => {
      const r = [...document.querySelectorAll(`input[name="${CSS.escape(name)}"]`)].find((x) => aj.labelOf(x) === label);
      if (r && !r.checked) r.click();
      return !!r?.checked;
    },
    emptyTexts: () =>
      [...main().querySelectorAll('textarea, input[type=text]')]
        .filter((e) => aj.visible(e) && !e.value && !/source|dateSection/.test(e.id))
        .map((e) => ({ id: e.id, question: aj.text(fieldOf(e)?.querySelector('label') || fieldOf(e)).slice(0, 300) })),
    // Options of the listbox that is open right now (call after clicking its button).
    openOptions: () => [...document.querySelectorAll('[role=option]')].filter(aj.visible).map(aj.text).filter((t) => t !== 'Select One'),
    promptOptions: () => [...document.querySelectorAll('[data-automation-id=promptOption]')].filter(aj.visible).map(aj.text),
    nextAt: () => aj.center('[data-automation-id=pageFooterNextButton]'),
    errors: () => [...document.querySelectorAll('[data-automation-id=errorMessage],[data-automation-id*=errorHeading]')].map(aj.text).filter(Boolean),
  };
})();
