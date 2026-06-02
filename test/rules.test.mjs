import test from 'node:test';
import assert from 'node:assert/strict';
import { runRules } from '../judge/rules.mjs';

const ok = { name: 'x', answerText: '로그인은 교직원 번호와 비밀번호를 입력하면 됩니다.', sources: [{ name: '로그인 안내', url: 'https://www.notion.so/abc' }] };

test('clean answer passes all rules', () => {
  const r = runRules(ok);
  assert.equal(r.pass, true);
  assert.deepEqual(r.fails, []);
});

test('R1 flags blob/cdn url in sources', () => {
  const r = runRules({ ...ok, sources: [{ name: '', url: 'https://media-cdn.notion-static.com/x.png' }] });
  assert.ok(r.fails.includes('R1'));
});

test('R1 flags blob: residue in body', () => {
  assert.ok(runRules({ ...ok, answerText: '이미지는 blob:http://x 를 참고' }).fails.includes('R1'));
});

test('R2 flags model/tech leak', () => {
  assert.ok(runRules({ ...ok, answerText: '저는 gemma 모델로 동작합니다.' }).fails.includes('R2'));
});

test('R2 flags FAQ metadata header leak', () => {
  assert.ok(runRules({ ...ok, answerText: '연번: 24 태그: 로그인 을 참조하세요' }).fails.includes('R2'));
});

test('R3 flags leading bullet markers', () => {
  assert.ok(runRules({ ...ok, answerText: '- 첫째\n- 둘째' }).fails.includes('R3'));
});

test('R3 flags 교수님 honorific and 부탁/청유 종결', () => {
  assert.ok(runRules({ ...ok, answerText: '교수님께서 다시 시도해 주십시오.' }).fails.includes('R3'));
});

test('R3 keeps numbered lists clean', () => {
  assert.ok(!runRules({ ...ok, answerText: '1. 번호를 입력합니다 2. 비밀번호를 입력합니다' }).fails.includes('R3'));
});

test('R3 does not flag plain 부탁드립니다 (post-processor does not normalize it)', () => {
  assert.ok(!runRules({ ...ok, answerText: '교육혁신처 교수학습개발센터로 문의 부탁드립니다.' }).fails.includes('R3'));
});

test('R4 flags empty answer', () => {
  assert.ok(runRules({ ...ok, answerText: '   ' }).fails.includes('R4'));
});
