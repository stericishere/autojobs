// autopilot/page/greenhouse.js — Greenhouse job-boards form, browser side. Load common.js first.
(() => {
  const aj = window.__aj;
  const isSelect = (e) => !!e.closest('[class*=select__control]') || e.getAttribute('role') === 'combobox';
  aj.gh = {
    // Every form control: id, kind, label, current value. React-selects report their shown text.
    fields: () =>
      [...document.querySelectorAll('form input:not([type=hidden]), form textarea, form select')]
        // id-less inputs are react-select / phone-widget internals, not questions.
        .filter((e) => e.id && e.type !== 'search')
        .map((e) => ({
          id: e.id,
          name: e.name,
          kind: e.type === 'file' ? 'file' : e.type === 'checkbox' || e.type === 'radio' ? e.type : isSelect(e) ? 'select' : 'text',
          label: aj.labelOf(e).slice(0, 300),
          required: /\*\s*$/.test(aj.labelOf(e)) || e.required || e.getAttribute('aria-required') === 'true',
          value:
            e.type === 'checkbox' || e.type === 'radio'
              ? e.checked
              : e.type === 'file'
                ? e.files?.[0]?.name || ''
                : isSelect(e)
                  ? aj.text(e.closest('[class*=select__control]')).replace(/^Select\.\.\.$/, '')
                  : e.value,
        })),
    // Options currently shown by an open react-select (open it first by clicking the field).
    options: () => [...document.querySelectorAll('[class*=select__option]')].filter(aj.visible).map(aj.text),
    optionAt: (want) => aj.optionAt(want, '[class*=select__option]'),
    submitAt: () => aj.center([...document.querySelectorAll('button')].find((b) => /Submit application/i.test(aj.text(b)))),
    done: () => /confirmation|thank you for applying|received your application/i.test(location.href + document.body.innerText.slice(0, 1500)),
  };
})();
