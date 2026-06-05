import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAnswer } from '../src/core/answer.mjs';

const snapshot = {
  role: 'RootWebArea',
  name: 'LMS 챗봇',
  children: [
    { role: 'heading', name: 'LMS 챗봇' },
    { role: 'StaticText', name: 'qa-faq-검증' },
    { role: 'StaticText', name: '이전 질문입니다' },
    { role: 'StaticText', name: '이전 답변입니다.' },
    { role: 'StaticText', name: '오늘 날씨 어때?' },
    { role: 'StaticText', name: '본 챗봇은 LMS 사용법 안내만 제공합니다.' },
    { role: 'heading', name: '관련 문서' },
    { role: 'link', name: '로그인 안내', url: 'https://www.notion.so/abc' },
    { role: 'StaticText', name: '이 응답이 도움이 되었습니까?' },
  ],
};

test('extractAnswer takes text between the question and the done marker', () => {
  const r = extractAnswer(snapshot, { questionText: '오늘 날씨 어때?', doneText: '이 응답이 도움이 되었습니까?' });
  assert.equal(r.answerText, '본 챗봇은 LMS 사용법 안내만 제공합니다.');
});

test('extractAnswer collects source links (role=link with url) in the answer window', () => {
  const r = extractAnswer(snapshot, { questionText: '오늘 날씨 어때?', doneText: '이 응답이 도움이 되었습니까?' });
  assert.deepEqual(r.sources, [{ name: '로그인 안내', url: 'https://www.notion.so/abc' }]);
});

test('extractAnswer does not bleed the previous answer in', () => {
  const r = extractAnswer(snapshot, { questionText: '오늘 날씨 어때?', doneText: '이 응답이 도움이 되었습니까?' });
  assert.ok(!r.answerText.includes('이전 답변'));
});

test('extractAnswer returns empty answerText when question not found', () => {
  const r = extractAnswer(snapshot, { questionText: '없는 질문', doneText: '이 응답이 도움이 되었습니까?' });
  assert.equal(r.answerText, '');
  assert.deepEqual(r.sources, []);
});

test('extractAnswer matches the question across whitespace differences', () => {
  // 제출 텍스트엔 공백 두 칸, 렌더된 DOM 노드는 한 칸(브라우저가 합침).
  // 정확 비교면 질문 경계를 못 찾아 빈 답변을 반환한다(실제 faq-33 버그).
  const r = extractAnswer(snapshot, {
    questionText: '오늘  날씨  어때?',
    doneText: '이 응답이 도움이 되었습니까?',
  });
  assert.equal(r.answerText, '본 챗봇은 LMS 사용법 안내만 제공합니다.');
});
