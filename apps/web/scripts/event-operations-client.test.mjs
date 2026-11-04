import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, readPendingCheckIns, isNetworkFailure } from '../lib/event-operations-client.ts';
test('pending check-ins reject cross-event, malformed, expired, and future entries', () => {
  const row = { eventId: 'event', registrationId: 'registration', requestId: '12345678-1234-1234-1234-123456789abc', expectedRevision: 2, queuedAt: 1_000_000 };
  assert.deepEqual(readPendingCheckIns(JSON.stringify([row, {...row, eventId: 'other'}, {...row, expectedRevision: -1}, {...row, queuedAt: 1}, {...row, queuedAt: 1_000_001}]), 'event', 1_000_000), [row]);
  assert.deepEqual(readPendingCheckIns(JSON.stringify([{...row, qrCodeData: 'secret', sellerName: 'private'}]), 'event', 1_000_000), [row]);
  assert.deepEqual(readPendingCheckIns('bad json', 'event', 1_000_000), []);
  assert.equal(readPendingCheckIns(JSON.stringify(Array(100).fill(row)), 'event', 1_000_000).length, 40);
});
test('roster export escapes formulas, quotes and embedded newlines', () => {
  assert.equal(csvCell('  =HYPERLINK("x")'), '"\'  =HYPERLINK(""x"")"');
  assert.equal(csvCell('a\nb'), '"a\nb"');
});
test('only connectivity failures qualify for retry', () => {
  assert.equal(isNetworkFailure(new Error('Failed to fetch')), true);
  assert.equal(isNetworkFailure(new Error('Unauthorized connection')), false);
  assert.equal(isNetworkFailure(new Error('Revision conflict')), false);
});
