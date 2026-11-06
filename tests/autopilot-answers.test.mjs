// tests/autopilot-answers.test.mjs — the form-answer rules every autopilot backend shares.
//
// The seams pinned here are the ones that would silently submit a wrong answer:
//   - unset profile values must produce null (ask the user), never a default guess;
//   - export-control / listed-country citizenship questions are null whatever the profile says;
//   - "authorized to work WITHOUT sponsorship" is a yes-is-good question and must not be
//     captured by the generic sponsorship rule (that would answer No for a user who needs none);
//   - EEO blanks resolve to the decline option; salary is never answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRules, pickOption, textAnswer, eeoChoice, identity } from '../autopilot/answers.mjs';

const YN = ['Yes', 'No'];
const authorized = {
  candidate: { full_name: 'Ana Maria Lopez', email: 'ana@example.com', phone: '+1 (555) 010-2000', linkedin: 'linkedin.com/in/ana' },
  location: { authorized_in: ['United States'], needs_sponsorship: false },
  application: { previous_employers: ['Acme'], education: { gpa: '3.4', school: 'State University' }, eeo: { gender: 'Female' } },
};

test('work authorization follows the profile', () => {
  const r = buildRules(authorized);
  assert.equal(pickOption(r, 'Are you legally authorized to work in the United States?', YN), 'Yes');
  assert.equal(pickOption(r, 'Will you now or in the future require visa sponsorship?', YN), 'No');
});

test('"authorized without sponsorship" is answered Yes, not captured by the sponsorship rule', () => {
  const r = buildRules(authorized);
  assert.equal(pickOption(r, 'Are you authorized to work in the country without requiring sponsorship, now or in the future?', YN), 'Yes');
  const needs = buildRules({ ...authorized, location: { authorized_in: ['United States'], needs_sponsorship: true } });
  assert.equal(pickOption(needs, 'Are you authorized to work in the country without requiring sponsorship, now or in the future?', YN), 'No');
});

test('unset values ask the user instead of guessing', () => {
  const r = buildRules({});
  for (const q of ['Are you legally authorized to work in the US?', 'Will you require sponsorship?', 'Are you willing to relocate?', 'Can you work onsite 3 days a week?', 'Are you at least 18 years of age?']) {
    assert.equal(pickOption(r, q, YN), null, q);
  }
});

test('export control and listed-country citizenship are always the user\'s', () => {
  const r = buildRules({ ...authorized, application: { ...authorized.application, work_auth: { us_citizen_or_permanent_resident: true } } });
  assert.equal(pickOption(r, 'Is your position subject to export control (ITAR/EAR)?', YN), null);
  assert.equal(pickOption(r, 'Have you held citizenship in any of the countries listed below?', YN), null);
});

test('previous employers: No elsewhere, ask at a company you worked for', () => {
  assert.equal(pickOption(buildRules(authorized, { company: 'Globex' }), 'Have you previously been employed by us?', YN), 'No');
  assert.equal(pickOption(buildRules(authorized, { company: 'Acme Corp' }), 'Have you previously been employed by us?', YN), null);
});

test('text answers come from the profile; salary never does', () => {
  assert.equal(textAnswer(authorized, 'LinkedIn Profile'), 'https://linkedin.com/in/ana');
  assert.equal(textAnswer(authorized, 'What is your current GPA?'), '3.4');
  assert.equal(textAnswer(authorized, 'Desired salary'), null);
  assert.equal(textAnswer({}, 'What is your current GPA?'), null);
});

test('EEO: profile value when set, decline option when blank', () => {
  const opts = ['Male', 'Female', 'Decline to self-identify'];
  assert.equal(eeoChoice(authorized, 'gender', opts), 'Female');
  assert.equal(eeoChoice(authorized, 'race', ['Asian', 'White', 'I do not wish to answer']), 'I do not wish to answer');
});

test('identity splits the full name and normalizes the phone', () => {
  const me = identity(authorized);
  assert.equal(me.first, 'Ana Maria');
  assert.equal(me.last, 'Lopez');
  assert.equal(me.phone, '5550102000');
});

test('an untouched template profile answers no work-authorization question', async () => {
  const { readFileSync } = await import('node:fs');
  const yaml = await import('js-yaml');
  const tpl = yaml.load(readFileSync(new URL('../config/profile.example.yml', import.meta.url), 'utf8'));
  const r = buildRules(tpl);
  assert.equal(pickOption(r, 'Are you legally authorized to work in the United States?', YN), null);
  assert.equal(pickOption(r, 'Will you now or in the future require visa sponsorship?', YN), null);
  assert.equal(pickOption(r, 'Are you willing to relocate?', YN), null);
});
