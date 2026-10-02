const form = document.querySelector('#question-form');
const button = form.querySelector('button');
const status = document.querySelector('#status');
const answerSection = document.querySelector('#answer-section');
const answer = document.querySelector('#answer');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  const question = form.elements.question.value.trim();
  if (!question) {
    status.textContent = 'Please type a question.';
    status.dataset.error = 'true';
    form.elements.question.focus();
    return;
  }
  const language = form.elements.language.value;
  button.disabled = true;
  button.textContent = 'Getting answer…';
  status.textContent = 'Getting your answer…';
  status.dataset.error = 'false';
  answerSection.hidden = true;
  answer.textContent = '';
  try {
    const response = await fetch('/.netlify/functions/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not get an answer. Please try again.');
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('No answer was returned. Please try again.');
    answer.textContent = data.answer;
    answer.lang = language;
    answerSection.hidden = false;
    status.textContent = 'Your answer is ready.';
  } catch (error) {
    status.dataset.error = 'true';
    status.textContent = error.name === 'TimeoutError'
      ? 'The request took too long. Please try again.'
      : error instanceof TypeError || error instanceof SyntaxError
        ? 'Could not reach the answer service. Please try again.'
        : error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Get Answer';
  }
});
