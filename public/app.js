const $ = selector => document.querySelector(selector);
const language = $('#language');
const profileForm = $('#profile-form');
const states = Object.fromEntries(['ask', 'browse', 'document'].map(id => [id, {
  id, history: [], busy: false, historyNode: $(`#${id}-history`), linksNode: $(`#${id}-links`), message: $(`#${id}-message`),
}]));
const HISTORY_KEY = 'just-landed-history-v2';
const STATUS = {
  verified: 'This information is verified from Abu Dhabi official portals.',
  updates: 'Check for information updates from the Abu Dhabi official portals — links provided.',
  document: 'Document explanation — check the issuing authority for confirmation.',
};
let topics = [];

function updateDate() {
  const now = new Date();
  $('#today').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  $('#today').dateTime = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
updateDate();

const countryCodes = 'AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ');
if (typeof Intl.DisplayNames === 'function') {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = countryCodes.map(code => names.of(code)).sort((a, b) => a.localeCompare(b));
  for (const country of countries) { const option = document.createElement('option'); option.value = country; $('#country-suggestions').append(option); }
}

function readProfile() {
  if (!profileForm.checkValidity()) {
    $('#profile-settings').open = true;
    profileForm.reportValidity();
    throw new Error('Please check your optional profile fields.');
  }
  const fields = profileForm.elements;
  const ages = fields.childrenAges.value.trim();
  if (ages && (!/^\d{1,2}(\s*,\s*\d{1,2})*$/.test(ages) || ages.split(',').some(age => Number(age) > 25) || ages.split(',').length > 20)) {
    $('#profile-settings').open = true;
    fields.childrenAges.focus();
    throw new Error('Enter children’s ages from 0 to 25, separated by commas.');
  }
  return {
    name: fields.name.value.trim(), country: fields.country.value.trim(), arrival: fields.arrival.value,
    adults: fields.adults.value ? Number(fields.adults.value) : null,
    childrenAges: ages ? ages.split(',').map(Number) : [], spouse: fields.spouse.value, employerType: fields.employerType.value,
  };
}

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function appendLink(parent, url) {
  if (!safeUrl(url)) return;
  const link = document.createElement('a');
  link.href = url; link.textContent = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'source-link';
  parent.append(link);
}
function renderLinks(state, data) {
  state.linksNode.replaceChildren();
  const shown = new Set();
  for (const source of data.sources || []) {
    const item = document.createElement('div'); item.className = 'source-item';
    const label = document.createElement('p'); label.className = 'source-label'; label.textContent = source.text;
    item.append(label);
    for (const url of source.links || []) { appendLink(item, url); shown.add(url); }
    state.linksNode.append(item);
  }
  for (const url of data.links || []) {
    if (shown.has(url)) continue;
    const item = document.createElement('div'); item.className = 'source-item'; appendLink(item, url);
    state.linksNode.append(item);
  }
  if (!state.linksNode.childElementCount) {
    const text = document.createElement('p'); text.className = 'empty-state';
    text.textContent = data.kind === 'document' ? 'No links were identified in this document.' : 'No links were provided for this answer.';
    state.linksNode.append(text);
  }
}
function statusFor(data) {
  if (data.kind === 'document') return 'document';
  // Only server-confirmed provenance can request a verified status; current KB is amber.
  return data.status === 'verified' ? 'verified' : 'updates';
}
function renderHistory(state) {
  if (!state.history.length) return;
  state.historyNode.replaceChildren();
  const detailsNodes = [];
  for (const [index, record] of state.history.entries()) {
    const details = document.createElement('details'); details.className = 'history-entry'; details.setAttribute('name', `${state.id}-answers`); details.open = index === 0;
    const summary = document.createElement('summary');
    const title = document.createElement('span'); title.className = 'history-question'; title.textContent = record.question;
    summary.append(title); details.append(summary);
    if (record.data.marker) { const marker = document.createElement('span'); marker.className = 'fallback-marker'; marker.textContent = record.data.marker; details.append(marker); }
    const answer = document.createElement('div'); answer.className = 'answer-text'; answer.dir = 'auto'; answer.lang = record.data.language || 'en';
    answer.textContent = record.data.answerLabel && record.data.answerLabel !== 'Answer:' ? `${record.data.answerLabel} ${record.data.answer}` : record.data.answer;
    const status = document.createElement('p'); const kind = statusFor(record.data); status.className = `answer-status ${kind}`; status.textContent = STATUS[kind];
    details.append(answer, status);
    details.addEventListener('toggle', () => {
      if (!details.open || !details.isConnected) return;
      for (const other of detailsNodes) if (other !== details) other.open = false;
      renderLinks(state, record.data);
    });
    detailsNodes.push(details); state.historyNode.append(details);
  }
  renderLinks(state, state.history[0].data);
}
function persistHistory() {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(Object.fromEntries(Object.values(states).map(s => [s.id, s.history])))); } catch { /* History still works in memory if storage is unavailable. */ }
}
try {
  const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '{}');
  for (const state of Object.values(states)) {
    if (Array.isArray(saved[state.id])) state.history = saved[state.id].filter(record => typeof record.question === 'string' && typeof record.data?.answer === 'string');
    renderHistory(state);
  }
} catch { /* Ignore unavailable or invalid session history. */ }

