import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('frontend sends selected language, displays text, and recovers after errors', async () => {
  const button = { disabled: false, textContent: 'Get Answer' };
  const status = { textContent: '', dataset: {} };
  const section = { hidden: true };
  const answer = { textContent: '' };
  let submit;
  const form = {
    elements: { question: { value: ' Hello ', focus() {} }, language: { value: 'ar' } },
    querySelector: () => button,
    addEventListener: (_, handler) => { submit = handler; },
  };
  const nodes = { '#question-form': form, '#status': status, '#answer-section': section, '#answer': answer };
  let resolveRequest;
  const context = vm.createContext({
    document: { querySelector: selector => nodes[selector] },
    AbortSignal, TypeError, SyntaxError,
    fetch: async (url, options) => {
      assert.equal(url, '/.netlify/functions/ask');
      assert.deepEqual(JSON.parse(options.body), { question: 'Hello', language: 'ar' });
      return await new Promise(resolve => { resolveRequest = resolve; });
    },
  });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  const pending = submit({ preventDefault() {} });
  assert.equal(button.disabled, true);
  resolveRequest({ ok: true, json: async () => ({ answer: '<script>untrusted text</script>' }) });
  await pending;
  assert.equal(answer.textContent, '<script>untrusted text</script>');
  assert.equal(answer.lang, 'ar');
  assert.equal(section.hidden, false);
  assert.equal(button.disabled, false);
  context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Service busy' }) });
  await submit({ preventDefault() {} });
  assert.equal(status.textContent, 'Service busy');
  assert.equal(section.hidden, true);
  assert.equal(button.disabled, false);
});
