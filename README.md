# Just Landed in Abu Dhabi

One static page and one Netlify function. No build step or runtime dependencies.

## File locations (relative to the repository root)

| File | Purpose |
| --- | --- |
| `public/index.html` | Title, answer-language selector, question box, button, answer area |
| `public/styles.css` | Responsive page styles |
| `public/app.js` | Sends question and language to the function; displays answer or error |
| `netlify/functions/ask.mjs` | Server-side OpenAI Responses API call |
| `netlify.toml` | Publishes only `public/` and discovers the server function |
| `package.json` | Node version and test command |
| `tests/ask.test.mjs` | Mocked server integration and error-path tests |
| `tests/app.test.mjs` | Browser request, safe rendering, and error recovery tests |
| `.gitignore` | Excludes local secrets and generated files |
| `README.md` | Setup and file map |

## Netlify setup

1. Connect this repository to a Netlify project. Keep the base directory at the repository root. No build command is needed; `netlify.toml` supplies the publish and functions directories.
2. Set `OPENAI_API_KEY` in Netlify's environment variables, with the **Functions** scope (or all scopes) for the deployment context. Use an OpenAI API key with Responses API access and API billing available. Never put the value in source code, `netlify.toml`, or frontend files.
3. Optionally set `OPENAI_MODEL` in the same environment; the default is `gpt-4.1-mini`.
4. Deploy, or redeploy after changing the environment variables. Submit a question from the deployed page to check the real service.

The selector chooses the answer language; the interface labels remain English. Answers are rendered as plain text. This step does not add conversation history, authentication, live search, or other app features.

## Verification

Run `npm test` with Node 22 or later. Tests use a mocked OpenAI endpoint, require no key, and make no external API requests. For local end-to-end development, run `npx netlify-cli dev` from this root with `OPENAI_API_KEY` provided in your local environment. Opening the HTML file alone does not run the server function.

The server uses a 25-second upstream timeout, validates input, and returns safe error messages without exposing the API key or raw provider errors.

Documentation: [OpenAI Responses API quickstart](https://developers.openai.com/api/docs/quickstart), [Netlify Functions](https://docs.netlify.com/build/functions/get-started/), [Netlify runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/).
