import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJudgeReport } from '../judge/report.mjs';

const verdicts = [
  { name: 'oos-01', category: 'out-of-scope', question: '날씨?', answerText: 'LMS만 안내합니다.', sources: [], rule: { pass: true, fails: [] }, llm: null },
  { name: 'unk-01', category: 'unknown', question: '정원?', answerText: '정확히 37명입니다.', sources: [], rule: { pass: false, fails: ['R2'] }, llm: null },
];

test('report shows totals and a per-category section', () => {
  const md = renderJudgeReport(verdicts, { profile: 'lms-faq-adversarial' });
  assert.match(md, /Adversarial QA/);
  assert.match(md, /out-of-scope/);
  assert.match(md, /unknown/);
  assert.match(md, /R2/);
});

test('report counts rule failures in the summary', () => {
  const md = renderJudgeReport(verdicts, { profile: 'lms-faq-adversarial' });
  assert.match(md, /Rule FAIL: 1/);
});
