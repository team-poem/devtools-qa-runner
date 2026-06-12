import fs from 'node:fs/promises';
import path from 'node:path';
import { chatbotScenarioTypes } from '../scenarios/chatbot.mjs';
import { genericScenarioTypes } from '../scenarios/generic.mjs';

const defaultSupportedScenarioTypes = [...chatbotScenarioTypes, ...genericScenarioTypes];

export async function loadProfile(profilePath, options = {}) {
  const resolved = path.resolve(profilePath);
  const profile = JSON.parse(await fs.readFile(resolved, 'utf8'));
  validateProfile(profile, resolved, options);
  return { profile, profilePath: resolved };
}

export function validateProfile(profile, source = '<profile>', options = {}) {
  if (!profile || typeof profile !== 'object') throw new Error(`${source}: profile must be an object`);
  if (!profile.name) throw new Error(`${source}: profile.name is required`);
  if (!Array.isArray(profile.scenarios) || profile.scenarios.length === 0) {
    throw new Error(`${source}: scenarios must be a non-empty array`);
  }

  const needsChatInput = profile.scenarios.some((scenario) => ['consent', 'question', 'empty-input'].includes(scenario.type));
  if (needsChatInput && !profile.selectors?.chatInput) {
    throw new Error(`${source}: selectors.chatInput is required for chatbot scenarios`);
  }

  const hasConsent = profile.scenarios.some((scenario) => scenario.type === 'consent');
  if (hasConsent && !profile.selectors?.consentAgreeButton) {
    throw new Error(`${source}: selectors.consentAgreeButton is required for consent scenarios`);
  }

  for (const [index, scenario] of profile.scenarios.entries()) {
    if (!scenario.type) throw new Error(`${source}: scenarios[${index}].type is required`);
    const supportedScenarioTypes = options.supportedScenarioTypes || defaultSupportedScenarioTypes;
    if (!options.allowUnknownScenarioTypes && !supportedScenarioTypes.includes(scenario.type)) {
      throw new Error(`${source}: unsupported scenario type ${scenario.type}`);
    }
    validateScenarioFields(scenario, index, source);
  }
}

// Matches the dep's emulate viewport grammar:
//   '<width>x<height>x<devicePixelRatio>[,mobile][,touch][,landscape]'
const VIEWPORT_RE = /^\d+x\d+x\d+(?:,(?:mobile|touch|landscape))*$/;

function validateScenarioFields(scenario, index, source) {
  const prefix = `${source}: scenarios[${index}]`;
  if (['click', 'fill'].includes(scenario.type) && !scenario.target) {
    throw new Error(`${prefix}.${scenario.type} requires target`);
  }
  if (scenario.type === 'press-key' && !scenario.key) {
    throw new Error(`${prefix}.press-key requires key`);
  }
  if (scenario.type === 'wait-for-text' && !scenario.text) {
    throw new Error(`${prefix}.wait-for-text requires text`);
  }
  if (scenario.viewport !== undefined && !VIEWPORT_RE.test(String(scenario.viewport))) {
    throw new Error(`${prefix}.viewport "${scenario.viewport}" is invalid (expected <w>x<h>x<dpr>[,mobile][,touch][,landscape])`);
  }
  if (scenario.maxNodeDelta !== undefined && !Number.isInteger(scenario.maxNodeDelta)) {
    throw new Error(`${prefix}.maxNodeDelta must be an integer`);
  }
}
