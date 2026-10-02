# Just Landed in Abu Dhabi

One responsive page, a verbatim 100-entry knowledge base, and two Netlify functions. No frontend build step or runtime npm dependencies.

## Put these files at the repository root

| Path | Purpose | Change in this step |
| --- | --- | --- |
| `public/index.html` | Hero, language/profile settings and three input/answer/link rows | Reworked |
| `public/styles.css` | Sand, white, gold and navy styling; stacked phone layout | Reworked |
| `public/app.js` | Questions, topic browsing, document uploads and separate histories | Reworked |
| `public/topics.json` | Ten ordered categories and their clickable source questions | Added |
| `public/fonts/Inter-400.ttf` | Locally served Inter regular | Added |
| `public/fonts/Inter-500.ttf` | Locally served Inter medium | Added |
| `public/fonts/Inter-600.ttf` | Locally served Inter semibold | Added |
| `public/fonts/Inter-700.ttf` | Locally served Inter bold | Added |
| `public/fonts/OFL.txt` | Inter font license | Added |
| `netlify/functions/ask.mjs` | Matching, profile-based relevance and selected-language answers | Updated |
| `netlify/functions/explain-document.mjs` | Image/PDF explanation, actions, deadlines and printed links | Added |
| `netlify/functions/lib/knowledge.mjs` | Category loading, exact lookup, match threshold and source responses | Updated |
| `netlify/functions/lib/service.mjs` | Shared validation, OpenAI calls, language/profile handling and safe errors | Added |
| `netlify/functions/data/knowledge-base.json` | All 100 source entries grouped into ten categories | Regrouped; entry content unchanged |
| `netlify/functions/data/Just-Landed-100-questions.pdf` | Original supplied source for reproducible extraction | Unchanged |
| `scripts/extract-knowledge.py` | Reproduce grouped knowledge data and public question catalogue | Updated |
| `tests/ask.test.mjs` | Request validation, semantic-selection mock and service errors | Updated |
| `tests/knowledge.test.mjs` | All 100 exact answers, categories and weak/no-match behavior | Updated |
| `tests/context.test.mjs` | Eight languages, profiles, grounded tailoring and plain text | Added |
| `tests/document.test.mjs` | PDF/image input, question/context, upload validation and URL handling | Added |
| `tests/app.test.mjs` | Previous single-form UI mock | Removed; obsolete after the page rework |
| `README.md` | This setup guide and change map | Updated |
| `netlify.toml` | Publishes `public/`, with functions in `netlify/functions/` | Unchanged |
| `package.json` | Node 22+ and `npm test` | Unchanged |
| `.gitignore` | Excludes secrets and generated local files | Unchanged |

## Netlify setup

1. Use the repository root as the base directory. No build command is required. `netlify.toml` specifies `public` for publishing and `netlify/functions` for the server functions. Uploading only the public folder does not deploy the functions.
2. Set `OPENAI_API_KEY` in Netlify environment variables with Functions scope (or all scopes), for the deployment context. Keep the secret out of code, frontend files and `netlify.toml`.
3. `OPENAI_MODEL` is optional; the default is `gpt-4.1-mini`. A replacement model must support Responses, structured outputs, images and PDF inputs.
4. Deploy or redeploy after changing runtime environment variables. Check a typed question, a topic question and a document on the deployed app.

The functions access the key only at runtime via `process.env.OPENAI_API_KEY`. They do not return or log it. API requests use `store: false`. Uploaded files are passed inline to OpenAI for analysis and are not saved by the app.

## Knowledge data and matching

The ten categories appear in exactly this order: Residency & Documents, Housing, Schools, Healthcare, Daily Life, Family, Money & Banking, Work & Legal, Safety, Long-Term. Every entry appears once. Original question numbers are retained, including when regrouping places them outside numeric order.

All 100 original entry objects and 185 URL occurrences are unchanged from the previous extraction. The grouped JSON preserves answers, source descriptions, source qualifications and links exactly. Only PDF layout indentation, page breaks and URL wrapping were removed during the original extraction. No facts, links, corrections or updated rules have been added to the knowledge data.

`python3 scripts/extract-knowledge.py` recreates the grouped JSON and `public/topics.json` using Poppler's `pdftotext`. Preservation was checked against both the previous JSON and a second independent extraction with `pdftotext -raw`: all question and answer words, source descriptions and URLs occur in that source text after ignoring layout whitespace.

