import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeOne } from '../judge/llm-judge.mjs';

test('judgeOne maps scores to a verdict via injected call', async () => {
  const fake = async () => ({ scores: { grounding: 1, fallback: 2, register: 5, persona: 5 }, reason: '환각' });
  const v = await judgeOne({ category: 'unknown', question: 'q', answerText: 'a' }, { call: fake });
  assert.equal(v.verdict, 'fail');
  assert.equal(v.scores.grounding, 1);
});

test('judgeOne degrades to warn on parse failure', async () => {
  const fake = async () => ({ scores: null, reason: 'parse error' });
  const v = await judgeOne({ category: 'social', question: 'q', answerText: 'a' }, { call: fake });
  assert.equal(v.verdict, 'warn');
});
