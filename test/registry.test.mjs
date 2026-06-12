import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultScenarioRegistry, createScenarioRegistry, scenarioPlugin } from '../src/scenarios/registry.mjs';
import { validateProfile } from '../src/core/profile.mjs';

test('default scenario registry includes built-in chatbot and generic scenarios', () => {
  const registry = createDefaultScenarioRegistry();
  assert.equal(typeof registry.get('question'), 'function');
  assert.equal(typeof registry.get('fill'), 'function');
});

test('scenario plugins can register custom scenario types', () => {
  const plugin = scenarioPlugin({ name: 'custom', types: ['custom-step'], run: async () => {} });
  const registry = createScenarioRegistry([plugin]);
  assert.equal(typeof registry.get('custom-step'), 'function');
});

test('profile validation can allow plugin-owned scenario types', () => {
  const profile = { name: 'custom', scenarios: [{ type: 'custom-step' }] };
  assert.doesNotThrow(() => validateProfile(profile, '<test>', { allowUnknownScenarioTypes: true }));
});
