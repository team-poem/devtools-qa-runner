#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../src/core/args.mjs';
import { runRules } from './rules.mjs';
import { writeJudgeArtifacts } from './report.mjs';
import { judgeOne } from './llm-judge.mjs';

const args = parseArgs(process.argv.slice(2));
const reportDir = path.resolve(args.report || 'reports/faq-adversarial');
const profile = args.profile || 'lms-faq-adversarial';
const maxLlmFail = Number(args['max-llm-fail'] ?? 0);

const raw = await fs.readFile(path.join(reportDir, 'answers.jsonl'), 'utf8');
const records = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

const useLlm = Boolean(args.llm);
const verdicts = [];
for (const rec of records) {
  const rule = runRules(rec);
  let llm = null;
  if (useLlm && rule.pass) {
    try { llm = await judgeOne(rec); }
    catch (err) { llm = { verdict: 'warn', scores: null, reason: `judge error: ${err.message}` }; }
  }
  verdicts.push({ ...rec, rule, llm });
}

await writeJudgeArtifacts(reportDir, verdicts, { profile });

const ruleFail = verdicts.filter((v) => !v.rule.pass).length;
const llmFail = verdicts.filter((v) => v.llm && v.llm.verdict === 'fail').length;
console.log(`Judge report: ${path.join(reportDir, 'judge-report.md')} (rule fail ${ruleFail}, llm fail ${llmFail})`);
process.exitCode = (ruleFail > 0 || llmFail > maxLlmFail) ? 1 : 0;