function setBusy(state, busy, message = '') {
  state.busy = busy;
  state.historyNode.setAttribute('aria-busy', String(busy));
  state.message.textContent = message; state.message.dataset.error = 'false';
  if (state.id === 'ask') { $('#ask-button').disabled = busy; $('#ask-button').textContent = busy ? 'Getting Answer…' : 'Get Answer'; }
  if (state.id === 'browse') for (const button of $('#topic-questions').querySelectorAll('button')) button.disabled = busy;
  if (state.id === 'document') { $('#document-button').disabled = busy; $('#document-button').textContent = busy ? 'Explaining…' : 'Explain Document'; }
}
async function send(state, question, requestFactory) {
  if (state.busy) return;
  setBusy(state, true, state.id === 'document' ? 'Reading your document…' : 'Getting your answer…');
  try {
    const profile = readProfile();
    const chosenLanguage = language.value;
    const { url, options } = requestFactory(profile, chosenLanguage);
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
    let data;
    try { data = await response.json(); } catch { throw new Error('The service returned an unreadable response. Please try again.'); }
    if (!response.ok) throw new Error(data.error || 'Could not get an answer. Please try again.');
    if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('No answer was returned. Please try again.');
    state.history.unshift({ question, data }); renderHistory(state); persistHistory();
    setBusy(state, false, 'Your answer is ready.');
  } catch (error) {
    setBusy(state, false);
    state.message.dataset.error = 'true';
    state.message.textContent = error.name === 'TimeoutError' ? 'The request took too long. Please try again.' : error instanceof TypeError ? 'Could not reach the service. Please try again.' : error.message;
  }
}
function ask(state, question) {
  return send(state, question, (profile, chosenLanguage) => ({
    url: '/.netlify/functions/ask', options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, profile, language: chosenLanguage }) },
  }));
}
$('#question-form').addEventListener('submit', event => {
  event.preventDefault();
  const question = $('#question').value.trim();
  if (!question) { states.ask.message.textContent = 'Please type a question.'; states.ask.message.dataset.error = 'true'; return; }
  ask(states.ask, question);
});
profileForm.addEventListener('submit', event => event.preventDefault());

function renderQuestions() {
  const category = topics.find(topic => topic.name === $('#topic').value);
  $('#topic-questions').replaceChildren();
  for (const entry of category?.questions || []) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'topic-question'; button.textContent = entry.question; button.disabled = states.browse.busy; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (states.browse.busy) return;
      for (const other of $('#topic-questions').querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
      ask(states.browse, entry.question);
    });
    $('#topic-questions').append(button);
  }
}
$('#topic').addEventListener('change', renderQuestions);
async function loadTopics() {
  try {
    const response = await fetch('/topics.json');
    if (!response.ok) throw new Error('Topics are unavailable. Please reload the page.');
    topics = await response.json();
    $('#topic').replaceChildren();
    for (const topic of topics) { const option = document.createElement('option'); option.value = topic.name; option.textContent = topic.name; $('#topic').append(option); }
    $('#topic').disabled = false; renderQuestions();
    const all = topics.flatMap(topic => topic.questions);
    for (const [id, label] of [[12, 'Emirates ID'], [2, 'Family sponsorship'], [29, 'Finding a school'], [36, 'Health insurance'], [52, 'Opening a bank account']]) {
      const entry = all.find(entry => entry.id === id);
      const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'chip'; chip.textContent = label; chip.title = entry.question; chip.setAttribute('aria-label', entry.question);
      chip.addEventListener('click', () => { $('#question').value = entry.question; $('#question').focus(); });
      $('#suggested-questions').append(chip);
    }
  } catch (error) {
    states.browse.message.dataset.error = 'true'; states.browse.message.textContent = error.message;
  }
}
loadTopics();

$('#document-form').addEventListener('submit', event => {
  event.preventDefault();
  const file = $('#document-file').files[0];
  const state = states.document;
  if (!file || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024 || !file.size) {
    state.message.dataset.error = 'true'; state.message.textContent = 'Choose a PDF, JPG, PNG or WebP file up to 3 MB.'; return;
  }
  const question = $('#document-question').value.trim();
  send(state, question ? `${file.name} — ${question}` : file.name, (profile, chosenLanguage) => {
    const form = new FormData(); form.append('document', file); form.append('question', question); form.append('language', chosenLanguage); form.append('profile', JSON.stringify(profile));
    return { url: '/.netlify/functions/explain-document', options: { method: 'POST', body: form } };
  });
});
