#!/usr/bin/env node
/**
 * init.mjs — first-run setup for autojobs.
 *
 * Creates your user-layer files from the templates (never overwrites existing ones),
 * asks a few questions to fill config/profile.yml, picks the browser backend, checks
 * that backend's prerequisites, then runs the doctor.
 *
 *   node init.mjs                 interactive
 *   node init.mjs --yes           accept defaults (CI / scripted)
 *   node init.mjs --target DIR    set up a different checkout (used by tests)
 *
 * Your CV is not created here: start your agent (`claude`) afterwards and it will
 * walk you through cv.md (paste it, a LinkedIn URL, or a conversation).
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const ti = args.indexOf('--target');
const ROOT = resolve(ti >= 0 ? args[ti + 1] : dirname(fileURLToPath(import.meta.url)));
const at = (...p) => join(ROOT, ...p);

const COPIES = [
  ['config/profile.example.yml', 'config/profile.yml'],
  ['templates/portals.example.yml', 'portals.yml'],
  ['modes/_profile.template.md', 'modes/_profile.md'],
  ['modes/_custom.template.md', 'modes/_custom.md'],
];
const STUBS = {
  'data/applications.md': '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n',
  'data/pipeline.md': '# Pipeline\n\n',
  'data/answer-bank.md': '# Answer bank\n\nEvery application form question and the answer given, newest last.\n',
};

const rl = YES ? null : createInterface({ input: process.stdin });
// The async iterator buffers lines, so piped answers are not lost (rl.question drops lines that arrive early).
const lines = rl?.[Symbol.asyncIterator]();
async function ask(q, def = '') {
  if (YES) return def;
  process.stdout.write(`${q}${def ? ` [${def}]` : ''}: `);
  const { value, done } = await lines.next();
  if (!process.stdin.isTTY) process.stdout.write(`${done ? '' : value}\n`);
  return (done ? '' : value.trim()) || def;
}
const yaml = (s) => JSON.stringify(s); // a JSON string is a valid YAML scalar

function setLine(text, pattern, replacement) {
  if (!pattern.test(text)) throw new Error(`profile template changed: ${pattern} not found`);
  return text.replace(pattern, replacement);
}

async function main() {
  console.log('\nautojobs setup\n');
  const created = [];
  for (const [from, to] of COPIES) {
    if (existsSync(at(to)) || !existsSync(at(from))) continue;
    mkdirSync(dirname(at(to)), { recursive: true });
    copyFileSync(at(from), at(to));
    created.push(to);
  }
  for (const [file, body] of Object.entries(STUBS)) {
    if (existsSync(at(file))) continue;
    mkdirSync(dirname(at(file)), { recursive: true });
    writeFileSync(at(file), body);
    created.push(file);
  }
  created.forEach((f) => console.log(`  created ${f}`));

  if (!created.includes('config/profile.yml')) {
    console.log('\nconfig/profile.yml already exists, so it was left alone. Edit it by hand (see the autopilot: and application: blocks).');
  } else {
    console.log('\nA few questions for config/profile.yml (you can change all of it later):\n');
    const name = await ask('Full name', 'Jane Smith');
    const email = await ask('Email', 'jane@example.com');
    const phone = await ask('Phone', '+1-555-0123');
    const city = await ask('City', 'San Francisco');
    const country = await ask('Country', 'United States');
    const roles = (await ask('Target roles, comma separated', 'Software Engineer Intern')).split(',').map((s) => s.trim()).filter(Boolean);
    const term = await ask('Job term to scan on SimplifyJobs (e.g. "Summer 2027", or "new grad")', 'Summer 2027');
    const tri = (s) => (/^y/i.test(s) ? 'true' : /^n/i.test(s) ? 'false' : 'null');
    const usAuth = tri(await ask('Are you legally authorized to work in the US? (y/n, blank = ask me on each form)', ''));
    const sponsor = tri(await ask('Will you need visa sponsorship now or in the future? (y/n, blank = ask me on each form)', ''));
    const browser = (await ask('Browser for the agent: ego (Ego Lite, supports scheduled runs) or chrome (your Chrome via Claude in Chrome)', 'ego')).toLowerCase().startsWith('c') ? 'chrome' : 'ego';
    const auto = /^y/i.test(await ask('Let the agent submit applications without your review? (y/N)', 'n'));
    const handles = (await ask('Instagram creators who post job lists in stories (comma separated, optional)', '')).split(',').map((s) => s.trim().replace(/^@/, '')).filter(Boolean);

    const newGrad = /new.?grad/i.test(term);
    let t = readFileSync(at('config/profile.yml'), 'utf8');
    t = setLine(t, /full_name: "Jane Smith"/, `full_name: ${yaml(name)}`);
    t = setLine(t, /email: "jane@example.com"/, `email: ${yaml(email)}`);
    t = setLine(t, /phone: "\+1-555-0123"/, `phone: ${yaml(phone)}`);
    t = setLine(t, /location: "San Francisco, CA"/, `location: ${yaml(`${city}, ${country}`)}`);
    t = setLine(t, /  country: "United States"\n  city: "San Francisco"/, `  country: ${yaml(country)}\n  city: ${yaml(city)}`);
    t = setLine(t, /  primary:\n    - "Senior AI Engineer"\n    - "Staff ML Engineer"/, `  primary:\n${roles.map((r) => `    - ${yaml(r)}`).join('\n')}`);
    t = setLine(t, /us_authorized: null/, `us_authorized: ${usAuth}`);
    t = setLine(t, /needs_sponsorship: null  /, `needs_sponsorship: ${sponsor}  `);
    t = setLine(t, /  browser: ego/, `  browser: ${browser}`);
    t = setLine(t, /  auto_submit: false/, `  auto_submit: ${auto}`);
    t = setLine(t, /repo: "SimplifyJobs\/Summer2027-Internships"/, `repo: ${yaml(newGrad ? 'SimplifyJobs/New-Grad-Positions' : 'SimplifyJobs/Summer2027-Internships')}`);
    t = setLine(t, /terms: \["Summer 2027"\]/, `terms: ${newGrad ? '[]' : JSON.stringify([term])}`);
    if (handles.length) {
      t = setLine(t, /    stories:\n      enabled: false/, '    stories:\n      enabled: true');
      t = setLine(t, /      instagram: \[\]/, `      instagram: ${JSON.stringify(handles)}`);
    }
    t = setLine(t, /address: \{ line1: "", city: "", region: "", postal_code: "", country: "" \}/, `address: { line1: "", city: ${yaml(city)}, region: "", postal_code: "", country: ${yaml(country)} }`);
    writeFileSync(at('config/profile.yml'), t);
    console.log('\n  wrote config/profile.yml');
  }

  const browser = /\n  browser: chrome/.test(readFileSync(at('config/profile.yml'), 'utf8')) ? 'chrome' : 'ego';
  console.log(`\nBrowser backend: ${browser}`);
  if (browser === 'ego') {
    const found = spawnSync('sh', ['-c', 'command -v ego-browser'], { encoding: 'utf8' }).stdout.trim();
    console.log(found
      ? `  ✓ ego-browser found at ${found}`
      : '  ✗ ego-browser not found. Install Ego Lite from https://lite.ego.app, finish its onboarding\n    (it puts `ego-browser` on your PATH), then rerun `npm run doctor`.');
  } else {
    console.log([
      '  Claude in Chrome setup (one time):',
      '  1. Install the "Claude" extension from the Chrome Web Store and sign in (Pro, Max, Team or Enterprise plan).',
      '  2. Start Claude Code with `claude --chrome` (or run `/chrome` inside a session and enable it).',
      '  3. Approve job sites when the extension asks. Scheduled/headless runs cannot use Chrome:',
      '     they queue jobs only; you fill them in an interactive session.',
    ].join('\n'));
  }
  if (process.platform === 'darwin') {
    console.log('\nPortal password (Workday, Taleo, iCIMS accounts): store it once in the macOS Keychain:');
    console.log('  security add-generic-password -a <your email> -s autojobs-portals -w');
    console.log('  (it prompts for the password; it never goes into a file or the agent\'s context)');
  }

  console.log('\nNext steps:');
  console.log('  1. Fill the application: block in config/profile.yml (work authorization, education, EEO).');
  console.log('     Anything left blank, the agent will ask you instead of guessing.');
  console.log(`  2. Start your agent in this folder (\`claude${browser === 'chrome' ? ' --chrome' : ''}\`). It will set up cv.md with you.`);
  console.log('  3. Say "run autopilot" to scan your sources, evaluate the roles and fill applications.\n');
  rl?.close();

  const doctor = spawnSync(process.execPath, [at('doctor.mjs')], { cwd: ROOT, stdio: YES ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (YES) process.stdout.write(doctor.stdout || '');
}

main().catch((e) => {
  console.error(`init failed: ${e.message}`);
  process.exit(1);
});
