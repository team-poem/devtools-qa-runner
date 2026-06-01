import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyNetworkStatus, isFaviconUrl } from '../src/core/network.mjs';

test('classifyNetworkStatus maps numeric statuses', () => {
  assert.equal(classifyNetworkStatus('200').kind, 'ok');
  assert.equal(classifyNetworkStatus('301').kind, 'ok');
  assert.equal(classifyNetworkStatus('404').kind, 'client-error');
  assert.equal(classifyNetworkStatus('502').kind, 'server-error');
  assert.equal(classifyNetworkStatus(503).kind, 'server-error');
  assert.equal(classifyNetworkStatus('404').code, 404);
});

test('classifyNetworkStatus flags transport failures (the core gap)', () => {
  assert.equal(classifyNetworkStatus('net::ERR_CONNECTION_REFUSED').kind, 'transport-error');
  assert.equal(classifyNetworkStatus('net::ERR_NAME_NOT_RESOLVED').kind, 'transport-error');
  assert.equal(classifyNetworkStatus('net::ERR_BLOCKED_BY_CLIENT').kind, 'transport-error');
});

test('classifyNetworkStatus treats pending / empty as pending', () => {
  assert.equal(classifyNetworkStatus('pending').kind, 'pending');
  assert.equal(classifyNetworkStatus('').kind, 'pending');
  assert.equal(classifyNetworkStatus(null).kind, 'pending');
  assert.equal(classifyNetworkStatus(undefined).kind, 'pending');
});

test('isFaviconUrl matches favicon with and without query string', () => {
  assert.equal(isFaviconUrl('https://x/favicon.ico'), true);
  assert.equal(isFaviconUrl('https://x/favicon.ico?v=3'), true);
  assert.equal(isFaviconUrl('https://x/assets/favicon.ico?cache=1'), true);
  assert.equal(isFaviconUrl('https://x/logo.png'), false);
  assert.equal(isFaviconUrl('https://x/favicon.ico/notreally'), false);
});
