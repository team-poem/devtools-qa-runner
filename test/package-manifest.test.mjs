import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package exposes all command-line entrypoints used by consumers', () => {
  assert.equal(pkg.bin['devtools-qa-runner'], 'src/cli.mjs');
  assert.equal(pkg.bin['devtools-qa-runner-judge'], 'judge/cli.mjs');
  assert.equal(pkg.bin['devtools-qa-runner-human-report'], 'report/human-report.mjs');
  assert.equal(pkg.bin['devtools-qa-runner-human-report-html'], 'report/human-report-html.mjs');
});

test('package files include runtime CLI directories', () => {
  assert.ok(pkg.files.includes('src'));
  assert.ok(pkg.files.includes('judge'));
  assert.ok(pkg.files.includes('report'));
  assert.ok(pkg.files.includes('profiles'));
  assert.ok(pkg.files.includes('examples'));
});
