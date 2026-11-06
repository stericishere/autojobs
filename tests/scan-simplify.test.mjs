// tests/scan-simplify.test.mjs — filterListings is the whole scanner minus network and file IO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterListings } from '../scan-simplify.mjs';

const NOW = Date.UTC(2026, 10, 1) / 1000;
const day = 86400;
const base = { active: true, category: 'Software Engineering', title: 'Software Engineer Intern', company_name: 'Acme', locations: ['Toronto, ON'], terms: ['Summer 2027'], degrees: ['Bachelor\'s'], date_posted: NOW - day, url: 'https://acme.example/jobs/1' };
const job = (over) => ({ ...base, ...over });
const cfg = { terms: ['Summer 2027'], locations: ['toronto', 'united states'], since_days: 7 };
const run = (listings, c = cfg) => filterListings(listings, c, { now: NOW }).map((m) => m.url);

test('keeps a matching listing', () => {
  assert.deepEqual(run([base]), ['https://acme.example/jobs/1']);
});

test('applies term, location, recency and title filters', () => {
  assert.deepEqual(run([job({ terms: ['Fall 2026'] })]), []);
  assert.deepEqual(run([job({ locations: ['London, UK'] })]), []);
  assert.deepEqual(run([job({ date_posted: NOW - 30 * day })]), []);
  assert.deepEqual(run([job({ title: 'Sales Intern' })]), []);
  assert.deepEqual(run([job({ active: false })]), []);
});

test('"united states" also matches state-code locations', () => {
  assert.equal(run([job({ locations: ['Austin, TX'], url: 'https://x.example/2' })]).length, 1);
});

test('hard blocks: grad-only degrees and citizenship-required', () => {
  assert.deepEqual(run([job({ degrees: ['Master\'s', 'PhD'] })]), []);
  assert.deepEqual(run([job({ sponsorship: 'U.S. Citizenship is Required' })]), []);
});

test('company exclusions and dedupe', () => {
  assert.deepEqual(run([base], { ...cfg, company_exclude: ['acme'] }), []);
  assert.equal(run([base, job({ url: 'https://acme.example/jobs/1/?utm=x' })]).length, 1);
});

test('empty terms and locations mean no restriction', () => {
  assert.equal(run([job({ terms: ['Fall 2026'], locations: ['London, UK'] })], { terms: [], locations: [] }).length, 1);
});
