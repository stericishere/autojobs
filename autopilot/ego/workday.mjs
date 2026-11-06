// autopilot/ego/workday.mjs — Workday candidate flow driven from config/profile.yml.
//
// run() signs in (or creates the account), fills My Information and My Experience,
// answers question pages by rule, handles self-identification, and STOPS on the
// Review page. It returns { step, todo?, err? } as soon as a human is needed.
// Submitting is a separate call (submit) the autopilot mode makes only after review.
import { inject, clickAt, clickCenter, pickListbox, keyPick, keychainPassword } from './lib.mjs';
import { buildRules, pickOption, textAnswer, eeoChoice, identity, portalLogin } from '../answers.mjs';

const w = (p, ms) => p.waitForTimeout(ms);
const page = async (p) => {
  await inject(p, 'workday');
  return { step: await p.evaluate(() => window.__aj.wd.step()), text: await p.evaluate(() => window.__aj.wd.pageText()) };
};

export async function next(p) {
  await inject(p, 'workday');
  await clickAt(p, await p.evaluate(() => window.__aj.wd.nextAt()), 'next');
  await w(p, 6000);
  await inject(p, 'workday');
  return (await p.evaluate(() => window.__aj.wd.errors())).filter((e) => !/successfully uploaded/i.test(e));
}

async function typeInto(p, selector, value) {
  if (!value || !(await p.evaluate((s) => !!document.querySelector(s), selector))) return;
  await p.fill(selector, String(value));
}

// Sign in with the keychain password; create the account when the tenant has none yet.
export async function signIn(p, profile) {
  const { email, service } = portalLogin(profile);
  const pw = keychainPassword(service, email);
  const sel = (id) => `[data-automation-id=${id}]`;
  if (!(await p.evaluate(() => !!document.querySelector('[data-automation-id=verifyPassword]')))) {
    await p.fill(sel('email'), email);
    await p.fill(sel('password'), pw);
    // Some tenants put a transparent click_filter over the real button.
    if (!(await clickCenter(p, sel('click_filter')))) await clickCenter(p, sel('signInSubmitButton'));
    await w(p, 8000);
    if (!(await p.evaluate(() => !!document.querySelector('[data-automation-id=signInSubmitButton]')))) return 'signed in';
    await p.evaluate(() => [...document.querySelectorAll('button,a')].find((e) => /Create Account/.test(e.innerText))?.click());
    await w(p, 2500);
  }
  await p.fill(sel('email'), email);
  await p.fill(sel('password'), pw);
  await p.fill(sel('verifyPassword'), pw);
  await p.evaluate(() => {
    const c = document.querySelector('[data-automation-id=createAccountCheckbox]');
    if (c && !c.checked) c.click();
  });
  if (!(await clickCenter(p, sel('createAccountSubmitButton')))) await clickCenter(p, sel('click_filter'));
  await w(p, 8000);
  // Account creation may require email verification: the mode tells the user to open the link.
  return 'account created (check email for a verification link)';
}

export async function start(p, url, profile, { useLast = false } = {}) {
  await p.goto(url.replace(/\/$/, '') + (useLast ? '/apply/useMyLastApplication' : '/apply/applyManually'));
  await w(p, 7000);
  for (let i = 0; i < 10; i++) {
    if (await p.evaluate(() => !!document.querySelector('[data-automation-id=password]'))) return signIn(p, profile);
    if (await p.evaluate(() => !!document.getElementById('source--source'))) return 'already signed in';
    await p.evaluate(() => [...document.querySelectorAll('button,a')].find((e) => /^Sign in with email$/i.test(e.innerText.trim()))?.click());
    await w(p, 2000);
  }
  return 'no sign-in form found';
}

