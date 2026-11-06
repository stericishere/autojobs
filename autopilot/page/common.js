// autopilot/page/common.js — browser-side helpers shared by every ATS file.
//
// Runs INSIDE the page (no Node APIs). Both backends load it the same way:
//   ego:    await page.evaluate(readFileSync("autopilot/page/common.js", "utf8"))
//   chrome: paste the file into the javascript tool, then call window.__aj.*
//
// Helpers never click options themselves when a framework needs a trusted event;
// they return viewport coordinates and the backend clicks with a real mouse.
(() => {
  const aj = (window.__aj = window.__aj || {});
  aj.visible = (e) => !!e && (e.offsetParent !== null || e.getClientRects().length > 0);
  aj.text = (e) => (e?.innerText || e?.textContent || '').trim().replace(/\s+/g, ' ');
  aj.labelOf = (e) =>
    aj.text(document.querySelector(`label[for="${CSS.escape(e.id || '')}"]`)) ||
    e.getAttribute('aria-label') ||
    aj.text(e.closest('fieldset')?.querySelector('legend')) ||
    '';
  // Scroll the element to the middle of the viewport (clear of sticky headers/footers) and return its center.
  aj.center = (elOrSelector) => {
    const e = typeof elOrSelector === 'string' ? document.querySelector(elOrSelector) : elOrSelector;
    if (!e) return null;
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  };
  // Center of the visible option whose text equals `want` (else starts with it), or null with the choices.
  aj.optionAt = (want, selector = '[role=option]') => {
    const all = [...document.querySelectorAll(selector)].filter(aj.visible);
    const m = all.find((o) => aj.text(o) === want) || all.find((o) => aj.text(o).startsWith(want));
    return m ? { ...aj.center(m), text: aj.text(m) } : { missing: want, options: all.map(aj.text).slice(0, 30) };
  };
  // Set a React-controlled input's value so the framework sees the change.
  aj.setValue = (e, v) => {
    const proto = e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  };
  aj.errors = () =>
    [...document.querySelectorAll('[role=alert],[aria-invalid=true],[data-automation-id=errorMessage]')]
      .map((e) => e.id || aj.text(e))
      .filter(Boolean);
})();
