#!/usr/bin/env node
/**
 * scan-simplify.mjs — zero-LLM scanner over a public SimplifyJobs listings repo.
 *
 * Reads the repo's listings.json (no auth), keeps active postings that pass the
 * filters in config/profile.yml → autopilot.sources.simplify, dedupes against
 * data/scan-history.tsv + data/pipeline.md, and appends survivors to
 * data/pipeline.md as unprocessed rows (`src: simplify {date}`).
 *
 * Listings are untrusted external data: titles and fields are matched, never obeyed.
 *
 * Usage: node scan-simplify.mjs [--summary] [--dry-run] [--since N]
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';

export const DEFAULTS = {
  repo: 'SimplifyJobs/Summer2027-Internships',
  branch: 'dev',
  since_days: 7,
  terms: [], // e.g. ["Summer 2027"]; empty = any term
  locations: [], // case-insensitive substrings, e.g. ["toronto", "canada", "remote"]; "united states" also matches ", CA"-style state codes
  categories: ['software', 'ai', 'ml', 'machine learning', 'data', 'quant', 'product'],
  title_include: ['software', 'engineer', 'developer', 'swe', 'machine learning', 'ml', 'ai', 'data', 'backend', 'frontend', 'full stack', 'infrastructure', 'platform', 'cloud', 'security', 'product manag'],
  title_exclude: ['sales', 'marketing', 'recruit', 'phd', 'ph.d', "master's", 'mba', 'new grad'],
  company_exclude: [],
  require_bachelor_eligible: true,
  skip_citizenship_required: true,
};

const US_STATE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const words = (list) => (list.length ? new RegExp(list.map((s) => `\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|'), 'i') : null);
export const normalize = (u) => u.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

export function loadConfig(root = process.cwd()) {
  const file = `${root}/config/profile.yml`;
  const p = existsSync(file) ? yaml.load(readFileSync(file, 'utf8')) || {} : {};
  return { ...DEFAULTS, ...(p.autopilot?.sources?.simplify || {}) };
}

// Pure: listings → matches. `now` is seconds since epoch.
export function filterListings(listings, cfg, { seen = new Set(), now = Date.now() / 1000 } = {}) {
  const c = { ...DEFAULTS, ...cfg };
  const cat = words(c.categories);
  const inc = words(c.title_include);
  const exc = words(c.title_exclude);
  const company = words(c.company_exclude);
  const terms = words(c.terms);
  const locs = c.locations.map((s) => s.toLowerCase());
  const wantsUS = locs.some((s) => /united states|^usa?$/.test(s));
  const cutoff = now - c.since_days * 86400;
  const out = [];
  for (const j of listings) {
    if (!j.active || j.is_visible === false) continue;
    const title = j.title || '';
    if (cat && !cat.test(j.category || '')) continue;
    if ((exc && exc.test(title)) || (inc && !inc.test(title))) continue;
    if (!j.date_posted || j.date_posted < cutoff) continue;
    if (c.require_bachelor_eligible && (j.degrees || []).length && !j.degrees.some((d) => /bachelor/i.test(d))) continue;
    if (c.skip_citizenship_required && /citizenship/i.test(j.sponsorship || '')) continue;
    if (company && company.test(j.company_name || '')) continue;
    const where = (j.locations || []).join(', ');
    if (locs.length && !locs.some((s) => where.toLowerCase().includes(s)) && !(wantsUS && US_STATE.test(where))) continue;
    if (terms && !terms.test((j.terms || []).join(' '))) continue;
    const link = j.url || j.company_url;
    if (!link || seen.has(normalize(link))) continue;
    seen.add(normalize(link));
    out.push({
      company: j.company_name,
      title,
      locations: where,
      terms: (j.terms || []).join('/'),
      url: link,
      posted: new Date(j.date_posted * 1000).toISOString().slice(0, 10),
    });
  }
  return out.sort((a, b) => b.posted.localeCompare(a.posted));
}

function seenUrls() {
  const seen = new Set();
  for (const f of ['data/scan-history.tsv', 'data/pipeline.md']) {
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/[^\s|\t]+/g)) seen.add(normalize(m[0]));
  }
  return seen;
}

async function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();
  if (args.includes('--since')) cfg.since_days = Number(args[args.indexOf('--since') + 1]) || cfg.since_days;
  const url = `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/.github/scripts/listings.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${cfg.repo}: HTTP ${res.status}`);
    process.exit(1);
  }
  const matches = filterListings(await res.json(), cfg, { seen: seenUrls() });
  const today = new Date().toISOString().slice(0, 10);
  if (args.includes('--summary')) {
    console.log(`\nSimplify scan (${cfg.repo}): ${matches.length} new match(es) in the last ${cfg.since_days} day(s)\n`);
    for (const m of matches) console.log(`  ${m.company} — ${m.title}\n      ${m.locations}${m.terms ? ' | ' + m.terms : ''} | posted ${m.posted}\n      ${m.url}`);
  } else console.log(JSON.stringify({ count: matches.length, matches }, null, 2));
  if (!args.includes('--dry-run') && matches.length) {
    const rows = matches.map((m) => `- [ ] ${m.url} | ${m.company} | ${m.title} | ${m.locations}${m.terms ? ' | ' + m.terms : ''} | posted: ${m.posted} | src: simplify ${today}`);
    appendFileSync('data/pipeline.md', `\n${rows.join('\n')}\n`);
    console.error(`\n→ appended ${matches.length} row(s) to data/pipeline.md`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
