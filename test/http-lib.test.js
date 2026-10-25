const test = require('node:test');
const assert = require('node:assert/strict');
const { isSafeHttpUrl, stripHtml, truncate, titlesAreSimilar, normalizeTitleForDedupe } = require('../api/_lib/http');

test('isSafeHttpUrl accepts only http/https', () => {
  assert.equal(isSafeHttpUrl('https://example.com/a'), true);
  assert.equal(isSafeHttpUrl('http://example.com/a'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,hi'), false);
  assert.equal(isSafeHttpUrl('not a url'), false);
});

test('stripHtml removes tags and decodes common entities, never leaves markup', () => {
  const out = stripHtml('<p>Hello &amp; <b>world</b></p>');
  assert.equal(out, 'Hello & world');
  assert.ok(!out.includes('<'));
});

test('stripHtml unwraps CDATA sections', () => {
  const out = stripHtml('<![CDATA[Some <i>text</i>]]>');
  assert.equal(out, 'Some text');
});

test('truncate shortens long text and leaves short text untouched', () => {
  assert.equal(truncate('short', 220), 'short');
  const long = 'x'.repeat(300);
  const out = truncate(long, 220);
  assert.equal(out.length, 220);
  assert.ok(out.endsWith('…'));
});

test('normalizeTitleForDedupe ignores case and punctuation', () => {
  assert.equal(
    normalizeTitleForDedupe('Regering valt, zegt minister!'),
    normalizeTitleForDedupe('regering VALT zegt minister')
  );
});

test('titlesAreSimilar catches exact and near-duplicate titles', () => {
  assert.equal(titlesAreSimilar('Regering valt na crisisberaad', 'Regering valt na crisisberaad'), true);
  assert.equal(
    titlesAreSimilar('Regering valt na lang crisisberaad', 'Regering valt na lang crisisberaad — reacties'),
    true
  );
  assert.equal(titlesAreSimilar('Regering valt', 'Beurs stijgt fors'), false);
});
