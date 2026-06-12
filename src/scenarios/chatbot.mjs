import { assert, sleep } from '../core/utils.mjs';
import { countTextOccurrences, findBySpec, flatten, hasText } from '../core/snapshot.mjs';
import { extractAnswer } from '../core/answer.mjs';

export const chatbotScenarioTypes = ['consent', 'question', 'empty-input'];

export async function runScenarioSpec({ spec, item, profile, engine, artifacts, timeoutMs }) {
  if (spec.viewport) await engine.emulate(spec.viewport, { name: `emulate-${spec.name}` });
  if (spec.type === 'consent') return runConsentScenario({ spec, item, profile, engine, artifacts });
  if (spec.type === 'question') return runQuestionScenario({ spec, item, profile, engine, artifacts, timeoutMs });
  if (spec.type === 'empty-input') return runEmptyInputScenario({ spec, item, profile, engine, artifacts });
  throw new Error(`unsupported scenario type: ${spec.type}`);
}

async function runConsentScenario({ spec, item, profile, engine, artifacts }) {
  let snap = await artifacts.snapshot(`${item.name}-before`, item);
  const agree = findBySpec(snap, profile.selectors?.consentAgreeButton);
  if (agree) {
    const labelBox = findBySpec(snap, profile.selectors?.consentLabelInput);
    if (labelBox && spec.label) await engine.fill(labelBox.id, spec.label, { name: 'fill-consent-label' });
    await engine.click(agree.id, { name: 'click-consent-agree' });
    await artifacts.waitForSnapshot((next) => Boolean(findBySpec(next, profile.selectors?.chatInput)), spec.timeoutMs || 10000);
  }
  snap = await artifacts.snapshot(`${item.name}-after`, item);
  assert(findBySpec(snap, profile.selectors?.chatInput), 'chat input should be visible after consent');
  await artifacts.screenshot(`${item.name}-after`, item);
}

async function runQuestionScenario({ spec, item, profile, engine, artifacts, timeoutMs }) {
  const before = await artifacts.snapshot(`${item.name}-before`, item);
  const answerDoneText = profile.selectors?.answerDoneText || '';
  const beforeCount = countTextOccurrences(before, answerDoneText);
  await askFromSnapshot({ snap: before, text: spec.text || '', profile, engine });
  const done = await artifacts.waitForSnapshot((snap) => {
    if (!hasText(snap, spec.text || '')) return false;
    // When no answerDoneText marker is configured, degrade to waiting only for
    // the submitted text. countTextOccurrences('') is always 0, so requiring the
    // marker here would otherwise guarantee a timeout.
    if (!answerDoneText) return true;
    return countTextOccurrences(snap, answerDoneText) >= beforeCount + 1;
  }, spec.timeoutMs || timeoutMs);
  assert(hasText(done, spec.text || ''), 'submitted text should appear in snapshot');
  const after = await artifacts.snapshot(`${item.name}-after`, item);
  await artifacts.screenshot(`${item.name}-after`, item);
  const { answerText, sources } = extractAnswer(after, {
    questionText: spec.text || '',
    doneText: answerDoneText,
  });
  item.evidence = {
    category: spec.category || null,
    question: spec.text || '',
    answerText,
    sources,
  };
}

async function runEmptyInputScenario({ spec, item, profile, engine, artifacts }) {
  const before = await artifacts.snapshot(`${item.name}-before`, item);
  const beforeTextCount = flatten(before).length;
  await askFromSnapshot({ snap: before, text: spec.text || '   ', profile, engine });
  await sleep(spec.waitMs || 500);
  const after = await artifacts.snapshot(`${item.name}-after`, item);
  // Empty input should not produce a new answer. A few extra nodes (e.g. an
  // aria-live validation hint) are tolerated; tune via spec.maxNodeDelta.
  const maxNodeDelta = Number.isInteger(spec.maxNodeDelta) ? spec.maxNodeDelta : 2;
  assert(
    flatten(after).length <= beforeTextCount + maxNodeDelta,
    `empty input should not materially change the accessibility tree (added ${flatten(after).length - beforeTextCount} nodes, allowed ${maxNodeDelta})`,
  );
  await artifacts.screenshot(`${item.name}-after`, item);
}

async function askFromSnapshot({ snap, text, profile, engine }) {
  const input = findBySpec(snap, profile.selectors?.chatInput);
  assert(input, 'chat input not found');
  await engine.fill(input.id, text, { name: 'fill-chat-input' });
  await engine.pressKey('Enter', { name: 'press-enter' });
}
