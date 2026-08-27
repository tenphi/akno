#!/usr/bin/env node
/**
 * Content-safe checks for files that must never be committed.
 *
 * The old CI grep printed an entire matching line and treated any sixteen adjacent digits as a
 * payment number. Long benchmark decimals therefore failed every build and copied large amounts
 * of unrelated artifact content into public logs. This scanner understands decimal/hash context,
 * reports only location plus category, and is shared by CI and the release job.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];

if (tracked.includes('config/local.jsonc')) {
  add('config/local.jsonc', 1, 'tracked local configuration');
}
for (const file of tracked) {
  if (/(^|\/)\.env$/.test(file)) add(file, 1, 'tracked environment file');
}

checkLines('config/default.jsonc', [
  { category: 'inline API-key literal', test: (line) => /"api_key"\s*:\s*"/.test(line) },
  { category: 'machine-specific home path', test: (line) => /\/(Users|home)\/[a-zA-Z]/.test(line) },
]);
checkLines('config/local.example.jsonc', [
  { category: 'inline API-key literal', test: (line) => /"api_key"\s*:\s*"/.test(line) },
]);

for (const file of tracked) {
  if (file === 'pnpm-lock.yaml' || file.endsWith('.lock')) continue;
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    continue;
  }
  if (bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/passport\s+(number|no)\s*[: ]/i.test(line)) add(file, index + 1, 'passport-number shape');
    if (/\biban\s*[: ]/i.test(line)) add(file, index + 1, 'international-bank-account shape');
    if (/\+[0-9]{10,}/.test(line)) add(file, index + 1, 'international-phone shape');
    for (const match of line.matchAll(/(?<![0-9A-Fa-f.])(?:[0-9]{4}[ -]?){3}[0-9]{4}(?![0-9A-Fa-f.])/g)) {
      const digits = match[0].replace(/[ -]/g, '');
      // An all-repeated digit is the repository's documented unmistakable placeholder style.
      if (/^(.)\1+$/.test(digits)) continue;
      add(file, index + 1, 'payment-number shape');
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings.slice(0, 50)) {
    process.stderr.write(
      `::error file=${escapeAnnotation(finding.file)},line=${finding.line}::Potential ${finding.category}; content redacted. See AGENTS.md.\n`,
    );
  }
  if (findings.length > 50) {
    process.stderr.write(`::error::${findings.length - 50} additional findings omitted.\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write('repository safety checks passed\n');
}

function checkLines(file, checks) {
  if (!tracked.includes(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let index = 0; index < lines.length; index++) {
    for (const check of checks) {
      if (check.test(lines[index])) add(file, index + 1, check.category);
    }
  }
}

function add(file, line, category) {
  findings.push({ file, line, category });
}

function escapeAnnotation(value) {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}
