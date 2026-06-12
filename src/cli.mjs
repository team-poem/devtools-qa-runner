#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from './core/args.mjs';
import { loadProfile } from './core/profile.mjs';
import { runQa } from './core/runner.mjs';
import { safeName } from './core/utils.mjs';

const args = parseArgs(process.argv.slice(2));
const url = args.url || 'http://localhost:8080';

// A missing/invalid --timeout would otherwise become 1 (Number(true), when the
// flag is passed with no value) or NaN, making every wait scenario fail instantly
// with a misleading "timeout" error. Require an explicit numeric value.
const timeoutMs = args.timeout === undefined ? 120000 : Number(args.timeout);
if (args.timeout === true || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error(`Invalid --timeout: ${JSON.stringify(args.timeout)} (expected a positive number of milliseconds)`);
  process.exit(2);
}

const profileArg = args.profile || 'qa/devtools-qa-runner/profiles/lms-chatbot.json';
const { profile, profilePath } = await loadProfile(profileArg);

// outDir is wiped (fs.rm recursive) at the start of a run. profile.name flows
// into the default path, so sanitize it; and refuse any outDir that would delete
// the working directory itself, an ancestor of it, or the filesystem root.
const defaultOut = path.join('reports', 'devtools-qa-runner', safeName(profile.name || 'default'), 'latest');
const outDir = path.resolve(typeof args.out === 'string' ? args.out : defaultOut);
const cwd = process.cwd();
const cwdRelativeToOut = path.relative(outDir, cwd); // '' if equal; non-'..' & non-absolute if cwd is inside outDir
const isAncestorOfCwd = cwdRelativeToOut === '' || (!cwdRelativeToOut.startsWith('..') && !path.isAbsolute(cwdRelativeToOut));
if (isAncestorOfCwd || outDir === path.parse(outDir).root) {
  console.error(`Refusing to use outDir that would wipe the working directory or an ancestor: ${outDir}`);
  process.exit(2);
}

try {
  const report = await runQa({ url, profile, profilePath, outDir, timeoutMs });
  const failed = report.scenarios.some((s) => s.status === 'fail') || report.quality?.status === 'fail';
  console.log(`DevTools QA report: ${path.join(outDir, 'qa-report.md')}`);
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.error(err);
  process.exit(1);
}
