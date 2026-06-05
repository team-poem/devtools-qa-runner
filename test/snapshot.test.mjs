import test from 'node:test';
import assert from 'node:assert/strict';
import { countTextOccurrences, findBySpec, flatten, hasText } from '../src/core/snapshot.mjs';

const snapshot = {
  role: 'RootWebArea',
  name: 'Test App',
  children: [
    { id: '1', role: 'heading', name: 'Chat' },
    { id: '2', role: 'textbox', name: 'Ask anything' },
    { id: '3', role: 'button', name: 'Send' },
    {
      id: '4',
      role: 'group',
      name: 'Messages',
      children: [
        { id: '5', role: 'StaticText', name: 'How do I start?' },
        { id: '6', role: 'StaticText', name: 'Helpful?' },
      ],
    },
  ],
};

test('flatten returns nested accessibility nodes', () => {
  assert.equal(flatten(snapshot).length, 7);
});

test('findBySpec matches role and name substring', () => {
  assert.equal(findBySpec(snapshot, { role: 'textbox', nameIncludes: 'Ask' })?.id, '2');
  assert.equal(findBySpec(snapshot, { role: 'button', nameIncludes: 'Send' })?.id, '3');
});

test('findBySpec supports excluded name substrings', () => {
  assert.equal(findBySpec(snapshot, {
    role: 'textbox',
    excludeNameIncludes: ['Ask'],
  }), undefined);
});

test('text helpers find and count visible names', () => {
  assert.equal(hasText(snapshot, 'How do I start?'), true);
  assert.equal(hasText(snapshot, 'Missing'), false);
  assert.equal(countTextOccurrences(snapshot, 'Helpful?'), 1);
});

test('hasText tolerates whitespace differences (DOM collapses runs of spaces)', () => {
  // 브라우저는 렌더 시 연속 공백을 한 칸으로 합친다. 제출 텍스트에 공백이
  // 두 칸 이상 있으면(예: FAQ 원문 오타) 렌더된 노드는 한 칸이 되어,
  // 정확 매칭이면 "질문이 나타났다"를 영영 못 잡고 타임아웃한다(실제 faq-33 버그).
  const ws = {
    role: 'RootWebArea',
    name: 'app',
    children: [{ id: 'q', role: 'StaticText', name: '주차학습 콘텐츠가 안 나타나는데 어떻게 하나요?' }],
  };
  // 검색어엔 공백 두 칸, DOM엔 한 칸 — 그래도 매칭돼야 한다.
  assert.equal(hasText(ws, '주차학습 콘텐츠가 안 나타나는데  어떻게 하나요?'), true);
  // 앞뒤 공백/줄바꿈도 무시.
  assert.equal(hasText(ws, '  주차학습 콘텐츠가 안 나타나는데 어떻게 하나요?\n'), true);
});
