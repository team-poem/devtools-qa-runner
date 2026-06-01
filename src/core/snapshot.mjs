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

export function findBySpec(root, spec) {
  // A selector needs at least one POSITIVE matcher (role or nameIncludes).
  // Without one — a missing selector, {}, or an exclude-only spec — findBySpec
  // would otherwise match the first non-excluded node (usually the root) and the
  // scenario would act on the wrong element.
  if (!spec || (!spec.role && !spec.nameIncludes)) return undefined;
  return flatten(root).find((node) => {
    if (spec.role && node.role !== spec.role) return false;
    if (spec.nameIncludes && !String(node.name || '').includes(spec.nameIncludes)) return false;
    if (spec.excludeNameIncludes?.some((text) => String(node.name || '').includes(text))) return false;
    return true;
  });
}

export function hasText(root, text) {
  return flatten(root).some((node) => String(node.name || '').includes(text));
}

export function countTextOccurrences(root, text) {
  if (!text) return 0;
  return flatten(root).filter((node) => String(node.name || '').includes(text)).length;
}
