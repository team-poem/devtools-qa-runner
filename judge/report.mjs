import fs from 'node:fs/promises';
import path from 'node:path';

const VERDICT_RANK = { fail: 0, warn: 1, pass: 2 };

function categories(verdicts) {
  const map = new Map();
  for (const v of verdicts) {
    const key = v.category || '(none)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  }
  return map;
}

export function renderJudgeReport(verdicts, { profile } = {}) {
  const ruleFail = verdicts.filter((v) => !v.rule.pass).length;
  const llmFail = verdicts.filter((v) => v.llm && v.llm.verdict === 'fail').length;
  const llmWarn = verdicts.filter((v) => v.llm && v.llm.verdict === 'warn').length;

  const hallucination = verdicts
    .filter((v) => v.llm && (v.llm.scores?.grounding ?? 5) <= 2)
    .map((v) => `- \`${v.name}\` (${v.category}) — ${v.question} → grounding ${v.llm.scores.grounding}: ${v.llm.reason}`);
  const overRefusal = verdicts
    .filter((v) => v.llm && (v.llm.scores?.register ?? 5) <= 2)
    .map((v) => `- \`${v.name}\` (${v.category}) — ${v.question} → register ${v.llm.scores.register}: ${v.llm.reason}`);

  const sections = [...categories(verdicts).entries()].map(([cat, rows]) => {
    const lines = rows
      .sort((a, b) => (VERDICT_RANK[a.llm?.verdict ?? 'pass'] - VERDICT_RANK[b.llm?.verdict ?? 'pass']))
      .map((v) => {
        const verdict = v.rule.pass ? (v.llm?.verdict || 'n/a') : 'RULE-FAIL';
        const sc = v.llm?.scores ? `g${v.llm.scores.grounding}/r${v.llm.scores.register}` : '-';
        const reason = v.rule.pass ? (v.llm?.reason || '') : `rule ${v.rule.fails.join(',')}`;
        return `| ${v.name} | ${verdict} | ${sc} | ${v.question.replace(/\|/g, '\\|')} | ${reason.replace(/\|/g, '\\|')} | ${v.screenshot ? `\`${v.screenshot}\`` : ''} |`;
      });
    return `### ${cat}\n\n| case | verdict | g/r | question | reason | shot |\n|---|---|---|---|---|---|\n${lines.join('\n')}`;
  });

  return `# Adversarial QA Judge Report\n\n## Summary\n\n- Profile: ${profile || '-'}\n- Cases: ${verdicts.length}\n- Rule FAIL: ${ruleFail}\n- LLM fail / warn: ${llmFail} / ${llmWarn}\n\n## 🔴 환각 핫리스트\n\n${hallucination.length ? hallucination.join('\n') : '(none)'}\n\n## 🟠 과잉 거절 핫리스트\n\n${overRefusal.length ? overRefusal.join('\n') : '(none)'}\n\n## 카테고리별 결과\n\n${sections.join('\n\n')}\n`;
}

export async function writeJudgeArtifacts(outDir, verdicts, meta) {
  await fs.writeFile(path.join(outDir, 'judge-verdicts.json'), JSON.stringify(verdicts, null, 2));
  await fs.writeFile(path.join(outDir, 'judge-report.md'), renderJudgeReport(verdicts, meta));
}