// "How did you hear about us": first option matching the profile's preferences.
async function source(p, profile) {
  const prefs = (profile.application?.how_heard || ['Job Board', 'Internet', 'Website', 'Other']).map((s) => new RegExp(s, 'i'));
  const isButton = await p.evaluate(() => document.getElementById('source--source')?.tagName === 'BUTTON');
  if (isButton) {
    await clickCenter(p, '#source--source');
    await w(p, 900);
    const opts = await p.evaluate(() => window.__aj.wd.openOptions());
    await p.keyboard.press('Escape');
    for (const re of prefs) {
      const m = opts.find((o) => re.test(o));
      if (m) return pickListbox(p, 'source--source', m);
    }
    return { ok: false, id: 'source', options: opts };
  }
  // Prompt (multi-level) version: click a matching category, then a matching child if one appears.
  await clickCenter(p, '#source--source');
  await w(p, 1800);
  const top = await p.evaluate(() => window.__aj.wd.promptOptions());
  for (const re of prefs) {
    const m = top.find((o) => re.test(o));
    if (!m) continue;
    await p.evaluate((t) => [...document.querySelectorAll('[data-automation-id=promptOption]')].find((e) => e.innerText.trim() === t)?.click(), m);
    await w(p, 1500);
    const sub = await p.evaluate(() => window.__aj.wd.promptOptions());
    const child = sub.join() !== top.join() && prefs.map((r) => sub.find((o) => r.test(o))).find(Boolean);
    if (child) await p.evaluate((t) => [...document.querySelectorAll('[data-automation-id=promptOption]')].find((e) => e.innerText.trim() === t)?.click(), child);
    await p.keyboard.press('Escape');
    return { ok: true, id: 'source', got: child ? `${m} > ${child}` : m };
  }
  await p.keyboard.press('Escape');
  return { ok: false, id: 'source', options: top };
}

export async function myInformation(p, profile) {
  const me = identity(profile);
  const a = me.address;
  const out = [await source(p, profile)];
  await typeInto(p, '#name--legalName--firstName', me.first);
  await typeInto(p, '#name--legalName--lastName', me.last);
  if (me.preferred) {
    await p.evaluate(() => {
      const c = document.getElementById('name--preferredCheck');
      if (c && !c.checked) c.click();
    });
    await w(p, 1000);
    await typeInto(p, '#name--preferredName--firstName', me.preferred);
    await typeInto(p, '#name--preferredName--lastName', me.last);
  }
  await typeInto(p, '#address--addressLine1', a.line1);
  await typeInto(p, '#address--city', a.city);
  await typeInto(p, '#address--postalCode', a.postal_code);
  await typeInto(p, '#phoneNumber--phoneNumber', me.phone);
  for (const lb of await p.evaluate(() => window.__aj.wd.listboxes())) {
    if (/countryRegion/.test(lb.id) && a.region && lb.value !== a.region) out.push(await pickListbox(p, lb.id, a.region));
    if (/phoneType/.test(lb.id) && !lb.value) out.push({ id: lb.id, got: await keyPick(p, lb.id, me.phoneType) });
  }
  return out;
}

async function typeDate(p, base, yyyymm) {
  if (!yyyymm) return;
  const [y, m] = String(yyyymm).split('-');
  const box = (await p.evaluate((b) => !!document.getElementById(`${b}Month-display`), base)) ? `${base}Month-display` : `${base}Month-input`;
  if (!(await clickCenter(p, `[id="${box}"]`))) return;
  await p.keyboard.type(m + y, { delay: 70 });
}

async function addBlock(p, section) {
  const pt = await p.evaluate((s) => {
    const b = [...document.querySelectorAll('button')].filter((x) => window.__aj.visible(x) && /^(Add|Add Another)$/.test(x.innerText.trim()));
    const t = b.find((x) => new RegExp(s).test(x.getAttribute('aria-label') || '')) || b.find((x) => new RegExp(`^${s}`).test(x.closest('[role=group],section,div[data-automation-id]')?.innerText.trim() || ''));
    return t ? window.__aj.center(t) : null;
  }, section);
  await clickAt(p, pt, `add ${section}`);
  await w(p, 1800);
}

