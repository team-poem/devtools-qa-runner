import { buildJudgePrompt, computeVerdict } from './rubric.mjs';
import { callOllama } from './ollama.mjs';

// 게이트 통과 레코드 하나를 LLM 으로 채점. 점수 파싱 실패 시 verdict 'warn' 로 안전 표시.
export async function judgeOne(record, deps = { call: callOllama }) {
  const prompt = buildJudgePrompt(record);
  const { scores, reason } = await deps.call(prompt);
  if (!scores) return { verdict: 'warn', scores: null, reason: `judge parse failed: ${reason}` };
  return { verdict: computeVerdict(scores), scores, reason };
}
