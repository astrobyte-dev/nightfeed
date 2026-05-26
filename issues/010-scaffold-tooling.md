# 010 — Scaffold project tooling (ESLint, Prettier, Vitest, jsconfig, .vscode, CI)

## Parent PRD

None. This is infrastructure that every other issue depends on. Block all other new work behind this.

## Why this first

We cannot ask Claude or Copilot to "run lint" or "run tests" when neither exists. Every future issue's acceptance criteria depend on a working static-check + test layer. This issue stands that layer up.

## What to build

### 1. Repo root

- `.editorconfig` with `indent_style=space`, `indent_size=2`, `end_of_line=lf`, `charset=utf-8`, `insert_final_newline=true`, `trim_trailing_whitespace=true` (except `*.md`).
- `.prettierrc.json` with `semi=true, singleQuote=true, trailingComma=none, printWidth=100, arrowParens=always`.
- `.prettierignore` excluding `node_modules`, `dist`, `package-lock.json`.
- Root `package.json` gains scripts:
  - `lint` — runs lint in both workspaces.
  - `test` — runs test in both workspaces.
  - Add `"engines": { "node": ">=20" }`.
- `.github/workflows/ci.yml` running `npm install`, `npm run lint`, `npm test`, `npm run build` on push and PR.

### 2. Frontend (`frontend/`)

- `eslint.config.js` (flat config) with `@eslint/js` recommended + `eslint-plugin-react` + `eslint-plugin-react-hooks`. `no-console: warn` (allow `warn`, `error`). `no-unused-vars: warn` with `argsIgnorePattern: '^_'`.
- `jsconfig.json` with `moduleResolution: Bundler`, `jsx: react-jsx`, `baseUrl: src`, `paths: { "@/*": ["*"] }`.
- `vite.config.js` updated with the `@` -> `./src` alias.
- `vitest.config.js` with `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.js']`.
- `src/test/setup.js` importing `@testing-library/jest-dom`.
- New devDependencies: `eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `globals`, `prettier`, `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- Scripts: `lint`, `lint:fix`, `test`, `test:ui`.

### 3. Backend (`backend/`)

- `eslint.config.js` flat config, Node globals, `no-unused-vars: warn` with underscore ignore.
- `jsconfig.json` with `moduleResolution: Node`, `baseUrl: src`.
- New devDependencies: `eslint`, `@eslint/js`, `globals`, `supertest`.
- Scripts: `lint`, `lint:fix`, `test` (runs `node --test 'src/**/*.test.js'`).

### 4. VS Code

- `.vscode/extensions.json` recommending `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `GitHub.copilot`, `GitHub.copilot-chat`, `Anthropic.claude-code` (if applicable).
- `.vscode/settings.json` with `editor.formatOnSave`, `editor.codeActionsOnSave: { source.fixAll.eslint: explicit }`, `eslint.workingDirectories` for both packages.

### 5. Smoke tests (so the layer is provably alive)

- `frontend/src/utils/format.test.js` — at least one test of an existing `formatScore` or `formatDuration` function. Real test, not a `expect(true).toBe(true)`.
- `backend/src/utils/normalizePost.test.js` — at least one test of `sanitizeLimit` or `sanitizeSort`. Real test.

## Acceptance criteria

- [ ] `npm run lint` at the repo root exits zero on a clean checkout.
- [ ] `npm test` at the repo root runs both packages' tests and reports a real (non-zero, non-trivial) test count from each.
- [ ] `npm run build` at the repo root succeeds.
- [ ] Opening `frontend/src/App.jsx` in VS Code shows ESLint warnings (without crashing) and format-on-save uses Prettier.
- [ ] `.github/workflows/ci.yml` runs on a pushed branch and goes green.
- [ ] Adding a deliberate syntax error to any `.js` file makes `npm run lint` fail loudly.
- [ ] All new files written within size guardrails (none over 200 lines).
- [ ] `memory.md` updated under "Current state" to remove "no tests anywhere" / "no ESLint" lines.

## Blocked by

None.

## Followup

After this lands, all 011+ issues can proceed and Claude/Copilot can self-verify per `TESTING.md`.
