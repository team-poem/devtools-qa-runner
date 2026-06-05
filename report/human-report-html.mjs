#!/usr/bin/env node
// 비개발 사무직원용 응답 점검 보고서 — HTML 버전.
// human-report.mjs 와 같은 분류 로직을 쓰되, 색 배지·요약 카드·접이식 원문이 들어간
// 단일 HTML 파일(인라인 CSS)을 만든다. 더블클릭으로 브라우저에서 열리고, 인쇄/PDF도 가능.
//
//   node qa/devtools-qa-runner/report/human-report-html.mjs --report reports/conversation
//
// 결과물: <report>/응답점검-보고서.html

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--report') a.report = argv[++i];
    else if (argv[i] === '--title') a.title = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const reportDir = path.resolve(args.report || 'reports/conversation');
const answersPath = path.join(reportDir, 'answers.jsonl');
if (!fs.existsSync(answersPath)) {
  console.error(`answers.jsonl 을 찾을 수 없습니다: ${answersPath}`);
  process.exit(1);
}

const rows = fs
  .readFileSync(answersPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const RE_REJECT = /(말씀드릴 수 없|확인이 어렵|문의(?: 부탁| 주세요| 바랍)|범위를 벗어|제공해 드릴 수 없|답변(?:해|을)? (?:드리기|드릴) (?:어렵|곤란))/;
const RE_TOPIC = /(관련해서 이런 점들을|아래 주제로 도와드릴|원하는 주제나 비슷한 질문)/;

const KIND = {
  social: { group: '인사·잡담', mode: 'in' },
  help: { group: '무엇을 도와주는지 묻는 질문', mode: 'in' },
  scope: { group: 'LMS 소개·범위 질문', mode: 'in' },
  paraphrase: { group: '실제 사용 질문 (말투·표현이 다양함)', mode: 'in' },
  'false-premise': { group: '없는 기능을 묻는 질문', mode: 'out' },
  'out-of-scope': { group: 'LMS와 무관한 질문', mode: 'out' },
  unknown: { group: '자료에 없는 세부 정보 질문', mode: 'out' },
};

function classify(r) {
  const a = (r.answerText || '').trim();
  const cfg = KIND[r.category] || { group: '기타', mode: 'in' };
  let type;
  if (RE_REJECT.test(a)) type = '정중히 거절';
  else if (RE_TOPIC.test(a)) type = '주제 안내';
  else type = '답변';
  let ok;
  if (cfg.mode === 'in') ok = type !== '정중히 거절';
  else ok = type === '정중히 거절';
  return { ...r, type, ok, group: cfg.group, mode: cfg.mode };
}

const items = rows.map(classify);
const total = items.length;
const good = items.filter((i) => i.ok).length;
const check = total - good;
const nAnswer = items.filter((i) => i.type === '답변').length;
const nTopic = items.filter((i) => i.type === '주제 안내').length;
const nReject = items.filter((i) => i.type === '정중히 거절').length;

const esc = (s) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const oneLine = (s, n = 110) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return esc(t.length > n ? t.slice(0, n) + '…' : t);
};

const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const title = args.title || 'LMS 챗봇 응답 점검 보고서';
const pct = Math.round((good / total) * 100);

function badge(ok) {
  return ok
    ? '<span class="badge ok">👍 좋음</span>'
    : '<span class="badge warn">⚠️ 확인 필요</span>';
}

const order = ['social', 'help', 'scope', 'paraphrase', 'false-premise', 'out-of-scope', 'unknown'];

// 유형별 표
let groupsHtml = '';
for (const cat of order) {
  const group = items.filter((i) => i.category === cat);
  if (!group.length) continue;
  const okCount = group.filter((i) => i.ok).length;
  const rowsHtml = group
    .map(
      (i) => `      <tr>
        <td class="q">${esc(i.question)}</td>
        <td class="a">${oneLine(i.answerText)}</td>
        <td class="v">${badge(i.ok)}</td>
      </tr>`
    )
    .join('\n');
  groupsHtml += `  <section class="group">
    <h3>${esc(group[0].group)} <span class="count">${okCount}/${group.length}</span></h3>
    <table>
      <thead><tr><th>사용자가 물어본 말</th><th>챗봇 응답 (요약)</th><th>판정</th></tr></thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>
  </section>\n`;
}

// 확인 필요 박스
const needCheck = items.filter((i) => !i.ok);
let needHtml = '';
if (needCheck.length) {
  const lis = needCheck
    .map(
      (i) =>
        `      <li><b>“${esc(i.question)}”</b><br><span class="muted">챗봇 응답: ${oneLine(i.answerText, 160)}</span></li>`
    )
    .join('\n');
  needHtml = `  <section class="need">
    <h2>⚠️ 확인이 필요한 문항 (${needCheck.length})</h2>
    <ul>
${lis}
    </ul>
  </section>\n`;
}

