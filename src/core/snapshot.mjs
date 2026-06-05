export function flatten(root) {
  const nodes = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  return nodes;
}

export function findBySpec(root, spec = {}) {
  return flatten(root).find((node) => {
    if (spec.role && node.role !== spec.role) return false;
    if (spec.nameIncludes && !String(node.name || '').includes(spec.nameIncludes)) return false;
    if (spec.excludeNameIncludes?.some((text) => String(node.name || '').includes(text))) return false;
    return true;
  });
}

// 연속 공백을 한 칸으로 합치고 앞뒤를 다듬는다. 브라우저가 렌더 시 접근성
// 트리의 텍스트 공백을 정규화(연속 공백 → 한 칸)하므로, 제출 텍스트와의 비교도
// 같은 방식으로 정규화해야 공백 차이(원문 오타의 두 칸 등)로 매칭이 깨지지 않는다.
export function normalizeWs(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function hasText(root, text) {
  const needle = normalizeWs(text);
  return flatten(root).some((node) => normalizeWs(node.name).includes(needle));
}

export function countTextOccurrences(root, text) {
  if (!text) return 0;
  return flatten(root).filter((node) => String(node.name || '').includes(text)).length;
}
