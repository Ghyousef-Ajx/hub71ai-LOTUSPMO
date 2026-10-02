import test from 'node:test';
import assert from 'node:assert/strict';
import ask from '../netlify/functions/ask.mjs';
import { knowledgeBase } from '../netlify/functions/lib/knowledge.mjs';

const request = body => new Request('https://example.test/.netlify/functions/ask', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('validation, server-only environment key, upstream request and errors', async t => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  });
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected API call'); };
  assert.equal((await ask(new Request('https://example.test'))).status, 405);
  assert.equal((await ask(request(null))).status, 400);
  assert.equal((await ask(request({ question: '   ' }))).status, 400);
  assert.equal((await ask(request({ question: 'x'.repeat(2001) }))).status, 400);
  assert.equal((await ask(request({ question: 'Hello', language: '__proto__' }))).status, 400);
  assert.equal((await ask(request({ question: 'Hello' }))).status, 503);
  assert.equal(calls, 0);
  assert.equal((await ask(new Request('https://example.test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  }))).status, 400);

  // Synthetic fixture only: no real credential is stored or used by these tests.
  process.env.OPENAI_API_KEY = 'test-fixture-only';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-fixture-only');
    const payload = JSON.parse(options.body);
    assert.equal(payload.input, 'Where can I get a taxi?');
    assert.match(payload.instructions, /English/);
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'gpt-4.1-mini');
    assert.equal(payload.text.format.type, 'json_schema');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ entry_id: 45, confidence: .95, general_answer: '' }) }] }] });
  };
  const success = await ask(request({ question: ' Where can I get a taxi? ', language: 'en' }));
  assert.equal(success.status, 200);
  const matched = await success.json();
  assert.equal(matched.answer, knowledgeBase[44].answer);
  assert.deepEqual(matched.links, knowledgeBase[44].links);
  assert.equal(matched.language, 'en');
  assert.equal(success.headers.get('cache-control'), 'no-store');

  for (const upstreamStatus of [401, 429, 500]) {
    globalThis.fetch = async () => new Response('Private provider error', { status: upstreamStatus });
    const result = await ask(request({ question: 'Hello' }));
    assert.equal(result.status, upstreamStatus === 429 ? 429 : 502);
    assert.doesNotMatch(await result.text(), /Private provider error|test-fixture-only/);
  }
  globalThis.fetch = async () => Response.json({ output: [] });
  assert.equal((await ask(request({ question: 'Hello' }))).status, 502);
  globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  assert.equal((await ask(request({ question: 'Hello' }))).status, 504);
});
