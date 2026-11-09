// tests/init.test.mjs — first-run setup writes the answers it is given, and nothing it is not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = ['config/profile.example.yml', 'templates/portals.example.yml', 'modes/_profile.template.md', 'modes/_custom.template.md', 'doctor.mjs'];

function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'autojobs-init-'));
  for (const f of TEMPLATES) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    copyFileSync(join(ROOT, f), join(dir, f));
  }
  return dir;
}
const run = (dir, input, extra = []) =>
  spawnSync(process.execPath, [join(ROOT, 'init.mjs'), '--target', dir, ...extra], { input, encoding: 'utf8', timeout: 60_000 });
const profile = (dir) => yaml.load(readFileSync(join(dir, 'config/profile.yml'), 'utf8'));

test('--yes leaves work authorization, education and experience blank', () => {
  const dir = checkout();
  const r = run(dir, '', ['--yes']);
  assert.equal(r.status, 0, r.stderr);
  const a = profile(dir).application;
  assert.equal(a.work_auth.us_authorized, null);
  assert.equal(a.work_auth.needs_sponsorship, null);
  assert.equal(a.education.school, '');
  assert.deepEqual(a.experience, []);
  assert.equal(existsSync(join(dir, 'cv.md')), false);
});

test('interactive answers land in profile.yml, cv.md is imported', () => {
  const dir = checkout();
  const cv = join(dir, 'my-cv.md');
  writeFileSync(cv, '# Ana Lee\n');
  const answers = [
    'Ana Lee', 'ana@example.com', '+1-416-555-0100', 'Toronto', 'Canada', 'Backend Intern, SRE Intern', 'Summer 2027',
    'y', 'n', 'chrome', 'n', '@jobs_daily',
    // education
    'University of Waterloo', "Bachelor's Degree", 'Computer Science', '2024-09', '2029-04', 'April 2029', '3.$7',
    // two jobs, one incomplete (skipped)
    'y', 'Developer', 'Acme', 'Toronto ON', '2025-05', '2025-08', 'Built "things"',
    'y', '', 'NoTitle', '', '', '', '',
    'n',
    cv,
  ].join('\n') + '\n';
  const r = run(dir, answers);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const p = profile(dir);
  assert.equal(p.candidate.full_name, 'Ana Lee');
  assert.equal(p.autopilot.browser, 'chrome');
  assert.equal(p.autopilot.auto_submit, false);
  assert.deepEqual(p.autopilot.sources.stories.instagram, ['jobs_daily']);
  assert.equal(p.application.work_auth.us_authorized, true);
  assert.equal(p.application.work_auth.needs_sponsorship, false);
  assert.deepEqual(
    { ...p.application.education },
    { school: 'University of Waterloo', degree: "Bachelor's Degree", field: 'Computer Science', gpa: '3.$7', start: '2024-09', end: '2029-04', graduation: 'April 2029', class_standing: '', enrolled: null },
  );
  assert.deepEqual(p.application.experience, [
    { title: 'Developer', company: 'Acme', location: 'Toronto ON', start: '2025-05', end: '2025-08', description: 'Built "things"' },
  ]);
  assert.equal(readFileSync(join(dir, 'cv.md'), 'utf8'), '# Ana Lee\n');
  assert.match(r.stdout, /Your cv\.md is in place/);
});

test('a non-markdown CV goes to documents/cv/ for intake', () => {
  const dir = checkout();
  const cv = join(dir, 'resume.pdf');
  writeFileSync(cv, '%PDF-1.4 fake');
  // Accept every default (blank school, no jobs), then give the CV path.
  const answers = [...Array(12).fill(''), '', 'n', cv].join('\n') + '\n';
  const r = run(dir, answers);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(existsSync(join(dir, 'cv.md')), false);
  assert.equal(readFileSync(join(dir, 'documents/cv/resume.pdf'), 'utf8'), '%PDF-1.4 fake');
  assert.match(r.stdout, /run intake/);
});

test('rerun keeps an existing profile and cv.md untouched', () => {
  const dir = checkout();
  assert.equal(run(dir, '', ['--yes']).status, 0);
  writeFileSync(join(dir, 'cv.md'), 'mine\n');
  const before = readFileSync(join(dir, 'config/profile.yml'), 'utf8');
  const r = run(dir, '', ['--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'config/profile.yml'), 'utf8'), before);
  assert.equal(readFileSync(join(dir, 'cv.md'), 'utf8'), 'mine\n');
});