export async function myExperience(p, profile, resume) {
  const a = profile.application || {};
  const out = [];
  const have = await p.evaluate(() => [...document.querySelectorAll("input[id$='--jobTitle']")].filter((e) => e.value).length);
  if (!have) {
    for (const job of a.experience || []) {
      await addBlock(p, 'Work Experience');
      const n = await p.evaluate(() => [...document.querySelectorAll("input[id$='--jobTitle']")].filter((e) => !e.value).map((e) => e.id.match(/workExperience-(\d+)/)?.[1])[0]);
      if (!n) { out.push(`could not add ${job.company}`); continue; }
      const id = (k) => `[id="workExperience-${n}--${k}"]`;
      await typeInto(p, id('jobTitle'), job.title);
      await typeInto(p, id('companyName'), job.company);
      await typeInto(p, id('location'), job.location);
      if (!job.end) await p.evaluate((s) => document.querySelector(s)?.click(), id('currentlyWorkHere'));
      await typeDate(p, `workExperience-${n}--startDate-dateSection`, job.start);
      if (job.end) await typeDate(p, `workExperience-${n}--endDate-dateSection`, job.end);
      await typeInto(p, id('roleDescription'), job.description);
      out.push(`added ${job.company}`);
    }
  }
  const edu = a.education || {};
  if (edu.school && !(await p.evaluate(() => document.querySelector('[id^=education-]')))) await addBlock(p, 'Education');
  const pre = await p.evaluate(() => document.querySelector('[id^=education-]')?.id.match(/^education-\d+/)?.[0]);
  if (pre && edu.school) {
    const ids = await p.evaluate((x) => [...document.querySelectorAll(`[id^=${x}]`)].map((e) => e.id), pre);
    const school = ids.find((i) => /--schoolName$/.test(i)) || ids.find((i) => /--school$/.test(i));
    if (school) {
      await p.fill(`[id="${school}"]`, edu.school);
      await p.press(`[id="${school}"]`, 'Enter').catch(() => {});
      await w(p, 2500);
      await p.evaluate((s) => [...document.querySelectorAll('[data-automation-id=promptOption]')].find((e) => e.innerText.trim().startsWith(s))?.click(), edu.school);
      await w(p, 800);
    }
    if (edu.degree && ids.includes(`${pre}--degree`)) out.push(await pickListbox(p, `${pre}--degree`, edu.degree));
    if (edu.gpa && ids.includes(`${pre}--gradeAverage`)) await typeInto(p, `[id="${pre}--gradeAverage"]`, edu.gpa);
    const yr = (k, v) => v && ids.includes(`${pre}--${k}-dateSectionYear-input`) && p.focus(`[id="${pre}--${k}-dateSectionYear-input"]`).then(() => p.keyboard.type(String(v).slice(0, 4), { delay: 60 }));
    await yr('firstYearAttended', edu.start);
    await yr('lastYearAttended', edu.end);
    out.push('education filled');
  }
  await p.evaluate(() => document.querySelectorAll('button[data-automation-id=delete-file]').forEach((x) => x.click()));
  await w(p, 1500);
  await p.setInputFiles('input[type=file] >> nth=0', [resume]);
  await w(p, 5000);
  out.push('resume attached');
  return out;
}

// Answer every visible listbox / radio group / text box on a question page. Returns what still needs a human.
export async function answerPage(p, profile, company) {
  const rules = buildRules(profile, { company });
  const out = [];
  const todo = [];
  for (const lb of await p.evaluate(() => window.__aj.wd.listboxes())) {
    if (lb.value) continue;
    await clickCenter(p, `[id="${lb.id}"]`);
    await w(p, 900);
    const opts = await p.evaluate(() => window.__aj.wd.openOptions());
    await p.keyboard.press('Escape');
    const m = pickOption(rules, lb.question, opts);
    if (m) out.push(await pickListbox(p, lb.id, m));
    else todo.push({ ...lb, options: opts });
  }
  for (const g of await p.evaluate(() => window.__aj.wd.radioGroups())) {
    if (g.checked) continue;
    const m = pickOption(rules, g.question, g.options);
    if (m) out.push({ radio: g.question.slice(0, 60), got: m, ok: await p.evaluate(([n, l]) => window.__aj.wd.checkRadio(n, l), [g.name, m]) });
    else todo.push(g);
  }
  for (const t of await p.evaluate(() => window.__aj.wd.emptyTexts())) {
    const v = textAnswer(profile, t.question);
    if (v) { await p.fill(`[id="${t.id}"]`, v); out.push({ text: t.question.slice(0, 60), got: v }); }
    else todo.push(t);
  }
  return { out, todo };
}

