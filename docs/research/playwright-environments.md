# Pointing Playwright at local, protected Vercel previews and production

Research for [issue #63](https://github.com/zzyx/gwiazdka/issues/63). Researched 2026-09-28. Stack: Next.js 16.3.6, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.1, GitHub Actions. Current Playwright is `@playwright/test` 1.63.0 (npm registry, 2026-09-28).

## Sources and access notes

The network proxy **blocked** `playwright.dev`, `vercel.com` (and `docs.vercel.com`), `supabase.com` and `nextjs.org`. I read the same first-party content from these sources instead:

- Playwright docs: raw Markdown in <https://github.com/microsoft/playwright/tree/main/docs/src>, which is what playwright.dev renders. The device registry is at [`packages/isomorphic/deviceDescriptorsSource.json`](https://github.com/microsoft/playwright/blob/main/packages/isomorphic/deviceDescriptorsSource.json).
- VS Code extension: source of <https://github.com/microsoft/playwright-vscode> (`main` at `0689d87`, 2026-09-21; `package.json` v1.1.19).
- Supabase docs: <https://github.com/supabase/supabase/tree/master/apps/docs/content/guides> (raw MDX). Supabase JS API: the JSDoc shipped in `node_modules/@supabase/auth-js` 2.117.1 (the reference pages are generated from it) and `node_modules/@supabase/ssr` 0.12.7.
- Next.js docs: `node_modules/next/dist/docs/` for 16.3.6, as AGENTS.md asks.
- GitHub Actions events: <https://github.com/github/docs> (`content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md`).
- Vercel: **search-engine snippets only** of vercel.com/docs pages. There is no public source repo for them. Every Vercel claim below is marked **(snippet only)** and should be read once on the real page before relying on it.

Page URLs are given in their playwright.dev / supabase.com / vercel.com form so they can be opened normally.

---

## 1. Getting past Vercel Deployment Protection

**Short answer:** create a "Protection Bypass for Automation" secret in the Vercel project. Store it as a GitHub secret and in the local `.env`. Send it on the first request together with `x-vercel-set-bypass-cookie: true`, so every later navigation in the same browser context carries the bypass cookie.

| Fact | Source |
|---|---|
| The secret bypasses protection "for all deployments in a project". Vercel also exposes it to deployments as the system env var `VERCEL_AUTOMATION_BYPASS_SECRET`. | [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) **(snippet only)** |
| It is sent as a header **or** query parameter named `x-vercel-protection-bypass` whose value is the secret. The query parameter is for tools that can't set headers. | same **(snippet only)** |
| "Headless browser tools like Playwright send the bypass header on the initial page load, but subsequent in-browser navigations don't include custom HTTP headers." Adding `x-vercel-set-bypass-cookie: true` on the first request sets a cookie for the rest of the session. The value `samesitenone` sets `SameSite=None`, which is only needed in iframes (default is `Lax`). | same **(snippet only)** |
| Vercel's own Playwright example puts both headers in `use.extraHTTPHeaders`. | same **(snippet only)** |
| A project can have several secrets, each with its own label (e.g. "Playwright tests"), so each can be revoked alone. Regenerating a secret invalidates existing deployments, so redeploy after regenerating. | same, and [Automated & Agent Access](https://vercel.com/docs/deployment-protection/automated-agent-access) **(snippet only)** |
| Standard Protection covers every URL **except the production domains**. A domain assigned to Production in the Domains tab "will remain publicly accessible"; generated per-deployment URLs stay gated. | [Deployment Protection](https://vercel.com/docs/deployment-protection) **(snippet only)** |

On the Playwright side:

- `extraHTTPHeaders` is "an object containing additional HTTP headers to be sent with **every** request" ([params.md `context-option-extrahttpheaders`](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-extra-http-headers)). So the secret also goes to third-party hosts, including `*.supabase.co`.
- In this app that exposure is small. Every write goes through a Server Action on the app's own origin (`app/child/actions.ts`, `app/parent/actions.ts`). The browser talks to Supabase only to load signed photo URLs, and the browser client in `lib/supabase/client.ts` is not imported by any page.
- It is still cleaner to send the bypass only once:
  1. In the setup project, open `baseURL + '/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true'`.
  2. Save the resulting `storageState`, which then holds the Vercel bypass cookie as well as the Supabase session cookies.

  This relies on the query-parameter form behaving like the header form, which is **(snippet only)**.

**Production (`https://gwiazdka.vercel.app`) is the production domain, so it needs no bypass.** Previews do.

### How a GitHub Action gets the preview URL

| Option | How | Trade-offs |
|---|---|---|
| **`repository_dispatch`, type `vercel.deployment.success`** (Vercel's current recommendation) | `on: repository_dispatch: types: ['vercel.deployment.success']`. The URL is in `github.event.client_payload.url` and the commit in `github.event.client_payload.git.sha`. Payload also carries the environment. Other types include `.ready`, `.error`, `.promoted`. | [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github), [changelog](https://vercel.com/changelog/trigger-github-actions-with-enriched-deployment-data-from-vercel) **(snippet only)**. GitHub runs `repository_dispatch` with `GITHUB_SHA` = **last commit on the default branch**, and the workflow file must be on the default branch ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch)). So `actions/checkout` must pass `ref: ${{ github.event.client_payload.git.sha }}`, and the run is not tied to the PR's checks by itself. |
| **`deployment_status`** (older; Vercel calls it replaced) | `on: deployment_status`, `if: github.event.deployment_status.state == 'success'`. The URL is `github.event.deployment_status.environment_url`. | Vercel **(snippet only)**: there is a project setting to disable these events. GitHub runs it with `GITHUB_SHA` = "commit to be deployed" ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#deployment_status)), so the tests match the deployed code with no extra checkout. |
| Vercel bot PR comment / `vercel` CLI | Parse the bot comment, or call the CLI with a `VERCEL_TOKEN`. | Not researched from a primary source. The comment is not an API, and the CLI needs another long-lived token. Not recommended. |

Either event fires for **every** Vercel deployment, production included. Filter on the environment (`client_payload.environment` or `deployment_status.environment`) so the preview suite never runs against production.

## 2. Supabase Auth in tests

### How this app signs people in

- **Parent:** a password form. The `signIn` Server Action calls `supabase.auth.signInWithPassword` with the cookie-based server client, then redirects to `/` (`app/sign-in/actions.ts`). The session lives in `@supabase/ssr` cookies named `sb-<project-ref>-auth-token`. They are split into chunks of 3180 characters, and the value carries a `base64-` prefix (`node_modules/@supabase/ssr/dist/module/utils/chunker.js`, `cookies.js`). `proxy.ts` refreshes them on every request.
- **Child:** a Join code typed on `/join`. The `joinWithCode` action does three things (`app/join/actions.ts`):
  1. Redeems the code with the secret-key client.
  2. Calls `auth.admin.generateLink({ type: 'magiclink', email: 'child-<childId>@children.gwiazdka.vercel.app' })`.
  3. Calls `verifyOtp({ token_hash })` on the cookie client.

  A code comes from `issue_join_code(p_child_id)`, which only succeeds for a signed-in parent of that child (`supabase/migrations/20260925130000_join_codes.sql`).
- The seed has one parent `parent@example.com` / `password` and two children who have not joined yet (`supabase/seed.sql`). The same seed goes to `gwiazdka-preview` (`.github/workflows/database-preview.yml`). That preview database is **shared by every open PR**.

### UI sign-in vs `storageState`

- Playwright recommends signing in once in a **setup project** and reusing `storageState`. Keep the state files out of git (`playwright/.auth` in `.gitignore`). Declare the setup project in `dependencies` of the test projects ([Authentication](https://playwright.dev/docs/auth)).
- "Shared account in all tests" suits tests **without** server-side state. When tests modify server-side state, use "one account per parallel worker" (same page).
- For several roles, save one file per role and pick it with `test.use({ storageState })` per file or group ([Authentication: multiple signed in roles](https://playwright.dev/docs/auth#multiple-signed-in-roles)).
- An API login is fine "when your application supports authenticating via API" ([Authentication: authenticate with API request](https://playwright.dev/docs/auth#authenticate-with-api-request)). Here that means reproducing `@supabase/ssr`'s chunked, `base64-`-prefixed cookie. The reliable way is to use `@supabase/ssr` itself:
  1. Create `createServerClient(url, publishableKey, { cookies: { getAll, setAll } })` over an in-memory array.
  2. Call `signInWithPassword`.
  3. Add the captured cookies to the context with `context.addCookies` for the target host.
  4. Save `storageState`.
- **Recommendation:** sign in through the **UI** in setup. It is one form post, it is what the family actually does, and it is exactly how production cookies are shaped. Keep the API login as an optimisation for later.
- For the child, the setup should do what the family does: open `/join` and type a code. The parent's context gets the code, either through the UI or by calling `rpc('issue_join_code')` with a client signed in as the test parent. The setup then saves `child.json`.
- UI mode does not run the setup project by default. Run `auth.setup.ts` by hand when saved state expires ([Authentication: UI mode](https://playwright.dev/docs/auth#authenticating-in-ui-mode)).

### Throwaway users and families (local and preview only)

The admin API needs the secret key and must only run on a server. It "bypasses Row Level Security" ([API keys](https://supabase.com/docs/guides/api/api-keys)). The key starts `sb_secret_`, and `npx supabase start` prints the local one ([CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)). The Playwright setup runs in Node, so it counts as "a server".

1. `auth.admin.createUser({ email: 'e2e-<runId>@example.com', password, email_confirm: true })`. The parent needs `email_confirm: true`, because "both arguments default to false" (`GoTrueAdminApi.d.ts`, [admin.createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)).
2. With the secret-key client, insert `families`, `parents`, `children`, `tasks` and `contracts` rows for that user, mirroring `seed.sql`. Use a fresh family per run (or per worker), never `parent@example.com`, because the preview database is shared across PRs.
3. Let the child join through `/join` as above. The app creates the child's auth user.

### Cleaning up

Do the cleanup in a **teardown project** named by `teardown` on the setup project. It "will run after all dependent projects have run", but `--no-deps` skips it ([Global setup and teardown](https://playwright.dev/docs/test-global-setup-teardown#teardown); [TestProject.teardown](https://playwright.dev/docs/api/class-testproject#test-project-teardown)). In order:

1. **Storage first.** Photos live in the `day-photos` bucket at `<child_id>/<YYYY-MM-DD>.jpg` (`supabase/migrations/20260928120000_day_photos.sql`). Supabase: "Deleting objects should always be done via the **Storage API** and NOT via a **SQL query**", otherwise the object is orphaned ([Delete objects](https://supabase.com/docs/guides/storage/management/delete-objects)). So `storage.from('day-photos').list(childId)` then `.remove(paths)`.
2. **Delete the `families` row.** Every public table hangs off it with `on delete cascade`: parents, children, tasks, check-offs, approvals, contracts, payouts, join codes, day photos (`supabase/migrations/*.sql`).
3. **Delete the auth users** with `auth.admin.deleteUser(id)`: the parent and each `child-<childId>@children.gwiazdka.vercel.app` user. `children.user_id` is `on delete set null`, so deleting a user does not remove the child row; step 2 does.
4. Because a crashed run skips teardown, also sweep leftover `e2e-%@example.com` users and their families at the start of each preview run.

Rate limits: Supabase Auth limits by IP with a token bucket, usually 30 requests of capacity ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Sign-ins and `verifyOtp` here come from the Next.js server, so they share one IP. Signing in once per role in setup and reusing `storageState` keeps well under that.

## 3. Playwright config for Next.js

- **Local:** Next's guide recommends testing the production build (`npm run build` then `npm run start`), or letting Playwright's `webServer` start the server ([Next.js: Playwright](https://nextjs.org/docs/app/guides/testing/playwright), from `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`).
  - `webServer` takes `command`, `url`, `reuseExistingServer` ("commonly set to `!process.env.CI`"), `timeout` (default 60 000 ms) and `env` ([Web server](https://playwright.dev/docs/test-webserver)). Set `use.baseURL` so tests can call `page.goto('/')`.
  - Only define `webServer` when the target is local. For preview and production the app is already running.
  - Local Supabase is `npx supabase start` (or `db reset` for a fresh seed).
- **Projects per environment:** Playwright's docs show one project per environment, each with its own `baseURL` and `retries` ([Projects: multiple environments](https://playwright.dev/docs/test-projects#configure-projects-for-multiple-environments)). Browser/device is a second axis. With a setup and teardown per environment it multiplies fast, so pick **one target per run from an env var** (`E2E_TARGET=local|preview|production`) and keep projects for roles and devices. That is Playwright's own parameterisation pattern ([Parameterize tests: env vars](https://playwright.dev/docs/test-parameterize#passing-environment-variables)).
- **iPhone / WebKit:** the device registry is spread into a project's `use` (`...devices['iPhone 15']`). `iPhone 15` has viewport 393×659, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true` and `defaultBrowserType: 'webkit'`; entries run up to `iPhone 17 Pro Max` ([Emulation: devices](https://playwright.dev/docs/emulation#devices); `deviceDescriptorsSource.json`).
  - Playwright's WebKit is a patched build of WebKit `main`, not branded Safari. "For the closest-to-Safari experience you should run WebKit on mac" ([Browsers](https://playwright.dev/docs/browsers)). It does not emulate a home-screen install (standalone display mode, iOS storage rules).
- **Photo upload:** `locator.setInputFiles(path | { name, mimeType, buffer })` works on an `<input type=file>` ([Input: upload files](https://playwright.dev/docs/input#upload-files)). In this app the input is `hidden` and opened by a button (`app/child/day-photo.tsx`), so either:
  - wait for `page.waitForEvent('filechooser')`, click "Add a photo" and call `fileChooser.setFiles(...)` ([Input](https://playwright.dev/docs/input)); this is closer to the user, or
  - call `page.locator('input[type=file]').setInputFiles(...)`.

  The client re-encodes the file to JPEG with a canvas before the Server Action runs, and the bucket accepts only `image/jpeg` up to 1 MB. So use a real small JPEG fixture, not a text buffer.
- **Timezone:** `use: { timezoneId: 'Europe/Warsaw' }` sets the browser's timezone; the default is the system timezone ([Emulation: locale & timezone](https://playwright.dev/docs/emulation#locale--timezone)). GitHub runners and Vercel functions run in UTC.
- **`page.clock`:** it overrides `Date`, `setTimeout` and similar **in the page only** ([Clock](https://playwright.dev/docs/clock)). It is useful for client timers here, such as the 2.5 s toast (`clock.install()` then `fastForward`).
  - It **cannot** move "today" or the 22:00 Check-off deadline. Both are decided on the server: Server Components call `warsawToday(new Date())` (`lib/today.ts`, `app/parent/parent-home.tsx`, `app/child/child-home.tsx`), and the database uses `private.clock()`/`private.today()` (`supabase/migrations/20260925120000_first_usable_version.sql`).
  - So date-dependent tests must build data relative to the real today, like `seed.sql` does. They must also handle weekends: on a Sunday no day is changeable, and on a Saturday only Friday is, until 22:00.
  - A test clock would need a separate, test-only server seam (e.g. replacing `private.clock()` in the **local** database plus a matching `now` source in Next). That is a design decision, not something Playwright provides.
- **Env files:** Next loads `.env.local`, but Playwright does not. The config can load it with `loadEnvConfig(process.cwd())` from `@next/env` ([Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables#loading-environment-variables-with-nextenv)), which already ships with `next`. Or it can use `dotenv`, as Playwright's docs show ([Parameterize tests: .env files](https://playwright.dev/docs/test-parameterize#env-files)). With `NODE_ENV=test`, Next skips `.env.local` (same Next page, "Environment Variable Load Order").

## 4. VS Code Playwright extension: choosing the target from the editor

- It finds configs with the glob `**/*playwright*.config.{ts,js,mts,mjs}`, skipping `node_modules` (`src/extension.ts`, `_innerRebuildModels`). If there are several, "you can switch between them using the gear icon in the Playwright sidebar" ([VS Code guide: multiple configurations](https://playwright.dev/docs/getting-started-vscode#multiple-configurations)).
- Projects appear as checkboxes. By default the first project is selected, and a run uses every checked project ([VS Code guide: run on multiple browsers](https://playwright.dev/docs/getting-started-vscode#running-your-tests); [extension README](https://github.com/microsoft/playwright-vscode#readme)). Dependencies such as a setup project run first ([VS Code guide: project dependencies](https://playwright.dev/docs/getting-started-vscode#project-dependencies)).
- The only env setting is `playwright.env`, described as "Environment variables to pass to Playwright Test", an object in VS Code settings. It is re-read when changed (`package.json` / `package.nls.json`, `_envProvider` in `src/extension.ts`). The extension does not read `.env` files itself: the config's `dotenv`/`loadEnvConfig` call does, because the config is plain Node run by the extension.

There are three ways to switch target from the editor:
- **(a)** set `"playwright.env": { "E2E_TARGET": "preview", "E2E_BASE_URL": "https://…" }` in `.vscode/settings.json` (user or workspace; keep secrets out of a committed file);
- **(b)** edit `.env.e2e` (git-ignored by the existing `.env*` rule), which the config loads;
- **(c)** keep one small config per target (`playwright.local.config.ts`, `playwright.preview.config.ts`, `playwright.production.config.ts`) that import a shared base, and pick one with the gear icon.

(c) is the most visible in the UI and suits the per-target setup, teardown and `webServer` differences.

## 5. A sanity check against production that writes nothing

Production holds a real family's data, and `database-production.yml` never seeds it. So:

1. **No sign-in.** A sign-in writes to Supabase Auth (a session, a refresh token, audit entries). It would also put the real parent's cookies and pages into traces and reports.
2. **Only public pages:** `/` (signed out), `/sign-in`, `/join`, `/manifest.webmanifest`, `/icon`, `/apple-icon`. Check that each renders and returns 2xx, that the form fields are present, and that there are no console errors.
3. **Enforce read-only in code**, not by convention. In the production project, register `context.route('**/*', r => r.request().method() === 'GET' || r.request().method() === 'HEAD' ? r.continue() : r.abort())`. "Every request matching the url pattern will stall unless it's continued, fulfilled or aborted" ([BrowserContext.route](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)). Server Actions are POSTs, so the sign-in and join actions cannot run by accident.
4. **Select the smoke tests with a tag** (`test('…', { tag: '@smoke' }, …)`) and give the production project `grep: /@smoke/` ([Annotations: tag tests](https://playwright.dev/docs/test-annotations#tag-tests); [TestProject.grep](https://playwright.dev/docs/api/class-testproject#test-project-grep)). Use `retries: 0`, and no `webServer`.
5. **No Vercel bypass is needed** for the production domain (section 1).

## Recommendation

1. Add `@playwright/test` and a shared base config that reads `E2E_TARGET` and `E2E_BASE_URL`. Load `.env.local` / `.env.e2e` via `@next/env` `loadEnvConfig`. Set `timezoneId: 'Europe/Warsaw'` and `baseURL` in `use`.
2. Add three thin configs (local, preview, production) so the VS Code gear icon switches target. Projects inside each:
   - `setup` (throwaway family → parent UI sign-in → child `/join` → `parent.json`/`child.json`, plus the Vercel bypass cookie on preview), with `teardown: 'cleanup'`;
   - `cleanup` (Storage `remove`, delete family, `admin.deleteUser`);
   - `desktop-chromium` for the parent;
   - `iphone-webkit` (`devices['iPhone 15']`) for the child.
3. Local: `webServer: { command: 'npm run build && npm run start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI }` against `npx supabase start`. CI can run this in the existing `database` job style.
4. Preview in CI: a workflow on `repository_dispatch: ['vercel.deployment.success']` filtered to the preview environment, checking out `client_payload.git.sha`. Or use `deployment_status` if we want it attached to the commit without extra work.
   - GitHub secrets: `VERCEL_AUTOMATION_BYPASS_SECRET` (a Playwright-labelled secret), `SUPABASE_PREVIEW_URL`, `SUPABASE_PREVIEW_SECRET_KEY`.
   - Throwaway families only, never `parent@example.com`.
5. Production: a separate `@smoke` project, signed out, GET-only route guard, run on `vercel.deployment.promoted`/production success or by hand.
6. Treat Check-off timing as a server concern. Build test data relative to the real Warsaw today, skip day-bound checks when no School day is changeable, and decide separately whether a test clock seam is worth adding.

## Claims not verified from a primary source

- All Vercel facts: header and cookie names, `samesitenone`, multiple labelled secrets, redeploy after regenerating, the `repository_dispatch` event list and `client_payload` fields, and Standard Protection leaving the production domain public. vercel.com was blocked, so they come from search-result snippets of the official pages.
- That the `x-vercel-protection-bypass` **query parameter** combined with `x-vercel-set-bypass-cookie=true` sets the cookie exactly as the header form does.
- Whether `gwiazdka.vercel.app` is listed as a Production domain in this project's Domains tab (it must be for it to be public under Standard Protection). It is reachable by the family, so presumably yes.
- Whether `repository_dispatch` from Vercel can be linked to the PR as a status check without extra steps.
- The exact `@supabase/ssr` cookie behaviour on `localhost` over plain HTTP. Supabase notes that `Secure` cookies "can be a problem when developing on `localhost`" ([SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)). The UI sign-in approach avoids having to hand-craft them.
