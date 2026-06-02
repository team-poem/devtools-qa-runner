import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnswersJsonl } from '../src/core/answers-jsonl.mjs';

const report = {
  scenarios: [
    { name: 'consent-flow', status: 'pass' },
    {
      name: 'oos-01', status: 'pass',
      screenshots: ['screenshots/06-oos-01-after.png'],
      evidence: { category: 'out-of-scope', question: '오늘 날씨 어때?', answerText: '본 챗봇은…', sources: [] },
    },
    { name: 'faq-timeout', status: 'fail', evidence: undefined },
  ],
};

test('buildAnswersJsonl emits one line per scenario that has answer evidence', () => {
  const lines = buildAnswersJsonl(report).trim().split('\n');
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]);
  assert.equal(row.name, 'oos-01');
  assert.equal(row.category, 'out-of-scope');
  assert.equal(row.question, '오늘 날씨 어때?');
  assert.equal(row.screenshot, 'screenshots/06-oos-01-after.png');
});
