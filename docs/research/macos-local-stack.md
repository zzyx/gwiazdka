# Running the local stack on an Apple Silicon Mac

Research for [issue #62](https://github.com/zzyx/gwiazdka/issues/62). Researched 2026-09-28. Target: an Apple Silicon MacBook running this repo as it is today (Next.js 16.3.6, `supabase` CLI 2.117.0 from `devDependencies`, Node `>=22`, Vercel Git deploys).

**Short answer:**

- Use **Docker Desktop**. It is Supabase's documented default and is free for personal use. **OrbStack** (free for personal, non-commercial use) and **Colima** (MIT) also work.
- Install Node 22 with **fnm** and add an `.nvmrc` containing `22`.
- Keep running **`npx supabase`** from `devDependencies`. It ships a native `darwin-arm64` binary at the same version CI uses.
- Fill `.env.local` with one `supabase status -o env --override-name …` command.
- For iPhone testing, run `next dev --experimental-https`, trust the mkcert root CA on the phone, and add `allowedDevOrigins`. The app talks to Supabase only from the server, so the phone never needs to reach Supabase.
- Skip `vercel env pull` and `vercel deploy` for day-to-day work.

## Sources and access notes

The network proxy **blocked** `supabase.com`, `docs.docker.com`, `docs.orbstack.dev` / `orbstack.dev`, `vercel.com` and `nextjs.org` in this session. I read the same first-party content from its source instead:

- **Supabase docs:** the Markdown source in [`supabase/supabase` `apps/docs/content/guides/local-development/cli/getting-started.mdx`](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/cli/getting-started.mdx). The same page is served at <https://supabase.com/docs/guides/local-development/cli/getting-started>.
- **Supabase CLI behaviour:** the installed CLI itself (`node_modules/supabase@2.117.0` and its platform binary): `--help` output, plus JavaScript bundled in the binary, read with `strings`. Cited as **CLI 2.117.0**.
- **Docker Desktop docs:** Markdown source in [`docker/docs` `content/manuals/desktop/…`](https://github.com/docker/docs/tree/main/content/manuals/desktop). The Docker Subscription Service Agreement was reachable directly.
- **Colima:** [README](https://github.com/abiosoft/colima/blob/main/README.md) and [FAQ](https://github.com/abiosoft/colima/blob/main/docs/FAQ.md) from the repo.
- **Next.js:** the docs bundled with the installed package (`node_modules/next/dist/docs/`) and its source (`node_modules/next/dist/lib/mkcert.js`, `dist/cli/next-dev.js`), as `AGENTS.md` asks.
- **Node:** <https://nodejs.org/en/download> (reachable), [`nodejs/Release` `schedule.json`](https://github.com/nodejs/Release/blob/main/schedule.json), and the Homebrew `node@22` formula, fnm, nvm and Volta repos.
- **Vercel CLI:** `vercel@60.1.3` installed from npm into a scratch folder. Its `--help` text and bundled source were read.
- **OrbStack:** its docs were blocked, so the OrbStack claims come from **search snippets** of docs.orbstack.dev and are marked *(snippet only)*.

I did not run `supabase start` or any of the commands below on a Mac. The sandbox has no Docker daemon. Everything here comes from docs and source code.

---

## 1. Container runtime for `supabase start`

### What Supabase supports

- *"That stack runs in Docker containers, so you need a container runtime installed first. Follow the official guide to install and configure Docker Desktop … Alternately, you can use a different container tool that offers Docker compatible APIs."* The page then lists Rancher Desktop, Podman, **OrbStack (macOS)** and **colima (macOS)**. — getting-started.mdx
- The images are native arm64, so Rosetta is not needed. For example, Docker Hub reports `supabase/postgres:15.14.1.178` and `supabase/gotrue:v2.198.0-rc.21` as `['amd64', 'arm64']` (checked through the `hub.docker.com/v2/repositories/…/tags` API).

### How the CLI finds the Docker daemon (CLI 2.117.0)

The CLI does **not** need `/var/run/docker.sock`. It uses `DOCKER_HOST` first, then `DOCKER_CONTEXT`, then `currentContext` from `~/.docker/config.json` (it reads `contexts/meta/<sha256>/meta.json` → `Endpoints.docker.Host`). Docker Desktop, OrbStack and Colima each set themselves as the current Docker context, so the CLI should find whichever one is running without extra setup.

### The one known Mac-specific failure: the `vector` log container

- Local logs (Studio → Logs) come from a `vector` container that mounts the Docker socket. The docs say: *"Local logs rely on the Supabase Analytics Server which accesses the docker logging driver by either volume mounting `/var/run/docker.sock` … on Linux and macOS"*. — getting-started.mdx. This repo has `[analytics] enabled = true` in `supabase/config.toml`.
- **Colima bug, now fixed:** [supabase/cli#5073](https://github.com/supabase/cli/issues/5073) (CLI 2.89.1). The fix mounted the macOS-side path `~/.colima/default/docker.sock` into the VM, which failed with `mkdir …/docker.sock: operation not supported`. It was closed by [PR #5820](https://github.com/supabase/cli/pull/5820), merged 2026-07-08. In CLI 2.117.0, the function that picks the socket (`V2n` in the bundled JS) recognises `…/.docker/run/docker.sock`, `…/.docker/desktop/docker.sock` and any `…/.colima/…/docker.sock`. For those paths it mounts the **VM's own** `/var/run/docker.sock` instead. So Docker Desktop and Colima should work as installed.
- **OrbStack is not on that list.** Its socket (`~/.orbstack/run/docker.sock`) is bind-mounted into `vector` as-is. I could not confirm from OrbStack's docs that this works. A Supabase community thread ([discussion #34077](https://github.com/orgs/supabase/discussions/34077)) reports that `export DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"` fixed an OrbStack start failure.
- **Fallback for any runtime:** `npx supabase start -x vector` (`--exclude` is in `supabase start --help`, CLI 2.117.0) skips the log shipper. Everything the app uses still runs. You only lose logs in local Studio.

### Licence and setup, side by side

| | Docker Desktop | OrbStack | Colima |
|---|---|---|---|
| Licence | Free for *"small businesses (fewer than 250 employees AND less than $10 million in annual revenue), personal use, education, and non-commercial open source projects."* Otherwise paid. Government always paid. — [mac-install.md](https://github.com/docker/docs/blob/main/content/manuals/desktop/setup/install/mac-install.md), [Subscription Service Agreement §3.2](https://www.docker.com/legal/docker-subscription-service-agreement/) | Free for personal, non-commercial use. $8/user/month for commercial use *(snippet only: [pricing](https://orbstack.dev/pricing), [licensing](https://docs.orbstack.dev/licensing))* | MIT, free. — [README](https://github.com/abiosoft/colima/blob/main/README.md#license) |
| Named in Supabase docs | Yes, the default | Yes | Yes |
| Install | `.dmg` for Apple silicon. Supports *"the current and two previous major macOS releases"*. Rosetta 2 *"no longer strictly required"*. — mac-install.md | App from orbstack.dev. Sets the `orbstack` Docker context. Links `/var/run/docker.sock` if it has admin rights *(snippet only)* | `brew install colima docker`. The Docker client is separate: *"Installable with `brew install docker`"*. — README |
| Default resources | Memory limit *"Defaults to 50% of your host's memory"*. File sharing: VirtioFS by default. — [settings.md](https://github.com/docker/docs/blob/main/content/manuals/desktop/settings-and-maintenance/settings.md) | Dynamic *(not verified)* | *"2 CPUs, 2GiB memory and 100GiB storage"*. Change with `colima start --cpu 4 --memory 8`. — README |
| Socket for `vector` | Handled by CLI 2.117.0 | Not special-cased (see above) | Handled by CLI 2.117.0 (#5073 fixed) |
| Gotchas | *"Allow the default Docker socket to be used"* (Settings → Advanced) creates `/var/run/docker.sock`. The Supabase CLI does not need it. — settings.md, [mac-permission-requirements.md](https://github.com/docker/docs/blob/main/content/manuals/desktop/setup/install/mac-permission-requirements.md). Docker Desktop's *"Automatically check configuration"* resets the socket symlink and context if another tool, *"like Orbstack"*, changes them. — settings.md | Running it alongside Docker Desktop makes the two fight over the context and symlink (the same settings.md row) | Bind mounts outside `/Users/$USER` show up **empty** unless added to `mounts` in `colima.yaml`. Paths with spaces are not supported. — [FAQ](https://github.com/abiosoft/colima/blob/main/docs/FAQ.md). The repo lives under `~`, so this is fine. |

**Pick for this repo:** Docker Desktop. It is the path Supabase documents and tests, the CLI special-cases its socket, and this is personal use, so the licence is free. Pick **Colima** if you want only open-source tools. Give it at least `--cpu 4 --memory 8`, because the 2 GiB default is small for the dozen containers that `supabase start` runs (my judgement, not a documented minimum). OrbStack will most likely work too, but it is the least verified of the three. Run only **one** runtime at a time.

## 2. Node 22 and the Supabase CLI

### Node version

- Node 22 ("Jod") has been in **maintenance** since 2025-10-21 and reaches end of life on **2027-04-30**. Node 24 is the active LTS, and Node 26 becomes LTS on 2026-10-28. — [`nodejs/Release` schedule.json](https://github.com/nodejs/Release/blob/main/schedule.json). Latest 22.x: `v22.23.3` (2026-09-23, <https://nodejs.org/dist/index.json>). CI pins `node-version: 22` (`.github/workflows/*.yml`).
- nodejs.org's download page offers nvm, fnm, `brew install node@<major>`, n, asdf and Docker for macOS. Volta is not listed. — <https://nodejs.org/en/download>

| Option | Notes |
|---|---|
| **fnm** | `brew install fnm`, then `eval "$(fnm env --use-on-cd --shell zsh)"` in `~/.zshrc`. Reads `.node-version` / `.nvmrc`. — [fnm README](https://github.com/Schniz/fnm#readme). Without those files, `--resolve-engines` (on by default) uses `engines.node` and picks *"the latest satisfying version"*. — [docs/commands.md](https://github.com/Schniz/fnm/blob/master/docs/commands.md). With our `">=22"`, that would be **Node 24 or 26, not the 22 CI uses**. An `.nvmrc` avoids this. |
| nvm | Official curl installer (nvm v0.40.8 per nodejs.org). *"Homebrew installation is not supported."* — [nvm README](https://github.com/nvm-sh/nvm#installing-and-updating). Works, but makes shell start-up slower (not measured here). |
| Homebrew `node@22` | `keg_only :versioned_formula`, so you have to add it to `PATH` yourself. The formula also has `deprecate! date: "2026-10-28"` and a planned `disable!` on 2027-04-30. — [homebrew-core `node@22.rb`](https://github.com/Homebrew/homebrew-core/blob/main/Formula/n/node@22.rb). **It is deprecated in a month.** |
| Volta | *"**Volta is unmaintained.** … We recommend migrating to `mise`."* — [volta README](https://github.com/volta-cli/volta#readme) |

**Pick:** fnm from Homebrew, plus a one-line `.nvmrc` containing `22` in the repo. That keeps the Mac on the same major version as CI, and nvm also reads `.nvmrc`.

### `npx supabase` vs Homebrew `supabase`

- The Supabase docs name both ways and explain the trade-off. As a project dependency, *"there is no global `supabase` command … Run it through your package runner instead, for example `npx supabase <command>`"*. They also advise: *"Pin the version in `package.json` so your whole team uses the same CLI version."* Via npm, the CLI needs *"Node.js 20 or later"*. — getting-started.mdx
- The npm package is a small Node shim (`dist/supabase.js`). It launches a native binary from an optional dependency, and `@supabase/cli-darwin-arm64@2.117.0` is one of those dependencies (`node_modules/supabase/package.json`, `package-lock.json`). So `npx supabase` on Apple Silicon runs a native arm64 binary, not an emulated or JavaScript-only CLI.
- The CLI README lists `brew install supabase/tap/supabase` (*"always up to date"*) and `brew install supabase` (*"may be delayed"*). — [supabase/cli README](https://github.com/supabase/cli#installation). A global Homebrew CLI moves on its own schedule, while `package-lock.json` pins 2.117.0 for CI, both database workflows and every Mac.

**Pick:** `npx supabase …` only. There is no need for Homebrew's CLI. If both are installed, `supabase` and `npx supabase` can be different versions, and `supabase start` may pull a different set of images from what CI tests.

## 3. `.env.local` from `supabase status`

What the app reads (from `.env.example`, `lib/supabase/{client,server,admin}.ts` and `proxy.ts`):

| App variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `client.ts`, `server.ts`, `proxy.ts` |
| `SUPABASE_SECRET_KEY` | `admin.ts` (server-only, RLS bypass) |

What the CLI prints (CLI 2.117.0):

- The `supabase start` / `status` table shows **Publishable** `sb_publishable_...` and **Secret** `sb_secret_...` under "Authentication Keys". — getting-started.mdx
- In `-o env` mode the default variable names are `API_URL`, `PUBLISHABLE_KEY` and `SECRET_KEY`. The legacy `ANON_KEY`, `SERVICE_ROLE_KEY` and `JWT_SECRET` are printed too, along with `DB_URL`, `STUDIO_URL`, `MAILPIT_URL` and others. Each name has a field key that `--override-name` can rename: `api.url`, `auth.publishable_key`, `auth.secret_key`, `auth.anon_key`, `auth.service_role_key`, … (from the table in the bundled CLI source).
- `--override-name` can be repeated. Each value must be `KEY=VALUE`, and unknown keys are silently ignored (CLI 2.117.0 source). The help text gives the example `supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL`.

One command that writes exactly the three variables the app expects:

```sh
npx supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --override-name auth.secret_key=SUPABASE_SECRET_KEY \
  | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' > .env.local
```

The `grep` drops the other variables. That keeps the server-only secret out of any `NEXT_PUBLIC_*` name and leaves out the legacy JWT keys the app does not use. `.gitignore` already ignores `.env*` except `.env.example`. **Not run here:** the exact quoting of the `-o env` lines (`KEY="value"`), because no Docker was available to start a stack.

## 4. Testing on an iPhone on the same Wi-Fi

### What makes this easier than it sounds

**The phone never talks to Supabase.** Nothing imports `lib/supabase/client.ts` today (`grep -rl lib/supabase/client app lib` is empty). Sign-in is a Server Action (`app/sign-in/actions.ts`), and the session refresh runs in `proxy.ts`. So `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` keeps working when the page is opened from the phone, because the Mac's Next server makes every Supabase call. You do not need to expose Supabase on the LAN, turn on `[api.tls]`, or worry about mixed content. **This stops being true** as soon as a Client Component calls Supabase, or an `<img>` points at a Supabase Storage URL (planned photo uploads). At that point the URL has to be the Mac's LAN name, and HTTPS, if the page is HTTPS (see "Mixed content" below).

### LAN URL and `allowedDevOrigins`

- `next dev -H` defaults to `0.0.0.0`, *"Useful for making the application available for other devices on the network"*. — `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`. So `npm run dev` is already reachable at `http://<Mac name>.local:3000` or `http://<LAN IP>:3000`. The name is in System Settings → General → Sharing → Local hostname; the IP comes from `ipconfig getifaddr en0`. The `.local` name stays the same across DHCP changes; that part is my note, not a doc.
- *"Next.js blocks cross-origin requests to dev-only assets and endpoints during development by default … The dev server already allows `localhost`, its subdomains, and the hostname it was started with. Any other hostname needs an entry"*. Entries are hostnames only (no scheme, no port), and `*` matches exactly one label. — `…/05-config/01-next-config-js/allowedDevOrigins.md`. Without an entry, HMR and dev assets are blocked on the phone. Suggested `next.config.ts` addition:

  ```ts
  allowedDevOrigins: ["*.local"], // any <name>.local Mac; add a LAN IP here if you use one instead
  ```

- `serverActions.allowedOrigins` is **not** needed. It is only for proxies or tunnels, where the browser's `Origin` host differs from the host the server sees. — `…/serverActions.md`. On a direct LAN connection the two match.

### When HTTPS is required

| Need | Works on `http://<mac>.local:3000`? | Source |
|---|---|---|
| Layout, server actions, sign-in, join code | Yes | — |
| Service worker (offline shell) | **No.** *"Service workers are only available in secure contexts"*. Only `http://localhost` is exempt, and on the phone the Mac is not localhost | [MDN Service Worker API](https://github.com/mdn/content/blob/main/files/en-us/web/api/service_worker_api/index.md), [Secure contexts](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/index.md) |
| Add to Home Screen as an installed PWA | **No.** Next's PWA guide requires *"The website served over HTTPS"* | `…/01-app/02-guides/progressive-web-apps.md` |
| `getUserMedia` live camera | **No.** In insecure contexts *"`navigator.mediaDevices` is `undefined`"* | [MDN getUserMedia](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediadevices/getusermedia/index.md) |
| `<input type="file" accept="image/*">` photo (the approach in `ios-pwa-offline-and-camera.md`) | Yes (not gated on a secure context) | — |
| Mixed content (an HTTPS page fetching `http://` Supabase) | Browsers *"block insecure requests for all other resource types"*; images are auto-upgraded | [MDN Mixed content](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/mixed_content/index.md) |

### `next dev --experimental-https` on the LAN

How it works in Next 16.3.6 (`dist/lib/mkcert.js`, `dist/cli/next-dev.js`):

- Next downloads its own `mkcert` binary and runs `mkcert -install` for the hosts `localhost 127.0.0.1 ::1` **plus the `-H` hostname if one is given**. It writes `certificates/localhost{,-key}.pem` and adds `certificates` to `.gitignore` if it is missing. `*.pem` is already ignored in this repo. On later runs it reuses the cert if it covers the current host, and with no `-H` that is `localhost`.
- The docs say it *"creates a locally trusted certificate with mkcert"* and is *"only intended for development"*. — `…/06-cli/next.md`, "Using HTTPS during development".

Steps (from the sources above):

1. Run `npx next dev --experimental-https -H <name>.local` **once**. This makes the cert include the Mac's name, and it may ask for your macOS password to install the CA. The log prints `CA Root certificate created in <CAROOT>`.
2. Stop it. From then on, run `npx next dev --experimental-https`. With no `-H` it binds `0.0.0.0` again (Mac `localhost` keeps working) and reuses the same cert, which also covers `<name>.local`.
3. Trust the CA on the iPhone. mkcert says: *"install the root CA. It's the `rootCA.pem` file in the folder printed by `mkcert -CAROOT`. On iOS, you can either use AirDrop, email the CA to yourself, or serve it from an HTTP server. After opening it, you need to install the profile in Settings > Profile Downloaded and then enable full trust in it"* (Settings → General → About → Certificate Trust Settings). — [mkcert README](https://github.com/FiloSottile/mkcert#mobile-devices)
4. Open `https://<name>.local:3000` on the phone, with `allowedDevOrigins` set as above. A Home Screen app installed from this origin is separate from production and has its own storage, as `ios-pwa-persistent-child-session.md` §1 describes.

That CA can sign certificates for any site, and your phone will trust them. Keep `rootCA-key.pem` private, and delete the profile from the phone when you no longer need it (mkcert README: `rootCA-key.pem` *"gives complete power to intercept secure requests from your machine. Do not share it."*).

For the auth config: sign-in is by password, so no redirect URL is involved today. If email or OAuth redirects are added later, add `https://<name>.local:3000` to `[auth] additional_redirect_urls` in `supabase/config.toml`. The file already lists `https://127.0.0.1:3000`.

**The simpler alternative for real-device PWA checks** is the Vercel **preview deployment** of the PR. It is already HTTPS, needs no CA on the phone, and runs against `gwiazdka-preview` with the seed family (`.github/workflows/database-preview.yml`). Use the LAN setup for quick iteration, and the preview for "install it and live with it".

## 5. Vercel CLI

Read from `vercel@60.1.3 --help`:

- `vercel link [--project <name>] [--team <slug>] [--yes]`: *"Link a local directory to a Vercel project"*. It writes `.vercel/`, which is already in `.gitignore`.
- `vercel env pull [filename]`: *"Pull Environment Variables into a local file (default: .env.local)"*. `--environment <TARGET>` defaults to **`development`**, and `--git-branch` selects branch-specific Preview values. If the file exists and was not written by Vercel, the CLI asks before overwriting unless `--yes` is given (source: `pull` chunk, "Overwriting existing …").
- Next loads `.env.$(NODE_ENV).local`, then `.env.local`, then `.env.$(NODE_ENV)`, then `.env`. Any other filename is **not** loaded. — `…/02-guides/environment-variables.md`, "Environment Variable Load Order".

What this means here:

- **Local development should use local Supabase**, and `.env.local` should come from `supabase status` (section 3). `vercel env pull` with no arguments would **overwrite** that file with the Vercel project's *Development* values. The README says the Supabase variables live in Vercel for Preview and Production, so those would likely be empty or wrong.
- To debug against the preview database, pull into a file Next does not load and copy lines in by hand when needed: `vercel env pull .env.vercel-preview --environment=preview`. That file contains the preview **secret key**. It is git-ignored by `.env*`, but it should still not stay around. Vercel's "sensitive" variables may come back empty. The CLI has an `env.type === "sensitive"` check, but I could not open vercel.com to confirm how `env pull` treats them.
- **`vercel deploy` from a Mac is not worth documenting.** Git already gives every PR a preview and `main` a production deploy (README). A CLI deploy makes a preview not tied to a PR, so the preview-database workflow never ran for it. It can hit `gwiazdka-preview` with migrations that were never applied. `vercel --prod` would bypass `main` entirely. `vercel link` is also optional: nothing in the local loop needs it.

## Recommendation

1. **Runtime:** Docker Desktop, with default settings. The CLI finds it through the `desktop-linux` context, so "Allow the default Docker socket" is not needed. Colima is the free open-source alternative: `brew install colima docker && colima start --cpu 4 --memory 8`. If the `vector` container fails on any runtime, use `npx supabase start -x vector`.
2. **Node:** `brew install fnm`, enable `--use-on-cd`, and **add `.nvmrc` = `22`** to the repo so fnm does not pick Node 26 from `engines: ">=22"`. Avoid Homebrew `node@22` (deprecated 2026-10-28) and Volta (unmaintained).
3. **Supabase CLI:** `npx supabase` only. Do not install it with Homebrew.
4. **Env:** replace the README's "fill in" step with the `supabase status -o env --override-name …` command from section 3.
5. **iPhone:** add `allowedDevOrigins: ["*.local"]` to `next.config.ts`. Plain `npm run dev` over `http://<name>.local:3000` is enough for UI and flows. For service worker and Home Screen checks, use `next dev --experimental-https` with the mkcert CA trusted on the phone, or just the Vercel preview URL.
6. **Vercel CLI:** leave it out of the setup docs. At most, mention `vercel env pull .env.vercel-preview --environment=preview` for debugging against preview. Never pull into `.env.local`, and never deploy from the Mac.

## Claims not verified from a primary source

- OrbStack licence, price, socket path and `/var/run/docker.sock` behaviour, all *(snippet only)*: docs.orbstack.dev and orbstack.dev were blocked. I also could not confirm whether bind-mounting `~/.orbstack/run/docker.sock` into `vector` works under CLI 2.117.0.
- That `supabase start` actually succeeds on each runtime with CLI 2.117.0. I read the code but did not run it; no Mac and no Docker daemon were available.
- The exact line format of `supabase status -o env` output.
- That 8 GiB for Colima is enough. This is a judgement call, not a documented Supabase minimum.
- How `vercel env pull` handles "sensitive" variables (vercel.com blocked).
- iOS resolving `<name>.local` through Bonjour. This is standard macOS/iOS behaviour, but I did not check it against an Apple source here.