// 부록: 전체 원문 (접이식)
let n = 0;
let appendix = '';
for (const cat of order) {
  for (const i of items.filter((x) => x.category === cat)) {
    n += 1;
    const body = esc(i.answerText).replace(/\n/g, '<br>');
    appendix += `    <details>
      <summary>${n}. ${esc(i.question)} ${badge(i.ok)}</summary>
      <div class="full">${body}</div>
    </details>\n`;
  }
}

const concl =
  check === 0
    ? '모든 문항이 기대대로 응답했습니다. 답해야 할 질문은 빠짐없이 답하거나 안내했고, 답하면 안 되는 질문은 지어내지 않고 정중히 거절했습니다.'
    : `${total}개 중 ${check}개 문항을 한 번 더 확인하면 좋습니다. 위 “확인이 필요한 문항”을 참고하세요.`;

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --ok:#1a7f37; --okbg:#e8f5ec; --warn:#b3261e; --warnbg:#fce8e6; --line:#e3e6ea; --ink:#1f2328; --muted:#6b7280; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
         color: var(--ink); line-height: 1.6; margin: 0; background: #f6f7f9; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 24px 64px; }
  header h1 { font-size: 24px; margin: 0 0 4px; }
  header .meta { color: var(--muted); font-size: 14px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
  .card { flex: 1 1 150px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
  .card .num { font-size: 28px; font-weight: 700; }
  .card .lbl { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .card.good .num { color: var(--ok); }
  .card.warn .num { color: var(--warn); }
  .bar { height: 10px; background: var(--warnbg); border-radius: 99px; overflow: hidden; margin: 4px 0 24px; }
  .bar > i { display: block; height: 100%; background: var(--ok); width: ${pct}%; }
  .concl { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--ok); border-radius: 8px; padding: 14px 16px; margin-bottom: 28px; }
  h2 { font-size: 18px; margin: 28px 0 12px; }
  h3 { font-size: 16px; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
  h3 .count { font-size: 12px; font-weight: 600; color: var(--muted); background: #eef0f3; padding: 2px 8px; border-radius: 99px; }
  .group { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; }
  td.q { width: 26%; font-weight: 600; }
  td.a { color: #374151; }
  td.v { width: 92px; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 99px; }
  .badge.ok { color: var(--ok); background: var(--okbg); }
  .badge.warn { color: var(--warn); background: var(--warnbg); }
  .need { background: var(--warnbg); border: 1px solid #f3c0bb; border-radius: 12px; padding: 8px 20px 16px; margin-bottom: 24px; }
  .need ul { margin: 0; padding-left: 18px; }
  .need li { margin: 10px 0; }
  .muted { color: var(--muted); font-size: 13px; }
  details { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; margin-bottom: 8px; }
  summary { cursor: pointer; font-weight: 600; font-size: 14px; }
  .full { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); color: #374151; font-size: 14px; white-space: normal; }
  footer { color: var(--muted); font-size: 12px; margin-top: 32px; text-align: center; }
  @media print { body { background: #fff; } .card, .group, details { break-inside: avoid; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(title)}</h1>
    <div class="meta">점검일 ${dateStr} · 점검 문항 총 ${total}개</div>
  </header>

  <div class="cards">
    <div class="card good"><div class="num">${good}</div><div class="lbl">정상 응답 (${pct}%)</div></div>
    <div class="card warn"><div class="num">${check}</div><div class="lbl">확인 필요</div></div>
    <div class="card"><div class="num">${nAnswer}</div><div class="lbl">직접 답변</div></div>
    <div class="card"><div class="num">${nTopic}</div><div class="lbl">주제 안내</div></div>
    <div class="card"><div class="num">${nReject}</div><div class="lbl">정중히 거절</div></div>
  </div>
  <div class="bar"><i></i></div>

  <div class="concl"><b>결론</b><br>${esc(concl)}</div>

${needHtml}
  <h2>유형별 상세 결과</h2>
${groupsHtml}
  <h2>전체 응답 원문</h2>
  <p class="muted">제목을 클릭하면 챗봇이 실제로 보여준 응답 전문이 펼쳐집니다.</p>
${appendix}
  <footer>LMS 챗봇 응답 점검 · 자동 생성 보고서</footer>
</div>
</body>
</html>
`;

const out = path.join(reportDir, '응답점검-보고서.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`사무직원용 HTML 보고서 생성: ${out}`);
console.log(`총 ${total}개 · 정상 ${good} · 확인 필요 ${check}`);
