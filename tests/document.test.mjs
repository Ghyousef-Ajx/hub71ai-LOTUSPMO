import test from 'node:test';
import assert from 'node:assert/strict';
import explain, { MAX_FILE_BYTES } from '../netlify/functions/explain-document.mjs';

function upload(bytes, type, name, extra = {}) {
  const form = new FormData();
  if (bytes) form.append('document', new Blob([bytes], { type }), name);
  for (const [key, value] of Object.entries(extra)) form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  return new Request('https://example.test/.netlify/functions/explain-document', { method: 'POST', body: form });
}
test('PDF and image inputs include the question, selected language, profile, dates and safe links', async t => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
  process.env.OPENAI_API_KEY = 'test-fixture-only';
  const fixtures = [
    [Buffer.from('%PDF-1.7 test fixture'), 'application/pdf', 'notice.pdf', 'input_file'],
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), 'image/png', 'notice.png', 'input_image'],
  ];
  for (const [bytes, type, name, expectedType] of fixtures) {
    globalThis.fetch = async (_, options) => {
      const payload = JSON.parse(options.body);
      assert.match(payload.instructions, /Answer in French/);
      assert.match(payload.instructions, /never invent it/);
      assert.match(payload.instructions, /Today.s date in Abu Dhabi is \d{4}-\d{2}-\d{2}/);
      assert.match(payload.instructions, /Sam/);
      const content = payload.input[0].content;
      assert.equal(content[0].type, expectedType);
      assert.ok((content[0].file_data || content[0].image_url).startsWith(`data:${type};base64,`));
      assert.equal(content[1].text, 'What is the deadline?');
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'Document explanation', links: ['https://www.tamm.abudhabi', 'javascript:alert(1)', 'https://user:pass@example.test'] }) }] }] });
    };
    const response = await explain(upload(bytes, type, name, { language: 'fr', profile: { name: 'Sam' }, question: 'What is the deadline?' }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.kind, 'document'); assert.equal(data.status, 'document');
    assert.equal(data.language, 'fr'); assert.deepEqual(data.links, ['https://www.tamm.abudhabi']);
  }
});
test('missing, wrong-format, disguised and oversized uploads are rejected before OpenAI', async () => {
  assert.equal((await explain(upload(null))).status, 400);
  assert.equal((await explain(upload('plain text', 'text/plain', 'test.txt'))).status, 415);
  assert.equal((await explain(upload('not a PDF', 'application/pdf', 'test.pdf'))).status, 415);
  const large = Buffer.alloc(MAX_FILE_BYTES + 1); large.write('%PDF-');
  assert.equal((await explain(upload(large, 'application/pdf', 'large.pdf'))).status, 413);
  assert.equal((await explain(new Request('https://example.test'))).status, 405);
});
