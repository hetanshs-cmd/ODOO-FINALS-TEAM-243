#!/usr/bin/env node
/**
 * npm audit --json gate with a per-package allowlist.
 *
 * Plain `npm audit --audit-level=high` has no way to accept a specific
 * advisory without either fixing it or silencing the whole check. This lets
 * CI keep failing on any *new* high/critical vulnerability while formally
 * accepting ones we've reviewed and can't fix yet (e.g. xlsx's
 * prototype-pollution/ReDoS advisories, which have no patched release on
 * the npm registry).
 *
 * Usage: node ci-npm-audit-check.cjs <audit.json> [allowlisted-package ...]
 */
const fs = require('fs');

const [, , jsonPath, ...allowlist] = process.argv;
if (!jsonPath) {
  console.error('Usage: node ci-npm-audit-check.cjs <audit.json> [allowlisted-package ...]');
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const vulnerabilities = report.vulnerabilities || {};

const blocking = [];
const accepted = [];

for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue;
  if (allowlist.includes(name)) {
    accepted.push(`${name} (${vuln.severity})`);
  } else {
    blocking.push(`${name} (${vuln.severity})`);
  }
}

if (accepted.length > 0) {
  console.log(`✅ Formally accepted (see docs/security.md#accepted-exceptions): ${accepted.join(', ')}`);
}

if (blocking.length > 0) {
  console.error(`❌ Unreviewed high/critical vulnerabilities found: ${blocking.join(', ')}`);
  process.exit(1);
}

console.log('✅ No unreviewed high/critical vulnerabilities.');
