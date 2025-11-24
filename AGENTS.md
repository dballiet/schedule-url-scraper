# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router UI and `api/scrape` streaming endpoint for running scrapes and exporting CSVs.
- `src/lib`: Scraper logic (`scraper.ts`), association catalog, CSV helpers, and shared `types.ts`; keep business rules here.
- `src/components`: UI pieces (selectors, progress, results table) consumed by the main page.
- `scripts`: TSX-based CLI utilities for spot checks, targeted association runs (`find-*.ts`), debugging, and regression tests; prefer adding new diagnostics here.
- `public`: Static assets; avoid committing large scrape outputs—use ephemeral files instead.

## Build, Test, and Development Commands
- `npm run dev`: Start the Next.js dev server at `localhost:3000`.
- `npm run build` / `npm start`: Production build and serve.
- `npm run lint`: ESLint (Next core web vitals + TypeScript).
- `npm run scrape:spot-check`: Quick sweep of associations (fast sanity).
- `npm run scrape:test`: Regression suite covering platform patterns and season logic.
- `npm run scrape:health`: Full pass across all associations (long-running).
- `npm run scrape:batch`: Batch scraper for larger runs. For one-offs, use `npx tsx scripts/find-<association>.ts`.

## Coding Style & Naming Conventions
- TypeScript-first; favor functional React components and hooks in `src/app`.
- Match existing indentation per file (UI files mostly 2 spaces, scraper utilities 4); keep single quotes and trailing semicolons as seen.
- Use PascalCase for components/types, camelCase for functions/variables, and UPPER_SNAKE_CASE for constants.
- Keep shared logic in `src/lib`; UI-specific helpers stay near their consumers. Respect the `@/*` path alias.
- Run `npm run lint` before sending changes; address accessibility warnings from Next ESLint rules.

## Testing Guidelines
- Primary regression: `npm run scrape:test`. Use `npm run scrape:spot-check` for quick validation and `npm run scrape:health` before major releases.
- Add new assertions to `scripts/test-suite.ts` or targeted `test-*.ts` scripts when altering scrape logic.
- Puppeteer-backed tests hit live sites; be mindful of run time and external rate limits. Prefer scoped `find-*.ts` scripts while iterating.
- When updating association data, include a focused script or fixture update that demonstrates the expected iCal URL output.

## Commit & Pull Request Guidelines
- History is minimal; use imperative, descriptive subjects (e.g., `Add waconia submenu handling`). Keep commits scoped and reviewable.
- PRs should state intent, summarize scope, list commands run (lint/tests/scrapes), and note any remaining known issues.
- Include screenshots or log snippets for UI or scraper behavior changes, especially when affecting stream output or CSV diffs.
- Link issues/tasks when applicable and call out risky areas (Puppeteer navigation, season detection heuristics) for reviewers.

## Security & Operations Notes
- No secrets are expected for local dev; Puppeteer downloads Chromium automatically. Verify firewall/proxy settings if fetches fail.
- Scrapes generate CSV output; avoid committing derived data and large logs. Clean temp artifacts before opening PRs.
