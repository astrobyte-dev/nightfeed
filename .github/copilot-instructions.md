# GitHub Copilot instructions

**The substantive project instructions live in `/CLAUDE.md` at the repo root.** Read that first. Everything in it applies equally to Copilot.

Copilot-specific notes only below.

## How to use the CLAUDE.md context

- For Copilot Chat: paste `@workspace` and refer to `CLAUDE.md` by name when answering. The model picks it up via workspace indexing.
- For inline Copilot suggestions: there's no formal mechanism to "load" CLAUDE.md, but having the file open in a side tab while editing biases suggestions toward its conventions.

## Per-file hints Copilot tends to need

- This is **JavaScript, not TypeScript.** Do not suggest type annotations or `.ts` files.
- Frontend imports use the `@/` alias for `src/` (set up in `vite.config.js` and `jsconfig.json`). Prefer `@/utils/...` over `../../../utils/...`.
- Backend is ESM (`"type": "module"`). Use `import`, not `require`. Use `node:fs` style for builtins.
- No new state-management libraries. State lives in React hooks + localStorage + (where appropriate) IndexedDB.
- Tests use **Vitest** (frontend) and **`node:test`** (backend). Do not suggest Jest, Mocha, or Cypress.

## Style reminders

- 2-space indent, single quotes, no trailing commas, semicolons.
- No em dashes in prose. Commas, periods, parentheses, semicolons.
- Files over 200 lines are a smell. Suggest refactors, don't grow them.
- Early returns over nested conditions.

## Don't suggest

- Adding TypeScript, even "just for this file."
- Reaching for `lodash` or `ramda` for things `Array.prototype` already does.
- `prop-types` (we don't use them; that's intentional, see `eslint.config.js`).
- New CSS frameworks (Tailwind, etc.). The project uses custom CSS with CSS variables.
- `npm install --force` or `--legacy-peer-deps`.
