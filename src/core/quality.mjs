export function analyzeQuality(r, quality = {}) {
  const failures = [];
  const warnings = [];

  for (const msg of r.consoleMessages?.consoleMessages || []) {
    const text = String(msg.text || '');
    const isIgnoredConsole = (quality.ignoreConsoleTextIncludes || []).some((part) => text.includes(part));
    if (msg.type === 'error' && !isIgnoredConsole) warnings.push(`Console error: ${msg.text}`);
  }

  for (const req of r.networkRequests?.networkRequests || []) {
    const status = Number(req.status);
    const url = String(req.url || '');
    const isFavicon = url.endsWith('/favicon.ico');
    const isIgnoredUrl = (quality.ignoreUrlIncludes || []).some((part) => url.includes(part));
    if (isIgnoredUrl) continue;
    if (status >= 500) failures.push(`${req.method} ${req.url} -> ${req.status}`);
    else if (status >= 400 && !(quality.ignoreFavicon404 && isFavicon)) warnings.push(`${req.method} ${req.url} -> ${req.status}`);
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
