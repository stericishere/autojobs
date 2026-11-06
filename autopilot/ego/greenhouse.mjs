// autopilot/ego/greenhouse.mjs — fill a Greenhouse job-boards application from config/profile.yml.
//
// fill() never submits. It returns { answered, todo }: todo lists every field a human must
// answer (rule returned null, no matching option, or the question is unknown).
import { inject, clickAt, clickCenter } from './lib.mjs';
import { buildRules, pickOption, textAnswer, eeoChoice, identity } from '../answers.mjs';

const EEO = [
  [/gender/i, 'gender'],
  [/hispanic|latin/i, 'hispanic'],
  [/race|ethnic/i, 'race'],
  [/veteran/i, 'veteran'],
  [/disabilit/i, 'disability'],
];
const CORE = { first_name: 'first', last_name: 'last', preferred_name: 'preferred', email: 'email', phone: 'phone' };

async function pickSelect(p, id, decide, type = '') {
  await p.keyboard.press('Escape');
  await clickCenter(p, `[id="${id}"]`, 'open dropdown');
  await p.waitForTimeout(700);
  if (type) {
    await p.keyboard.type(type, { delay: 40 });
    await p.waitForTimeout(2000);
  }
  const options = await p.evaluate(() => window.__aj.gh.options());
  const want = decide(options);
  if (!want) {
    await p.keyboard.press('Escape');
    return { ok: false, options };
  }
  await clickAt(p, await p.evaluate((w) => window.__aj.gh.optionAt(w), want), want);
  await p.waitForTimeout(400);
  return { ok: true, value: want };
}

export async function fill(p, { profile, resume, company = '' }) {
  await inject(p, 'greenhouse');
  const me = identity(profile);
  const rules = buildRules(profile, { company });
  const answered = [];
  const todo = [];
  for (const f of await p.evaluate(() => window.__aj.gh.fields())) {
    if (f.kind === 'file') {
      if (f.id === 'resume' && !f.value) {
        await p.setInputFiles('#resume', [resume]);
        answered.push('resume attached');
      }
      continue;
    }
    if (f.value && f.kind !== 'checkbox') continue;
    // Phone country picker and the city typeahead: type to filter, take the first option that starts with it.
    const typed = { country: me.address.country, 'candidate-location': me.address.city }[f.id];
    if (typed !== undefined) {
      const r = typed ? await pickSelect(p, f.id, (opts) => opts.find((o) => o.startsWith(typed)), typed) : { ok: false };
      if (r.ok) answered.push(`${f.id} -> ${r.value}`);
      else todo.push({ ...f, options: r.options });
      continue;
    }
    if (CORE[f.id] && me[CORE[f.id]]) {
      await p.fill(`[id="${f.id}"]`, me[CORE[f.id]]);
      answered.push(`${f.id}`);
      continue;
    }
    if (f.kind === 'text') {
      const v = textAnswer(profile, f.label);
      if (v) {
        await p.fill(`[id="${f.id}"]`, v);
        answered.push(`${f.label.slice(0, 50)} = ${v}`);
      } else if (f.required) todo.push(f);
      continue;
    }
    if (f.kind === 'select') {
      const eeo = EEO.find(([re]) => re.test(f.label))?.[1];
      const r = await pickSelect(p, f.id, (opts) => (eeo ? eeoChoice(profile, eeo, opts) : pickOption(rules, f.label, opts)));
      if (r.ok) answered.push(`${f.label.slice(0, 50)} -> ${r.value}`);
      else if (f.required || eeo) todo.push({ ...f, options: r.options });
      continue;
    }
    if (f.required && (f.kind === 'checkbox' || f.kind === 'radio')) todo.push(f);
  }
  return { answered, todo };
}

// Click "Submit application" (twice if the first click only scrolls to an error). Call only after review.
export async function submit(p) {
  await inject(p, 'greenhouse');
  for (let i = 0; i < 2; i++) {
    await clickAt(p, await p.evaluate(() => window.__aj.gh.submitAt()), 'submit application');
    await p.waitForTimeout(i ? 7000 : 3000);
    await inject(p, 'greenhouse');
    if (await p.evaluate(() => window.__aj.gh.done())) return { ok: true, url: await p.url() };
  }
  return { ok: false, url: await p.url(), invalid: await p.evaluate(() => window.__aj.errors()) };
}
