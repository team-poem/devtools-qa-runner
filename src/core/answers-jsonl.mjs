import fs from 'node:fs/promises';
import path from 'node:path';

// 시나리오 evidence(답변 텍스트)를 채점기 입력용 JSONL 한 줄/케이스로 직렬화.
export function buildAnswersJsonl(report) {
  const rows = [];
  for (const s of report.scenarios || []) {
    const ev = s.evidence;
    if (!ev || typeof ev.answerText !== 'string') continue;
    rows.push(JSON.stringify({
      name: s.name,
      category: ev.category || null,
      question: ev.question || '',
      answerText: ev.answerText,
      sources: ev.sources || [],
      screenshot: (s.screenshots && s.screenshots[0]) || null,
    }));
  }
  return rows.join('\n') + (rows.length ? '\n' : '');
}

export async function writeAnswersJsonl(outDir, report) {
  await fs.writeFile(path.join(outDir, 'answers.jsonl'), buildAnswersJsonl(report));
}
