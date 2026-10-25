const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/podcast');

test('parseDurationToSeconds handles HH:MM:SS', () => {
  assert.equal(handler.parseDurationToSeconds('01:02:03'), 3723);
});

test('parseDurationToSeconds handles MM:SS', () => {
  assert.equal(handler.parseDurationToSeconds('05:30'), 330);
});

test('parseDurationToSeconds handles a plain seconds string', () => {
  assert.equal(handler.parseDurationToSeconds('45'), 45);
});

test('parseDurationToSeconds returns null for empty/invalid input', () => {
  assert.equal(handler.parseDurationToSeconds(''), null);
  assert.equal(handler.parseDurationToSeconds(null), null);
  assert.equal(handler.parseDurationToSeconds('abc'), null);
});

test('every configured feed declares a sourceLabel and https url', () => {
  for (const feed of handler.FEEDS) {
    assert.ok(feed.sourceLabel);
    assert.match(feed.url, /^https:\/\//);
  }
});

test('handler returns 502 when every feed fails (full-failure status policy)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  try {
    const res = makeMockRes();
    await handler({}, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.errors.length, handler.FEEDS.length);
  } finally {
    global.fetch = originalFetch;
  }
});

function makeMockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  return res;
}
