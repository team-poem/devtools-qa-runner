// 챗봇과 동일한 ollama 백엔드로 심판을 돌린다(신규 의존성/ API 키 없음).
const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const JUDGE_MODEL = process.env.JUDGE_MODEL || process.env.OLLAMA_MODEL || 'gemma3:4b';

// 첫 번째 완결된 JSON 객체를 추출. 문자열 내부의 중괄호/이스케이프를 인식하므로
// JSON 뒤에 군더더기 산문({메모} 등)이 붙거나 reason 안에 중괄호가 있어도 견딘다.
function firstJsonObject(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

// LLM 출력에서 첫 JSON 객체를 견고하게 추출해 {scores, reason} 로 정규화.
export function parseJudgeJson(text) {
  const json = firstJsonObject(text);
  if (!json) return { scores: null, reason: String(text || '').slice(0, 200) };
  try {
    const obj = JSON.parse(json);
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const scores = {
      grounding: num(obj.grounding), fallback: num(obj.fallback),
      register: num(obj.register), persona: num(obj.persona),
    };
    if (Object.values(scores).some((v) => v === null)) return { scores: null, reason: String(obj.reason || '') };
    return { scores, reason: String(obj.reason || '') };
  } catch {
    return { scores: null, reason: 'parse error' };
  }
}

export async function callOllama(prompt, { host = HOST, model = JUDGE_MODEL } = {}) {
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return parseJudgeJson(data?.message?.content || '');
}
