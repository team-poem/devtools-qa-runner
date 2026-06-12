import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJudgePrompt, computeVerdict, CATEGORY_EXPECTATIONS } from '../judge/rubric.mjs';

test('every catalog category has an expectation string', () => {
  for (const cat of ['out-of-scope', 'unknown', 'false-premise', 'ambiguous', 'malformed', 'social']) {
    assert.ok(CATEGORY_EXPECTATIONS[cat], `missing expectation for ${cat}`);
  }
});

test('prompt embeds question, answer, and expectation but not the category label', () => {
  const p = buildJudgePrompt({ category: 'social', question: '안녕하세여', answerText: 'LMS 교수자 챗봇입니다. 무엇을 도와드릴까요?' });
  assert.match(p, /안녕하세여/);
  assert.match(p, /무엇을 도와드릴까요/);
  assert.match(p, /따뜻/);
  assert.ok(!p.includes('category'));
});

test('computeVerdict: any score <=2 => fail', () => {
  assert.equal(computeVerdict({ grounding: 1, fallback: 4, register: 5, persona: 5 }), 'fail');
});

test('computeVerdict: a 3 with no <=2 => warn', () => {
  assert.equal(computeVerdict({ grounding: 3, fallback: 4, register: 5, persona: 5 }), 'warn');
});

test('computeVerdict: all >=4 => pass', () => {
  assert.equal(computeVerdict({ grounding: 5, fallback: 4, register: 4, persona: 5 }), 'pass');
});
