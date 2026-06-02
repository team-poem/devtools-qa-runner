import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJudgeJson } from '../judge/ollama.mjs';

test('parses a bare JSON object', () => {
  const r = parseJudgeJson('{"grounding":5,"fallback":4,"register":5,"persona":5,"reason":"좋음"}');
  assert.equal(r.scores.grounding, 5);
  assert.equal(r.reason, '좋음');
});

test('parses JSON inside a code fence with surrounding prose', () => {
  const r = parseJudgeJson('평가 결과:\n```json\n{"grounding":1,"fallback":2,"register":3,"persona":4,"reason":"환각"}\n```\n끝');
  assert.equal(r.scores.grounding, 1);
  assert.equal(r.scores.persona, 4);
});

test('returns null scores on unparseable text', () => {
  const r = parseJudgeJson('모르겠습니다');
  assert.equal(r.scores, null);
});
