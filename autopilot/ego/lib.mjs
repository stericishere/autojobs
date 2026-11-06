// autopilot/ego/lib.mjs — shared plumbing for the Ego Lite (ego-browser) drivers.
//
// Use from an ego-browser script:
//   const { inject } = await import(`${process.cwd()}/autopilot/ego/lib.mjs`);
//   const task = await taskSpace("autojobs apply"); const p = task.page("p1");
//   await inject(p, "greenhouse");
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'page');
const wait = (p, ms) => p.waitForTimeout(ms);

// Load common.js plus the named ATS helpers into the page. Safe to call again after navigation.
export async function inject(p, ...names) {
  for (const n of ['common', ...names]) await p.evaluate(readFileSync(join(PAGE_DIR, `${n}.js`), 'utf8'));
}

export async function clickAt(p, pt, label) {
  if (!pt || pt.x === undefined) return false;
  await wait(p, 200);
  await p.mouse.click(pt.x, pt.y, label ? { label } : undefined);
  return true;
}

// Center an element (selector or id) and mouse-click it. Avoids sticky footers that intercept p.click().
export async function clickCenter(p, selector, label) {
  return clickAt(p, await p.evaluate((s) => window.__aj.center(s), selector), label);
}

// Workday-style listbox <button aria-haspopup=listbox id=...>: open, click the option, verify, fall back to keys.
export async function pickListbox(p, id, want) {
  await p.keyboard.press('Escape');
  await clickCenter(p, `[id="${id}"]`, 'open dropdown');
  await wait(p, 900);
  const pt = await p.evaluate((w) => window.__aj.optionAt(w), want);
  if (pt.missing) {
    await p.keyboard.press('Escape');
    return { ok: false, id, want, options: pt.options };
  }
  await clickAt(p, pt, pt.text);
  await wait(p, 700);
  let got = await p.evaluate((i) => window.__aj.text(document.getElementById(i)), id);
  if (got !== pt.text) got = await keyPick(p, id, pt.text);
  return { ok: got === pt.text, id, want: pt.text, got };
}

// Keyboard selection: focus, open, type the label prefix, Enter. Works when a stale listbox swallows mouse clicks.
export async function keyPick(p, id, prefix) {
  await p.keyboard.press('Escape');
  await p.focus(`[id="${id}"]`);
  await p.keyboard.press('Enter');
  await wait(p, 900);
  await p.keyboard.type(prefix, { delay: 60 });
  await wait(p, 600);
  await p.keyboard.press('Enter');
  await wait(p, 800);
  return p.evaluate((i) => window.__aj.text(document.getElementById(i)), id);
}

// Portal password from the OS keychain (macOS `security`). Never logged, never written to disk.
export function keychainPassword(service, account) {
  if (process.platform !== 'darwin') throw new Error('Keychain lookup is macOS-only; sign in by hand on this platform.');
  return execFileSync('/usr/bin/security', ['find-generic-password', '-a', account, '-s', service, '-w'], { encoding: 'utf8' }).trim();
}
