import { assert } from '../core/utils.mjs';
import { findBySpec, hasText } from '../core/snapshot.mjs';

export const genericScenarioTypes = [
  'click',
  'fill',
  'press-key',
  'wait-for-text',
  'screenshot',
  'assert-no-console-errors',
  'assert-no-http-errors',
  'assert-js',
];

export async function runGenericScenarioSpec({ spec, item, engine, artifacts, timeoutMs }) {
  if (spec.viewport) await engine.emulate(spec.viewport, { name: `emulate-${spec.name || spec.type}` });
  if (spec.type === 'click') return clickScenario({ spec, item, engine, artifacts });
  if (spec.type === 'fill') return fillScenario({ spec, item, engine, artifacts });
  if (spec.type === 'press-key') return pressKeyScenario({ spec, engine });
  if (spec.type === 'wait-for-text') return waitForTextScenario({ spec, item, artifacts, timeoutMs });
  if (spec.type === 'screenshot') return screenshotScenario({ spec, item, artifacts });
  if (spec.type === 'assert-no-console-errors') return assertNoConsoleErrorsScenario({ spec, item, engine });
  if (spec.type === 'assert-no-http-errors') return assertNoHttpErrorsScenario({ spec, item, engine });
  if (spec.type === 'assert-js') return assertJsScenario({ spec, item, engine });
  throw new Error(`unsupported generic scenario type: ${spec.type}`);
}

async function clickScenario({ spec, item, engine, artifacts }) {
  const snap = await artifacts.snapshot(`${item.name}-before`, item);
  const node = findBySpec(snap, spec.target);
  assert(node, `click target not found: ${JSON.stringify(spec.target)}`);
  await engine.click(node.id, { name: `click-${item.name}` });
  if (spec.screenshot !== false) await artifacts.screenshot(`${item.name}-after`, item);
}

async function fillScenario({ spec, item, engine, artifacts }) {
  const snap = await artifacts.snapshot(`${item.name}-before`, item);
  const node = findBySpec(snap, spec.target);
  assert(node, `fill target not found: ${JSON.stringify(spec.target)}`);
  await engine.fill(node.id, spec.value || '', { name: `fill-${item.name}` });
  if (spec.submitKey) await engine.pressKey(spec.submitKey, { name: `submit-${item.name}` });
  if (spec.screenshot) await artifacts.screenshot(`${item.name}-after`, item);
}

async function pressKeyScenario({ spec, engine }) {
  assert(spec.key, 'press-key scenario requires key');
  await engine.pressKey(spec.key, { name: `press-${spec.name || spec.key}` });
}

async function waitForTextScenario({ spec, item, artifacts, timeoutMs }) {
  assert(spec.text, 'wait-for-text scenario requires text');
  const snap = await artifacts.waitForSnapshot((next) => hasText(next, spec.text), spec.timeoutMs || timeoutMs);
  assert(hasText(snap, spec.text), `text not found: ${spec.text}`);
  await artifacts.snapshot(`${item.name}-after`, item);
  if (spec.screenshot !== false) await artifacts.screenshot(`${item.name}-after`, item);
}

async function screenshotScenario({ spec, item, artifacts }) {
  await artifacts.screenshot(spec.fileName || `${item.name}`, item);
}

async function assertNoConsoleErrorsScenario({ spec, item, engine }) {
  const result = await engine.listConsoleMessages({ name: `console-${item.name}`, includePreservedMessages: true });
  const messages = result.consoleMessages || [];
  const errors = messages.filter((message) => message.type === 'error' && !isIgnored(message.text || '', spec.ignoreTextIncludes || []));
  item.evidence = { ...(item.evidence || {}), consoleErrors: errors };
  assert(errors.length === 0, `console errors found: ${errors.map((message) => message.text).join(' | ')}`);
}

async function assertNoHttpErrorsScenario({ spec, item, engine }) {
  const result = await engine.listNetworkRequests({ name: `network-${item.name}`, includePreservedRequests: true });
  const requests = result.networkRequests || [];
  const errors = requests.filter((request) => isHttpError(request, spec));
  item.evidence = { ...(item.evidence || {}), httpErrors: errors };
  assert(errors.length === 0, `HTTP errors found: ${errors.map((request) => `${request.method} ${request.url} -> ${request.status}`).join(' | ')}`);
}

async function assertJsScenario({ spec, item, engine }) {
  assert(spec.script, 'assert-js scenario requires script');
  const result = await engine.evaluateScript(spec.script, { name: `assert-js-${item.name}` });
  const value = extractEvaluateScriptValue(result);
  item.evidence = { ...(item.evidence || {}), result: value, raw: result };

  if (typeof value === 'boolean') {
    assert(value, spec.message || 'assert-js returned false');
    return;
  }
  if (value && typeof value === 'object' && 'pass' in value) {
    assert(Boolean(value.pass), value.message || spec.message || `assert-js failed: ${JSON.stringify(value)}`);
    return;
  }
  assert(Boolean(value), spec.message || `assert-js returned a falsy value: ${JSON.stringify(value)}`);
}

function extractEvaluateScriptValue(result) {
  if (result && 'value' in result) return result.value;
  if (result && 'result' in result) return result.result;
  const message = String(result?.message || '');
  const jsonMatch = message.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { return jsonMatch[1].trim(); }
  }
  const textMatch = message.match(/returned:\s*([\s\S]*)$/);
  if (textMatch) return textMatch[1].trim();
  return result;
}

function isIgnored(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function isHttpError(request, spec) {
  const status = Number(request.status);
  if (!status || status < 400) return false;
  const url = String(request.url || '');
  if (spec.ignoreFavicon404 && status === 404 && url.endsWith('/favicon.ico')) return false;
  if ((spec.ignoreUrlIncludes || []).some((part) => url.includes(part))) return false;
  if (spec.failOn4xx === false && status < 500) return false;
  return true;
}