Exact English questions with an empty profile return the original answer without calling OpenAI. Rephrased or non-English questions are matched by meaning against all 100 questions. A valid entry ID with model confidence at least `0.85` is treated as a strong match. Confidence is a heuristic, not a calibrated probability.

For a strong match, English answers without a profile remain verbatim. For another language or a supplied profile, OpenAI translates and prioritises the stored answer using only its facts; requirements, numbers, deadlines and caveats must remain intact. This satisfies personalised, selected-language output while keeping the source JSON untouched. The server attaches the original source links directly from JSON and includes the original English answer in `originalAnswer`; links are never generated for a knowledge-base match.

For a weak or absent match, the model gives general guidance in the selected language, tailored to the profile, and the app marks it exactly `check official portals`. TAMM and ICP portal URLs, both already present in the source, accompany general guidance. Service and configuration failures show errors instead of being misrepresented as no match.

## Page and history

The three rows are Ask a Question, Browse by Topic, and Ask About a Document. On a desktop each row has input on the left, history in the middle and links on the right. On phones those panels stack in that order.

Five suggestion chips populate the question box for review before submission. The topic dropdown lists all ten categories, with clickable source questions beneath it. Each row keeps its own history: newest open, older collapsed. Opening an older answer selects its links in that row. Answers persist in session storage across reloads in the same tab; uploaded file bytes and profile fields are not persisted. If session storage is unavailable, histories still work in memory.

Language, name, country, arrival date, number of adults, children's ages, spouse status and employer type are sent with every question, topic question and document request. Country suggestions use the browser's English country names. Languages: English, Arabic, Hindi, Urdu, Tagalog, Russian, French and Chinese. Arabic and Urdu answers use automatic text direction. Answer text is never rendered as HTML or Markdown. All HTTP(S) links open a new tab/window using `target="_blank"` and `rel="noopener noreferrer"`.

The hero shows today's date in Asia/Dubai time. Inter font files are bundled locally under the SIL Open Font License.

## Status lines

Each answer has one coloured status line. Current knowledge-base and general answers use amber: `Check for information updates from the Abu Dhabi official portals — links provided.` Document explanations use blue: `Document explanation — check the issuing authority for confirmation.`

The green styling/text is implemented: `This information is verified from Abu Dhabi official portals.` It requires server-provided verified provenance. The supplied document includes unofficial sources and has not been checked against current live portal content, so the server does not label it verified. Selecting a government link alone does not establish verification.

## Documents

Upload one PDF, JPG, PNG or WebP, up to 3 MB, with an optional question. Both client and server enforce the size/type limits; the server also checks file signatures. The model receives a PDF as `input_file` or an image as `input_image`, with the question, current Abu Dhabi date, selected language and optional profile. It is instructed to explain the document, next actions and deadlines, distinguish dates from deadlines, report unreadable text and never invent missing deadlines. Only complete HTTP(S) links printed in the document are requested; unsafe URL schemes and embedded credentials are rejected.

The 3 MB limit leaves room for Netlify's binary request encoding overhead. Both functions use a 45-second overall upstream timeout, below Netlify's synchronous function limit. Password-protected, damaged or unreadable documents may need a readable copy; provider errors are shown without leaking their raw details.

## Checks

Run `npm test` with Node 22 or newer. Tests use mocked OpenAI responses and require no API key. They verify all 100 exact entries, category order, profiles, eight languages, strong/weak matching, source links, plain text, file input construction and upload/error validation. Real translation accuracy, semantic matching quality and document reading require testing with your Netlify OpenAI key; no live API calls were made here.

Browser checks also passed with mocked responses: five chips, ten categories, eight language options, country suggestions, profile transmission, three separate histories, older-answer link selection, fallback marking, document uploads, error recovery and history after a reload. Screenshots were reviewed on desktop and phone; no horizontal overflow was found at 320, 390, 768 or 1440 pixels.

For local end-to-end development, run `npx netlify-cli dev` from the repository root with `OPENAI_API_KEY` provided in your local environment. Opening `index.html` alone cannot run the server functions.

Documentation: [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [OpenAI images and vision](https://developers.openai.com/api/docs/guides/images-vision), [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Netlify functions configuration](https://docs.netlify.com/build/functions/configuration/), [Netlify runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/).
