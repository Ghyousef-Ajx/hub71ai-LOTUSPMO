const languages = { en: 'English', ar: 'Arabic', hi: 'Hindi', ur: 'Urdu', fr: 'French' };
const json = (status, body, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
});

export default async function ask(request) {
  if (request.method !== 'POST') return json(405, { error: 'Use POST to ask a question.' }, { Allow: 'POST' });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'Send a JSON request.' });
  }
  let body;
  try {
    const text = await request.text();
    if (text.length > 12000) return json(413, { error: 'The request is too large.' });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'The request contains invalid JSON.' });
  }
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 2000) return json(400, { error: 'Enter a question of 1–2,000 characters.' });
  const language = body?.language ?? 'en';
  if (typeof language !== 'string' || !Object.hasOwn(languages, language)) return json(400, { error: 'Select a supported language.' });

  // The secret is read only at runtime, on the server. Never return or log it.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(503, { error: 'The answer service is not configured yet.' });
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions: `You are Just Landed in Abu Dhabi, a helpful guide for newcomers. Answer concisely in ${languages[language]} using plain text. Be honest about uncertainty. Do not invent current prices, rules, opening hours, or official sources.`,
        input: question,
        max_output_tokens: 700,
        store: false,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      return json(response.status === 429 ? 429 : 502, {
        error: response.status === 429 ? 'The answer service is busy. Please try again shortly.' : 'Could not get an answer. Please try again.',
      });
    }
    const data = await response.json();
    const answer = (data.output ?? [])
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .filter(item => item.type === 'output_text' || item.type === 'refusal')
      .map(item => item.text ?? item.refusal ?? '')
      .join('\n').trim();
    if (!answer || data.status === 'failed' || data.status === 'incomplete') {
      return json(502, { error: 'No complete answer was returned. Please try again.' });
    }
    return json(200, { answer });
  } catch (error) {
    return json(error.name === 'TimeoutError' ? 504 : 502, {
      error: error.name === 'TimeoutError' ? 'The answer service took too long. Please try again.' : 'Could not reach the answer service. Please try again.',
    });
  }
}
