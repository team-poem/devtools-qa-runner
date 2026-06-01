// Shared classification of chrome-devtools network request `status` values.
//
// NetworkFormatter.toJSON() (chrome-devtools-mcp) emits `status` as a STRING that
// is one of three shapes (see formatters/NetworkFormatter.js #getStatusFromRequest):
//   - a numeric HTTP code as a string ("200", "404", "502") when a response arrived
//   - the transport failure text ("net::ERR_CONNECTION_REFUSED", "net::ERR_NAME_NOT_RESOLVED", ...)
//     when the request failed before/without an HTTP response
//   - the literal "pending" when the request is still in flight
//
// Numeric-only comparisons (Number(status) >= 500) silently miss the transport
// failures because Number("net::ERR_...") is NaN and NaN >= N is always false.
// Both the quality gate and the assert-no-http-errors scenario must treat a
// transport failure as an error, not a pass.

export function classifyNetworkStatus(rawStatus) {
  const text = String(rawStatus ?? '').trim();
  // Check empty/pending first: Number('') is 0 (finite), which would otherwise
  // be misread as a successful response.
  if (text === '' || text.toLowerCase() === 'pending') {
    return { kind: 'pending', code: null, text: text || 'pending' };
  }
  const code = Number(text);
  if (Number.isFinite(code)) {
    if (code >= 500) return { kind: 'server-error', code, text };
    if (code >= 400) return { kind: 'client-error', code, text };
    return { kind: 'ok', code, text };
  }
  // Anything else is a transport-layer failure surfaced as failure.errorText.
  return { kind: 'transport-error', code: null, text };
}

export function isFaviconUrl(url) {
  try {
    return new URL(String(url), 'http://_').pathname.endsWith('/favicon.ico');
  } catch {
    return String(url).endsWith('/favicon.ico');
  }
}
