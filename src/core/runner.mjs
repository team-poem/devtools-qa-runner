import path from 'node:path';
import { ArtifactStore } from './artifacts.mjs';
import { ChromeDevtoolsCliEngine } from '../engines/chrome-devtools-cli-engine.mjs';
import { analyzeQuality } from './quality.mjs';
import { writeReport } from './reporter.mjs';
import { writeAnswersJsonl } from './answers-jsonl.mjs';
import { createDefaultScenarioRegistry } from '../scenarios/registry.mjs';

export async function runQa({ url, profile, profilePath, outDir, timeoutMs, engine = null, engineFactory = null, scenarioRegistry = null }) {
  const report = {
    startedAt: new Date().toISOString(),
    url,
    profile: { name: profile.name, path: profilePath },
    engine: 'chrome-devtools-cli',
    scenarios: [],
    commands: [],
    consoleMessages: null,
    networkRequests: null,
    lighthouse: null,
    quality: null,
  };

  const activeEngine = engine || (engineFactory ? engineFactory({ timeoutMs, report }) : new ChromeDevtoolsCliEngine({ timeoutMs, report }));
  const activeScenarioRegistry = scenarioRegistry || createDefaultScenarioRegistry();
  const artifacts = new ArtifactStore({ outDir, engine: activeEngine });
  await artifacts.prepare();

  await activeEngine.stop();
  try {
    await activeEngine.newPage(url, { timeoutMs });
    for (const spec of profile.scenarios || []) {
      await scenario(report, spec.name || spec.type, spec.category || null, async (item) => {
        const runScenario = activeScenarioRegistry.get(spec.type);
        if (!runScenario) throw new Error(`unsupported scenario type: ${spec.type}`);
        return runScenario({ spec, item, profile, engine: activeEngine, artifacts, timeoutMs });
      });
    }
    report.consoleMessages = await activeEngine.listConsoleMessages({ includePreservedMessages: true });
    report.networkRequests = await activeEngine.listNetworkRequests({ includePreservedRequests: true });
    report.lighthouse = await activeEngine.lighthouseAudit({
      mode: 'snapshot',
      device: 'desktop',
      outputDirPath: path.join(outDir, 'lighthouse'),
    });
    report.quality = analyzeQuality(report, profile.quality || {});
  } finally {
    await activeEngine.stop();
  }

  await writeAnswersJsonl(outDir, report);
  await writeReport({ outDir, report, profilePath, timeoutMs });
  return report;
}

async function scenario(report, name, category, fn) {
  const item = { name, category, status: 'pass', durationMs: 0, screenshots: [], snapshots: [], error: null };
  const started = Date.now();
  try {
    await fn(item);
  } catch (err) {
    item.status = 'fail';
    item.error = err?.stack || err?.message || String(err);
  } finally {
    item.durationMs = Date.now() - started;
    report.scenarios.push(item);
  }
}
