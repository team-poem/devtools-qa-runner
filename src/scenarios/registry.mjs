import { chatbotScenarioTypes, runScenarioSpec as runChatbotScenarioSpec } from './chatbot.mjs';
import { genericScenarioTypes, runGenericScenarioSpec } from './generic.mjs';

export function createScenarioRegistry(plugins = []) {
  const registry = new Map();
  for (const plugin of plugins) registerScenarioPlugin(registry, plugin);
  return registry;
}

export function createDefaultScenarioRegistry(extraPlugins = []) {
  return createScenarioRegistry([
    scenarioPlugin({ name: 'chatbot', types: chatbotScenarioTypes, run: runChatbotScenarioSpec }),
    scenarioPlugin({ name: 'generic', types: genericScenarioTypes, run: runGenericScenarioSpec }),
    ...extraPlugins,
  ]);
}

export function scenarioPlugin({ name, types, run }) {
  return { name, scenarios: types.map((type) => ({ type, run })) };
}

export function registerScenarioPlugin(registry, plugin) {
  for (const scenario of plugin.scenarios || []) {
    if (!scenario.type || typeof scenario.run !== 'function') {
      throw new Error(`invalid scenario plugin${plugin.name ? ` ${plugin.name}` : ''}`);
    }
    if (registry.has(scenario.type)) {
      throw new Error(`duplicate scenario type registered: ${scenario.type}`);
    }
    registry.set(scenario.type, scenario.run);
  }
  return registry;
}
