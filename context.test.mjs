import test from 'node:test';
import assert from 'node:assert/strict';
import ask from '../netlify/functions/ask.mjs';
import { knowledgeBase } from '../netlify/functions/lib/knowledge.mjs';
import { languages, parseContext, plainText } from '../netlify/functions/lib/service.mjs';

test('every requested language and optional profile reach grounded answering', async t => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  process.env.OPENAI_API_KEY = 'test-fixture-only';
  const profile = { name: 'Sam', country: 'United Kingdom', arrival: '2026-10-02', adults: 2, childrenAges: [3, 7], spouse: 'coming_will_work', employerType: 'private' };
  for (const [language, label] of Object.entries(languages)) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const payload = JSON.parse(options.body);
      assert.match(payload.instructions, new RegExp(`Answer in ${label}`));
      assert.ok(payload.instructions.includes(JSON.stringify(profile)));
      assert.match(payload.instructions, /Do not add facts/);
      assert.equal(JSON.parse(payload.input).sourceAnswer, knowledgeBase[35].answer);
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: `**${label} response**` }] }] });
    };
    const response = await ask(new Request('https://example.test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: knowledgeBase[35].question, language, profile }),
    }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.answer, `${label} response`);
    assert.equal(data.language, language);
    assert.deepEqual(data.links, knowledgeBase[35].links);
    assert.equal(data.originalAnswer, knowledgeBase[35].answer);
    assert.equal(data.status, 'updates');
  }
});
test('profile validation and plain-text format', () => {
  for (const profile of [{ adults: -1 }, { adults: 2.5 }, { arrival: '2026-02-30' }, { childrenAges: [-1] }, { spouse: 'invented' }, []]) assert.throws(() => parseContext({ profile }));
  assert.deepEqual(parseContext({ profile: { name: '', adults: null, childrenAges: [] } }).profile, {});
  assert.equal(plainText('# Title\n**Text** with [portal](https://u.ae) and `code`'), 'Title\nText with portal and code');
});
