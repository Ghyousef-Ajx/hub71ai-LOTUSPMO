import test from 'node:test';
import assert from 'node:assert/strict';
import ask from '../netlify/functions/ask.mjs';
import { knowledgeBase, categories, resolveDecision, officialPortalLinks } from '../netlify/functions/lib/knowledge.mjs';

test('all 100 exact questions return their original answer and links without OpenAI', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = () => { throw new Error('Exact matches must not call OpenAI'); };
  assert.deepEqual(knowledgeBase.map(entry => entry.id), Array.from({ length: 100 }, (_, i) => i + 1));
  for (const entry of knowledgeBase) {
    const response = await ask(new Request('https://example.test/.netlify/functions/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: entry.question, language: 'en', profile: {} }),
    }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.answer, entry.answer);
    assert.equal(data.answerLabel, entry.answerLabel);
    assert.deepEqual(data.sources, entry.sources);
    assert.deepEqual(data.links, entry.links);
    assert.equal(data.marker, null);
  }
});

test('weak or absent matches carry the marker and existing official portal links', () => {
  for (const [entry_id, confidence] of [[14, .84], [null, .95], [null, 0]]) {
    const result = resolveDecision({ entry_id, confidence, general_answer: 'General guidance' }, 'fr');
    assert.equal(result.kind, 'general');
    assert.equal(result.marker, 'check official portals');
    assert.deepEqual(result.links, officialPortalLinks);
    assert.equal(result.language, 'fr');
  }
  const result = resolveDecision({ entry_id: 14, confidence: .85, general_answer: 'Ignore this generated answer' }, 'en');
  assert.equal(result.entry.answer, knowledgeBase[13].answer);
  assert.throws(() => resolveDecision({ entry_id: 101, confidence: 1, general_answer: '' }, 'en'));
  assert.throws(() => resolveDecision({ entry_id: null, confidence: 0, general_answer: '' }, 'en'));
});

test('ten categories use the requested order and preserve the complete source data', () => {
  assert.deepEqual(categories.map(category => category.name), [
    'Residency & Documents', 'Housing', 'Schools', 'Healthcare', 'Daily Life',
    'Family', 'Money & Banking', 'Work & Legal', 'Safety', 'Long-Term',
  ]);
  assert.equal(new Set(categories.flatMap(category => category.entries.map(e => e.id))).size, 100);
  assert.equal(knowledgeBase.reduce((sum, entry) => sum + entry.links.length, 0), 185);
  for (const url of officialPortalLinks) assert.ok(knowledgeBase.some(entry => entry.links.includes(url)));
});
