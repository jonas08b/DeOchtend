const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/news');

test('categorize respects an explicit feed hint over keywords', () => {
  assert.equal(handler.categorize('economie', 'Regering valt', ''), 'economie');
});

test('categorize infers politiek from keywords when no hint is set', () => {
  assert.equal(handler.categorize(null, 'Federale regering bereikt akkoord', ''), 'politiek');
});

test('categorize infers economie from keywords when no hint is set', () => {
  assert.equal(handler.categorize(null, 'Inflatie daalt verder in oktober', ''), 'economie');
});

test('categorize falls back to overige when nothing matches', () => {
  assert.equal(handler.categorize(null, 'Nieuwe tentoonstelling opent in museum', ''), 'overige');
});

test('parsePubDate treats RSS2JSON\'s "YYYY-MM-DD HH:MM:SS" as UTC', () => {
  const d = handler.parsePubDate('2026-01-15 09:30:00');
  assert.equal(d.toISOString(), '2026-01-15T09:30:00.000Z');
});

test('parsePubDate returns null for unparsable input', () => {
  assert.equal(handler.parsePubDate('not a date'), null);
  assert.equal(handler.parsePubDate(''), null);
});

test('dedupe removes exact URL duplicates and near-identical titles, keeps distinct articles', () => {
  const articles = [
    { url: 'https://example.com/a', title: 'Regering valt na crisis' },
    { url: 'https://example.com/a', title: 'Regering valt na crisis' }, // exact dup
    { url: 'https://example.com/a-reacties', title: 'Regering valt na crisis — reacties' }, // near dup
    { url: 'https://example.com/b', title: 'Beurs stijgt fors' } // distinct
  ];
  const out = handler.dedupe(articles);
  assert.equal(out.length, 2);
});

test('dedupe drops articles with unsafe or missing URLs', () => {
  const out = handler.dedupe([
    { url: 'javascript:alert(1)', title: 'x' },
    { url: '', title: 'y' }
  ]);
  assert.equal(out.length, 0);
});

test('every configured feed declares a source and url', () => {
  for (const feed of handler.FEEDS) {
    assert.ok(feed.source);
    assert.match(feed.url, /^https:\/\//);
  }
});

test('handler returns 502 when every feed fails (full-failure status policy)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    const res = makeMockRes();
    await handler(makeMockReq(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.errors.length, handler.FEEDS.length);
  } finally {
    global.fetch = originalFetch;
  }
});

function makeMockReq() { return {}; }
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
