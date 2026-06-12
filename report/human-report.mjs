#!/usr/bin/env node
// 비개발 사무직원용 응답 점검 보고서 생성기.
// runner 가 남긴 answers.jsonl 을 읽어, JSON·소요시간·경로 없이 "질문 → 응답 → 판정"만
// 평이한 한글 마크다운으로 정리한다.
//
//   node qa/devtools-qa-runner/report/human-report.mjs --report reports/conversation
//   (생략 시 reports/conversation)
//
// 결과물: <report>/응답점검-보고서.md

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

// --- 응답 유형 판별 (개발 지식 없이도 읽히도록 한국어 라벨) ---
const RE_REJECT = /(말씀드릴 수 없|확인이 어렵|문의(?: 부탁| 주세요| 바랍)|범위를 벗어|제공해 드릴 수 없|답변(?:해|을)? (?:드리기|드릴) (?:어렵|곤란))/;
const RE_TOPIC = /(관련해서 이런 점들을|아래 주제로 도와드릴|원하는 주제나 비슷한 질문)/;

// 카테고리별 "기대 동작" → 판정 기준
//  in: 범위 안. 답변/안내면 좋음, 거절이면 확인 필요.
//  out: 범위 밖·없는 기능. 정중히 거절이면 좋음, 답을 지어내면 확인 필요.
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

  let verdict;
  if (cfg.mode === 'in') {
    verdict = type === '정중히 거절' ? '⚠️ 확인 필요' : '👍 좋음';
  } else {
    verdict = type === '정중히 거절' ? '👍 좋음' : '⚠️ 확인 필요';
  }
  return { ...r, type, verdict, group: cfg.group, mode: cfg.mode };
}

const items = rows.map(classify);

// --- 집계 ---
const total = items.length;
const good = items.filter((i) => i.verdict.startsWith('👍')).length;
const check = total - good;
const nAnswer = items.filter((i) => i.type === '답변').length;
const nTopic = items.filter((i) => i.type === '주제 안내').length;
const nReject = items.filter((i) => i.type === '정중히 거절').length;

const oneLine = (s, n = 90) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const title = args.title || 'LMS 챗봇 응답 점검 보고서';

const L = [];
L.push(`# ${title}`);
L.push('');
L.push(`점검일: ${dateStr}`);
L.push(`점검 문항: 총 ${total}개`);
L.push('');
L.push('## 한눈에 보기');
L.push('');
L.push(`- 정상 응답: ${good}개 (${Math.round((good / total) * 100)}%)`);
L.push(`- 확인 필요: ${check}개`);
L.push('');
L.push('| 응답 방식 | 건수 | 설명 |');
L.push('| --- | ---: | --- |');
L.push(`| 직접 답변 | ${nAnswer} | 질문에 맞는 해결 방법을 바로 안내함 |`);
L.push(`| 주제 안내 | ${nTopic} | 너무 포괄적인 질문이라, 어떤 점을 도와줄 수 있는지 예시로 안내함 |`);
L.push(`| 정중히 거절 | ${nReject} | LMS와 무관하거나 없는 기능이라, 지어내지 않고 담당 부서를 안내함 |`);
L.push('');
const concl =
  check === 0
    ? '모든 문항이 기대대로 응답했습니다. 답해야 할 질문은 빠짐없이 답하거나 안내했고, 답하면 안 되는 질문은 지어내지 않고 정중히 거절했습니다.'
    : `${total}개 중 ${check}개 문항을 한 번 더 확인하면 좋습니다. 아래 "확인이 필요한 문항"을 참고하세요.`;
L.push('### 결론');
L.push('');
L.push(concl);
L.push('');

// --- 확인 필요 문항 먼저 ---
const needCheck = items.filter((i) => i.verdict.startsWith('⚠️'));
if (needCheck.length) {
  L.push('## 확인이 필요한 문항');
  L.push('');
  for (const i of needCheck) {
    L.push(`- 질문: “${i.question}”`);
    L.push(`  - 챗봇 응답: ${oneLine(i.answerText, 140)}`);
    L.push('');
  }
}

// --- 유형(그룹)별 상세 ---
L.push('## 유형별 상세 결과');
L.push('');
const order = ['social', 'help', 'scope', 'paraphrase', 'false-premise', 'out-of-scope', 'unknown'];
const seen = new Set();
for (const cat of order) {
  const group = items.filter((i) => i.category === cat);
  if (!group.length) continue;
  seen.add(cat);
  L.push(`### ${group[0].group}`);
  L.push('');
  L.push('| 사용자가 물어본 말 | 챗봇 응답 (요약) | 판정 |');
  L.push('| --- | --- | --- |');
  for (const i of group) {
    L.push(`| ${i.question} | ${oneLine(i.answerText)} | ${i.verdict} |`);
  }
  L.push('');
}

// --- 부록: 전체 응답 원문 ---
L.push('## 부록 · 전체 응답 원문');
L.push('');
L.push('각 문항에 챗봇이 실제로 보여준 응답 전문입니다.');
L.push('');
let n = 0;
for (const cat of order) {
  const group = items.filter((i) => i.category === cat);
  for (const i of group) {
    n += 1;
    L.push(`**${n}. ${i.question}**  · ${i.verdict}`);
    L.push('');
    for (const line of (i.answerText || '').split('\n')) {
      L.push(`> ${line}`);
    }
    L.push('');
  }
}

const out = path.join(reportDir, '응답점검-보고서.md');
fs.writeFileSync(out, L.join('\n'), 'utf8');
console.log(`사무직원용 보고서 생성: ${out}`);
console.log(`총 ${total}개 · 정상 ${good} · 확인 필요 ${check}`);
