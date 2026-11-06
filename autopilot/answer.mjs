#!/usr/bin/env node
// autopilot/answer.mjs — the profile's answer to one form question, for agent-driven (Chrome) fills.
//
//   node autopilot/answer.mjs "Will you require visa sponsorship?" "Yes" "No"   → No
//   node autopilot/answer.mjs "What is your GPA?"                                → 3.6 (text answer)
//   node autopilot/answer.mjs --eeo gender "Male" "Female" "Decline to self-identify"
//
// Prints ASK when a human must decide. Add --company "Acme" for previous-employer checks.
import { loadProfile, buildRules, pickOption, textAnswer, eeoChoice } from './answers.mjs';

const args = process.argv.slice(2);
const ci = args.indexOf('--company');
const company = ci >= 0 ? args.splice(ci, 2)[1] : '';
const profile = loadProfile();
let answer;
if (args[0] === '--eeo') answer = eeoChoice(profile, args[1], args.slice(2));
else if (args.length > 1) answer = pickOption(buildRules(profile, { company }), args[0], args.slice(1));
else answer = textAnswer(profile, args[0] || '');
console.log(answer ?? 'ASK');
