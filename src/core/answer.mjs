import { flatten, normalizeWs } from './snapshot.mjs';

const SOURCE_HEADING = '관련 문서';

// 누적 페이지에서 "이 질문의 답변"만 잘라낸다. 질문 텍스트의 마지막 출현 이후,
// 완료 마커가 나오기 전까지의 StaticText 를 답변으로, link(url 보유)를 출처로 본다.
// '관련 문서' 헤딩 이후의 StaticText 는 출처 캡션이므로 답변에서 제외한다.
export function extractAnswer(snapshot, { questionText, doneText }) {
  const nodes = flatten(snapshot);
  // 공백 정규화 후 비교한다. 브라우저가 렌더 시 연속 공백을 한 칸으로 합치므로
  // 제출 텍스트의 두 칸 공백(원문 오타 등)이 그대로면 질문 경계를 못 찾는다(faq-33).
  const q = normalizeWs(questionText);
  let qIdx = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (normalizeWs(nodes[i].name) === q) qIdx = i; // 마지막 출현
  }
  if (qIdx === -1) return { answerText: '', sources: [] };

  const answerParts = [];
  const sources = [];
  let inSources = false;
  for (let i = qIdx + 1; i < nodes.length; i++) {
    const node = nodes[i];
    const name = String(node.name || '');
    if (doneText && name.includes(doneText)) break;
    if (node.role === 'heading' && name.trim() === SOURCE_HEADING) { inSources = true; continue; }
    if (node.role === 'link' && node.url) { sources.push({ name: name.trim(), url: node.url }); continue; }
    if (!inSources && node.role === 'StaticText' && name.trim()) answerParts.push(name.trim());
  }
  return { answerText: answerParts.join(' ').trim(), sources };
}
