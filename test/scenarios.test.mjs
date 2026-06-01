import test from 'node:test';
import assert from 'node:assert/strict';
import { runScenarioSpec } from '../src/scenarios/chatbot.mjs';

// Minimal fakes. The chatbot scenarios only touch client.run() and an
// ArtifactStore-like object exposing snapshot()/screenshot()/waitForSnapshot().

function makeArtifacts(snapshots) {
  // snapshots: array consumed in order by snapshot(); waitForSnapshot resolves
  // with the predicate applied to the next snapshot (single-shot, no timers).
  let i = 0;
  const next = () => snapshots[Math.min(i++, snapshots.length - 1)];
  return {
    async snapshot() { return next(); },
    async screenshot() {},
    async waitForSnapshot(predicate) {
      const snap = next();
      if (!predicate(snap)) throw new Error('timeout while waiting for desired snapshot state');
      return snap;
    },
  };
}

const client = { async run() {} };

function tree(...names) {
  return { role: 'RootWebArea', name: 'app', children: names.map((n, idx) => ({ id: String(idx + 1), role: 'StaticText', name: n })) };
}

const chatInputTree = (...extra) => ({
  role: 'RootWebArea', name: 'app',
  children: [{ id: 'input', role: 'textbox', name: 'Ask anything' }, ...extra.map((n, i) => ({ id: `x${i}`, role: 'StaticText', name: n }))],
});

test('question scenario passes once submitted text and a new answer marker appear', async () => {
  const profile = { selectors: { chatInput: { role: 'textbox', nameIncludes: 'Ask' }, answerDoneText: 'Helpful?' } };
  const before = chatInputTree();
  const after = chatInputTree('My question', 'Helpful?');
  const artifacts = makeArtifacts([before, after, after]);
  const item = { name: 'q', snapshots: [], screenshots: [] };
  await assert.doesNotReject(runScenarioSpec({
    spec: { type: 'question', name: 'q', text: 'My question' },
    item, profile, client, artifacts, timeoutMs: 1000,
  }));
});

test('question scenario passes on submitted text alone when answerDoneText is unset', async () => {
  const profile = { selectors: { chatInput: { role: 'textbox', nameIncludes: 'Ask' } } };
  const before = chatInputTree();
  const after = chatInputTree('My question');
  const artifacts = makeArtifacts([before, after, after]);
  const item = { name: 'q', snapshots: [], screenshots: [] };
  await assert.doesNotReject(runScenarioSpec({
    spec: { type: 'question', name: 'q', text: 'My question' },
    item, profile, client, artifacts, timeoutMs: 1000,
  }));
});

test('empty-input scenario fails when a new answer marker appears (count-only oracle would miss it)', async () => {
  const profile = { selectors: { chatInput: { role: 'textbox', nameIncludes: 'Ask' }, answerDoneText: 'Helpful?' } };
  const before = chatInputTree();
  // Same node count as before (app reused nodes) but a new answer marker appeared.
  const after = { role: 'RootWebArea', name: 'app', children: [{ id: 'input', role: 'textbox', name: 'Ask anything Helpful?' }] };
  const artifacts = makeArtifacts([before, after]);
  const item = { name: 'e', snapshots: [], screenshots: [] };
  await assert.rejects(
    runScenarioSpec({ spec: { type: 'empty-input', name: 'e', waitMs: 0 }, item, profile, client, artifacts, timeoutMs: 1000 }),
    /should not produce a new answer/,
  );
});

test('empty-input scenario passes when nothing materially changes', async () => {
  const profile = { selectors: { chatInput: { role: 'textbox', nameIncludes: 'Ask' }, answerDoneText: 'Helpful?' } };
  const before = chatInputTree();
  const after = chatInputTree();
  const artifacts = makeArtifacts([before, after]);
  const item = { name: 'e', snapshots: [], screenshots: [] };
  await assert.doesNotReject(
    runScenarioSpec({ spec: { type: 'empty-input', name: 'e', waitMs: 0 }, item, profile, client, artifacts, timeoutMs: 1000 }),
  );
});

test('empty-input scenario fails when the tree grows beyond maxNodeDelta', async () => {
  const profile = { selectors: { chatInput: { role: 'textbox', nameIncludes: 'Ask' } } };
  const before = chatInputTree();
  const after = chatInputTree('a', 'b', 'c', 'd'); // +4 nodes, default allowance 2
  const artifacts = makeArtifacts([before, after]);
  const item = { name: 'e', snapshots: [], screenshots: [] };
  await assert.rejects(
    runScenarioSpec({ spec: { type: 'empty-input', name: 'e', waitMs: 0 }, item, profile, client, artifacts, timeoutMs: 1000 }),
    /should not materially change/,
  );
});