const EEO_IDS = [['gender', 'gender'], ['ethnicity', 'race'], ['hispanicOrLatino', 'hispanic'], ['veteranStatus', 'veteran']];
export async function selfIdentify(p, profile) {
  const out = [];
  for (const lb of await p.evaluate(() => window.__aj.wd.listboxes())) {
    const kind = EEO_IDS.find(([k]) => lb.id.includes(k))?.[1];
    if (!kind) continue;
    await clickCenter(p, `[id="${lb.id}"]`);
    await w(p, 900);
    const opts = await p.evaluate(() => window.__aj.wd.openOptions());
    await p.keyboard.press('Escape');
    const m = eeoChoice(profile, kind, opts);
    out.push(m ? await pickListbox(p, lb.id, m) : { ok: false, id: lb.id, options: opts });
  }
  if (profile.application?.accept_terms === true) {
    await p.evaluate(() => {
      const c = document.getElementById('termsAndConditions--acceptTermsAndAgreements');
      if (c && !c.checked) c.click();
    });
  }
  return out;
}

// CC-305 disability form: signature name, today's date, and the profile's disability answer (blank → decline).
export async function disability(p, profile) {
  const me = identity(profile);
  await typeInto(p, '#selfIdentifiedDisabilityData--name', `${me.first} ${me.last}`.trim());
  const d = new Date();
  const mmddyyyy = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + d.getFullYear();
  if (await clickCenter(p, '[id="selfIdentifiedDisabilityData--dateSignedOn-dateSectionMonth-input"]')) {
    for (let i = 0; i < 10; i++) await p.keyboard.press('Backspace');
    await p.keyboard.type(mmddyyyy, { delay: 80 });
    await p.keyboard.press('Tab');
  }
  const labels = await p.evaluate(() => [...document.querySelectorAll('input[type=checkbox][id$=disabilityStatus]')].map((x) => window.__aj.labelOf(x)));
  const m = eeoChoice(profile, 'disability', labels);
  if (m) await p.evaluate((l) => [...document.querySelectorAll('input[type=checkbox][id$=disabilityStatus]')].find((x) => window.__aj.labelOf(x) === l)?.click(), m);
  return m || 'disability: no matching option';
}

// Drive from the current page to Review. Stops early with { step, todo } or { step, err }.
export async function run(p, { url, profile, resume, company = '', useLast = false, log = () => {} }) {
  log(await start(p, url, profile, { useLast }));
  for (let i = 0; i < 10; i++) {
    const { step } = await page(p);
    log(`step: ${step || '?'}`);
    if (/^Review/i.test(step)) return { step: 'Review' };
    if (/My Information/i.test(step)) (await myInformation(p, profile)).forEach((x) => log(x));
    else if (/My Experience/i.test(step)) (await myExperience(p, profile, resume)).forEach((x) => log(x));
    else if (/Voluntary Disclosures/i.test(step)) (await selfIdentify(p, profile)).forEach((x) => log(x));
    else if (/Self Identify|Disability/i.test(step)) log(await disability(p, profile));
    else {
      const { out, todo } = await answerPage(p, profile, company);
      out.forEach((x) => log(x));
      if (todo.length) return { step, todo };
    }
    const err = await next(p);
    if (err.length) return { step, err };
  }
  return { step: 'loop limit' };
}

// Submit from the Review page. Only called when autopilot.auto_submit is true or the user said "submit".
export async function submit(p) {
  const err = await next(p);
  return { url: await p.url(), err };
}
