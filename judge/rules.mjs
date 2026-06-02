// 결정적 규칙 게이트. 판단이 필요 없는 객관적 결함만 hard-fail.
// 패턴 출처: ingest/preprocess.py(_EMPTY_LINK_RE/_META_HEADER_RE),
// generation/guardrail.py(_META_PATTERNS), generation/filters.py(_normalize_tone).

const R1_URL = /(?:blob:|media-cdn|notion-static|amazonaws|\.s3[.-]|cdn\.)/i;
const R2_LEAK = /(?:gemma|gpt|claude|llama|qwen|ollama|chroma|벡터\s*(?:디비|db|스토어|검색)|임베딩|system\s*prompt|시스템\s*프롬프트|학습\s*데이터|training\s*data)/i;
const R2_META = /(?:^|\n)\s*(?:메뉴명|시기|연번|태그)\s*[:：]/;
const R3_BULLET = /^\s*[-•*]\s+/m;
const R3_KYOSUNIM = /교수님(?:께서|께|이|은|는|의|을|를|도)?/;
const R3_REQUEST = /(?:해\s*주십시오|해\s*주세요|주시기\s*바랍니다|부탁\s*?드립니다)/;

const RULES = [
  { id: 'R1', test: (r) => R1_URL.test(r.answerText || '') || (r.sources || []).some((s) => R1_URL.test(s.url || '')) },
  { id: 'R2', test: (r) => R2_LEAK.test(r.answerText || '') || R2_META.test(r.answerText || '') },
  { id: 'R3', test: (r) => R3_BULLET.test(r.answerText || '') || R3_KYOSUNIM.test(r.answerText || '') || R3_REQUEST.test(r.answerText || '') },
  { id: 'R4', test: (r) => !String(r.answerText || '').trim() },
];

export function runRules(record) {
  const fails = RULES.filter((rule) => rule.test(record)).map((rule) => rule.id);
  return { pass: fails.length === 0, fails };
}
