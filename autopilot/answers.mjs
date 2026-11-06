// autopilot/answers.mjs — turns config/profile.yml into application-form answers.
//
// Pure (no browser, no network) so every backend shares one answer source and the
// rules are unit-testable. The contract every caller relies on:
//
//   - A rule whose answer is null means "a human decides". Fillers must leave the
//     field empty and report it, never guess. Unset profile values produce null.
//   - Export-control / ITAR / "citizenship in the listed countries" questions are
//     ALWAYS null, whatever the profile says.
//   - Salary is never filled from rules (a number is the user's call per posting).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

export function loadProfile(root = process.cwd()) {
  const file = join(root, 'config', 'profile.yml');
  if (!existsSync(file)) throw new Error('config/profile.yml not found. Run `node init.mjs` first.');
  return yaml.load(readFileSync(file, 'utf8')) || {};
}

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const YES = [/^Yes\b/i];
const NO = [/^No\b/i];
const yn = (v) => (v === true ? YES : v === false ? NO : null);
const DECLINE = /decline|prefer not|do not (wish|want)|don'?t wish|choose not|not to (answer|disclose|self-identify)/i;

// An application.work_auth key that is PRESENT wins, even as null (= ask). Only profiles
// without the key fall back to location.*, so template placeholders there never answer a form.
function workAuth(profile) {
  const wa = profile.application?.work_auth || {};
  const loc = profile.location || {};
  const listed = (loc.authorized_in || []).some((c) => /united states|^usa?$|^u\.s\.?a?\.?$/i.test(String(c).trim()));
  return {
    authorized: 'us_authorized' in wa ? wa.us_authorized : listed ? true : null,
    sponsorship: 'needs_sponsorship' in wa ? wa.needs_sponsorship : (loc.needs_sponsorship ?? null),
    citizenOrPr: wa.us_citizen_or_permanent_resident ?? null,
  };
}

// [question regex, option preferences | null]. First matching rule wins, so the
// specific phrasings sit above the general ones they would otherwise collide with.
export function buildRules(profile, { company = '' } = {}) {
  const a = profile.application || {};
  const edu = a.education || {};
  const { authorized, sponsorship, citizenOrPr } = workAuth(profile);
  const formerEmployer = (a.previous_employers || []).some((c) => company && new RegExp(`\\b${esc(c)}\\b`, 'i').test(company));
  const both = authorized === null || sponsorship === null ? null : authorized && !sponsorship;
  return [
    [/export|\bITAR\b|\bEAR\b|deemed|held citizenship in any of the countries|citizenship in (any of )?the (countries|following)/i, null],
    // "Authorized to work WITHOUT sponsorship?" is a yes-is-good question; it must not fall into the sponsorship rule.
    [/without (requiring |the need for |needing )?(visa |employer |immigration )?sponsorship/i, yn(both)],
    [/sponsor|employment visa|visa status|immigration/i, yn(sponsorship)],
    [/18 years|age of 18|at least 18/i, yn(a.over_18 ?? null)],
    [/(legally )?(authori[sz]ed|eligible|permitted) to work|work authori[sz]ation|legal right to work/i, yn(authorized)],
    [/citizen|green card|permanent resident|lawful permanent/i, yn(citizenOrPr)],
    [/(previously|ever|currently) (been )?(employed|worked)|former employee|worked (for|at) .* before|current employee/i, formerEmployer ? null : yn(a.previous_employers ? false : null)],
    [/relative|family member|spouse|domestic partner|related to/i, yn(a.relatives_at_employers ?? null)],
    [/non-?compete|restrictive (covenant|agreement)/i, yn(a.non_compete ?? null)],
    [/relocat/i, yn(a.relocate ?? null)],
    [/on-?site|hybrid|in.?office|commut|in person|reliable transportation/i, yn(a.onsite_ok ?? null)],
    [/currently enrolled|enrolled in|pursuing (a|an) .*degree/i, yn(edu.enrolled ?? null)],
    [/year in school|class standing|academic (year|level)/i, edu.class_standing ? [new RegExp(`^${esc(edu.class_standing)}`, 'i')] : null],
    [/years of (relevant )?(professional )?experience/i, a.years_experience_option ? [new RegExp(esc(a.years_experience_option), 'i')] : null],
    [/background check|drug (test|screen)/i, yn(a.background_check_ok ?? null)],
    [/\btext\b|SMS|mobile message/i, a.sms_opt_in === true ? [/^Yes/i, /agree/i, /opt.?in/i] : yn(a.sms_opt_in ?? null)],
    [/terms|acknowledge|certify|attest|consent|privacy (policy|notice)/i, a.accept_terms === true ? [/^Yes/i, /agree/i, /acknowledge/i, /understand/i] : null],
  ];
}

// Returns the option text to select, or null when a human must decide.
export function pickOption(rules, question, options) {
  for (const [re, prefs] of rules) {
    if (!re.test(question)) continue;
    if (!prefs) return null;
    for (const r of prefs) {
      const m = options.find((o) => r.test(String(o).trim()));
      if (m) return m;
    }
    return null;
  }
  return null;
}

// Free-text fields the profile can answer. null → leave blank and report.
export function textAnswer(profile, question) {
  const c = profile.candidate || {};
  const a = profile.application || {};
  const edu = a.education || {};
  const url = (u) => (u && !/^https?:\/\//.test(u) ? `https://${u}` : u || null);
  const table = [
    [/salary|compensation|pay expectation|desired (pay|wage)/i, null],
    [/linkedin/i, url(c.linkedin)],
    [/github/i, url(c.github)],
    [/website|portfolio|personal (site|url)/i, url(c.portfolio_url)],
    [/\bGPA\b|grade point/i, edu.gpa ? String(edu.gpa) : null],
    [/(anticipated|expected) graduation|graduation date/i, edu.graduation || null],
    [/major|field of study|discipline/i, edu.field || null],
    [/(university|school|college).{0,30}(attend|name)|^(current )?(university|school|college)\b/i, edu.school || null],
  ];
  for (const [re, v] of table) if (re.test(question)) return v;
  return null;
}

// EEO / self-identification. A blank profile value means "decline to answer".
export function eeoChoice(profile, kind, options) {
  const want = profile.application?.eeo?.[kind];
  if (!want) return options.find((o) => DECLINE.test(o)) || null;
  const re = new RegExp(`^${esc(want)}`, 'i');
  return options.find((o) => re.test(String(o).trim())) || null;
}

export function identity(profile) {
  const c = profile.candidate || {};
  const a = profile.application || {};
  const parts = String(c.full_name || '').trim().split(/\s+/);
  return {
    first: a.legal_name?.first || parts.slice(0, -1).join(' ') || parts[0] || '',
    last: a.legal_name?.last || (parts.length > 1 ? parts.at(-1) : ''),
    preferred: a.preferred_name || '',
    email: c.email || '',
    phone: a.phone_digits || String(c.phone || '').replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, ''),
    address: a.address || {},
    phoneType: a.phone_type || 'Mobile',
  };
}

// Where portal logins live. The password itself is only ever read from the OS keychain at fill time.
export function portalLogin(profile) {
  const pl = profile.autopilot?.portal_login || {};
  return { email: pl.email || profile.candidate?.email || '', service: pl.keychain_service || 'autojobs-portals' };
}
