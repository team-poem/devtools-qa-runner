import { classifyNetworkStatus, isFaviconUrl } from './network.mjs';

// Console message types that indicate a real problem worth surfacing. The dep's
// ConsoleFormatter emits `type` from the underlying CDP console message; uncaught
// errors are normalized to 'error'. 'assert' (console.assert failures) is treated
// as an error-equivalent; everything else is left to lighthouse/explicit scenarios.
const CONSOLE_ERROR_TYPES = new Set(['error', 'assert']);

export function analyzeQuality(r, quality = {}) {
  const failures = [];
  const warnings = [];

  for (const msg of r.consoleMessages?.consoleMessages || []) {
    if (CONSOLE_ERROR_TYPES.has(msg.type)) warnings.push(`Console ${msg.type}: ${msg.text}`);
  }

  for (const req of r.networkRequests?.networkRequests || []) {
    const cls = classifyNetworkStatus(req.status);
    const label = `${req.method} ${req.url} -> ${req.status}`;
    if (cls.kind === 'server-error' || cls.kind === 'transport-error') {
      failures.push(label);
    } else if (cls.kind === 'client-error') {
      if (quality.ignoreFavicon404 && cls.code === 404 && isFaviconUrl(req.url)) continue;
      warnings.push(label);
    }
    // 'ok' and 'pending' requests are not quality failures here.
  }

  for (const score of r.lighthouse?.lighthouseResult?.summary?.scores || []) {
    if (quality.ignoreSeo && score.id === 'seo') continue;
    if (typeof score.score === 'number' && score.score < (quality.lighthouseFailBelow ?? 0.8)) {
      failures.push(`Low Lighthouse ${score.title}: ${score.score}`);
    } else if (typeof score.score === 'number' && score.score < (quality.lighthouseWarnBelow ?? 0.9)) {
      warnings.push(`Borderline Lighthouse ${score.title}: ${score.score}`);
    }
  }

  return { status: failures.length ? 'fail' : warnings.length ? 'warning' : 'pass', failures, warnings };
}
