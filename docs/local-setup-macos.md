# Running Gwiazdki on a Mac

How to go from a fresh MacBook to Gwiazdki running on your own machine, with the fake family from `supabase/seed.sql`, and then try it on an iPhone. For what the parts are, see [`architecture.md`](architecture.md); for the database, see [`database.md`](database.md). The reasons behind each choice are in [`research/macos-local-stack.md`](research/macos-local-stack.md).

What you end up with:

| Piece | Where it runs | Address |
|---|---|---|
| The app (`next dev`) | Node on the Mac | <http://localhost:3000> |
| Supabase (Postgres, Auth, Storage, Studio) | Docker containers on the Mac | API <http://127.0.0.1:54321>, Studio <http://localhost:54323> |

Nothing here touches production or the preview database. Local Supabase is its own empty copy, filled from the migrations and the seed.

**How this was checked.** Every command below was run on Linux in a cloud container (Node 22, Docker Engine, the repo's pinned Supabase CLI), including signing in as the seeded parent and joining as a child in a browser. Steps marked **(Mac only)** are macOS apps or settings that could not be run there: Homebrew, Docker Desktop, fnm, VS Code, and the iPhone.

## 1. Install the tools once

1. **Homebrew (Mac only).** Paste the install command from <https://brew.sh> into Terminal and follow what it prints at the end (it asks you to add Homebrew to your `PATH`).
2. **git.** macOS offers the Command Line Tools the first time you type `git`; accept them. Or `brew install git`.
3. **Node 22 with fnm (Mac only).**

   ```sh
   brew install fnm
   echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
   exec zsh
   fnm install 22
   ```

   The repo has an `.nvmrc` containing `22`, so fnm switches to Node 22 whenever you `cd` into it. That is the version CI uses. Without `.nvmrc` fnm would pick the newest Node that satisfies `"engines": ">=22"`, which is 24 or 26.

4. **Docker Desktop (Mac only).** Download the Apple silicon `.dmg` from <https://www.docker.com/products/docker-desktop/>, drag it to Applications, open it once and let it finish starting. Free for personal use. Default settings are fine; you do not need "Allow the default Docker socket". Prefer only open-source tools? Use Colima instead: `brew install colima docker && colima start --cpu 4 --memory 8`. Run only one of the two at a time.
5. **VS Code (Mac only)** from <https://code.visualstudio.com>, then these extensions:
   - **ESLint** (`dbaeumer.vscode-eslint`): shows the same lint errors CI does.
   - **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): class-name completion.
   - **Playwright Test for VS Code** (`ms-playwright.playwright`): for the end-to-end tests once they exist ([#66](https://github.com/zzyx/gwiazdka/issues/66)).
   - Optional: **PostgreSQL** or **Supabase** extensions if you like SQL in the editor; [`database.md`](database.md) covers psql and TablePlus.

   In VS Code, run **Shell Command: Install 'code' command in PATH** from the Command Palette so `code .` works in Terminal.

You do **not** need the Supabase CLI from Homebrew. The repo pins it in `package.json`, and `npx supabase` runs that exact version (a native Apple silicon binary), the same one CI uses.

## 2. Clone and start

```sh
git clone https://github.com/zzyx/gwiazdka.git
cd gwiazdka
npm install
npx supabase start
```

- `npm install` takes a minute. Use `npm ci` instead if you want exactly what `package-lock.json` says, like CI.
- The first `npx supabase start` downloads about a dozen Docker images and takes several minutes. Later starts take seconds. It creates the database, applies every file in `supabase/migrations/`, then runs `supabase/seed.sql`. When it finishes it prints the URLs and keys.

Now write `.env.local`, the file the app reads its Supabase settings from. This one command takes the three values from the running stack and writes them under the names the app uses:

```sh
npx supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --override-name auth.secret_key=SUPABASE_SECRET_KEY \
  | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' > .env.local
```

`.env.local` then looks like this (the keys are the same on every machine, since they are local-only defaults):

```sh
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_…"
SUPABASE_SECRET_KEY="sb_secret_…"
```

It is git-ignored. You only need to write it once; it stays valid across restarts and `db reset`.

Start the app:

```sh
npm run dev
```

Open <http://localhost:3000>.

## 3. Try it as the family

**As the parent.** On the welcome screen tap **Parent sign-in** (or open <http://localhost:3000/sign-in>) and sign in as `parent@example.com` / `password`. You see the Board with the seed's two children, Ola and Kuba, each with an open Contract, Tasks and two weeks of decided days.

**As a child.** A child joins with a Join code, and the app only shows the code field inside the installed app (typed into a normal browser tab it would sign that tab in and use the code up). On the Mac, the easiest way to be "the installed app" is Chrome:

1. In Chrome, open <http://localhost:3000>, then **⋮ → Cast, save and share → Install page as app…** (or the install icon at the right of the address bar). Chrome allows this on `localhost` without HTTPS. **(Mac only: the install itself was not run in the container; the join was checked in Chromium made to report itself as an installed app.)**
2. In the parent's browser window, open **Connect a phone** at the bottom of the sidebar and pick a child, or use **Connect phone** on that child's column. A sheet shows an `XXXX-XXXX` code that works once for 15 minutes.
3. In the installed Gwiazdki window, type the code. You land on that child's Today.

To be the child again from scratch, uninstall the app from Chrome (its window's **⋮ → Uninstall**) or sign out, and get a new code.

Safari on macOS can do the same with **File → Add to Dock**.

## 4. Run the checks CI runs

CI (`.github/workflows/ci.yml`) runs two jobs on every pull request. Locally:

```sh
npm run lint          # ESLint
npm run typecheck     # next typegen, then tsc
npm test              # Vitest unit tests (lib/*.test.ts and others)
npx supabase test db  # pgTAP tests in supabase/tests/database, against the local stack
```

`npx supabase test db` needs the local stack running (`npx supabase start`). It runs inside a transaction and leaves your data alone.

**End-to-end tests** (Playwright) don't exist yet; [#66](https://github.com/zzyx/gwiazdka/issues/66) adds them, and this section will say how to run them from Terminal and from VS Code's Testing panel.

## 5. Everyday commands

| You want to | Run |
|---|---|
| Stop the database (keeps its data) | `npx supabase stop` |
| Start it again | `npx supabase start` |
| Throw away all local data and rebuild from migrations + seed | `npx supabase db reset` |
| See URLs and keys again | `npx supabase status` |
| Look at the tables | Studio at <http://localhost:54323>, or `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Try a new migration | Add a file to `supabase/migrations/`, then `npx supabase db reset` |
| Update after pulling `main` | `npm install`, then `npx supabase db reset` if `supabase/migrations/` changed |

The seed dates its data relative to today (`current_date`), so after a few days the decided days drift into the past. `npx supabase db reset` brings them back.

## 6. Try it on an iPhone over Wi-Fi

The iPhone and the Mac must be on the same Wi-Fi. `npm run dev` already listens on every network interface, and `next.config.ts` allows any `*.local` host (`allowedDevOrigins`), so the phone can reach the Mac by its name.

1. **(Mac only)** Find the Mac's local name in **System Settings → General → Sharing → Local hostname**, for example `mishas-macbook.local`.
2. On the Mac, sign in as the parent at **`http://mishas-macbook.local:3000`**, not `localhost`. The Join sheet's QR code and link use whatever address the parent page was opened on, so this makes them work from the phone.
3. **(Mac only)** On the iPhone, open `http://mishas-macbook.local:3000` in Safari. Layout, sign-in, check-offs and approvals all work over plain HTTP.

The phone never talks to Supabase directly: every Supabase call goes through the Next server on the Mac, which reaches it at `127.0.0.1`. Two things don't work this way:

- **Photos of the day** don't show on the phone. Their links are signed Storage URLs on `127.0.0.1:54321`, which on the phone means the phone itself. Uploading still works (the upload goes through the server).
- **Add to Home Screen as an app, and the Join code step,** need HTTPS. Over plain HTTP, iPhone Safari only adds a bookmark, so you can't get to the code field.

For the Home Screen and photo checks, **use the pull request's Vercel preview** instead: it is HTTPS already, runs against `gwiazdka-preview` with the same seed family, and needs nothing installed on the phone. Every pull request gets one (see [Deploying](#7-how-deploying-works)).

If you do want HTTPS from the Mac (for a quick loop on install behaviour):

1. **(Mac only)** Run once, with your Mac's name: `npx next dev --experimental-https -H mishas-macbook.local`. Next downloads mkcert, installs a local certificate authority in the Mac's keychain (it may ask for your password) and makes a certificate for `localhost` and your Mac's name. Stop it with Ctrl-C.
2. From then on: `npx next dev --experimental-https`, and open `https://mishas-macbook.local:3000`.
3. **(Mac only)** Put mkcert's root certificate on the phone. Step 1 printed `CA Root certificate created in <folder>`; on a Mac that folder is normally `~/Library/Application Support/mkcert`, so `open ~/Library/Application\ Support/mkcert` shows it in Finder. AirDrop `rootCA.pem` to the iPhone, install it in **Settings → Profile Downloaded**, then turn on full trust in **Settings → General → About → Certificate Trust Settings**.

That certificate authority can vouch for any website on that phone. Keep `rootCA-key.pem` on the Mac private, and remove the profile from the phone when you're done (**Settings → General → VPN & Device Management**).

## 7. How deploying works

There is nothing to deploy from the Mac. Git does it:

- **Push a branch and open a pull request** → Vercel builds a **preview** (link in the PR), and `database-preview.yml` applies the branch's migrations to `gwiazdka-preview` and re-seeds it. Previews are behind Vercel login: open the link while signed in to Vercel.
- **Merge to `main`** → Vercel deploys **production** at <https://gwiazdka.vercel.app>, and `database-production.yml` pushes new migrations to the production database. Migrations must never destroy data: the real family is in there.

The Supabase keys for preview and production live in the Vercel project's environment variables and in GitHub secrets, never in the repo.

**The Vercel CLI is optional and not needed.** If you install it (`npm i -g vercel`, `vercel link`), use it only to look, and keep two rules:

- Never run `vercel env pull` without a file name. Its default target is `.env.local`, which would replace your local settings with the Vercel project's. To inspect preview values: `vercel env pull .env.vercel-preview --environment=preview`, and delete that file afterwards (it holds the preview's secret key).
- Never run `vercel deploy` or `vercel --prod`. A CLI deploy skips the pull request, so the preview database never got its migrations, and `--prod` skips `main` entirely.

## 8. Troubleshooting

**`Cannot connect to the Docker daemon` / `supabase start` fails right away.** Docker isn't running. Open Docker Desktop (or `colima start`) and wait until it says it's running, then try again.

**`port is already allocated` or `address already in use` on 54321–54324.** Another Supabase stack is still running, often from another project. `npx supabase stop --all` stops every local stack; `docker ps` shows what is holding the port.

**Port 3000 in use.** `next dev` picks the next free port and prints it. To find what holds 3000: `lsof -i :3000`.

**The `vector` container fails to start** (a message about `docker.sock`, most likely with OrbStack or an older Colima). Start without the log collector: `npx supabase start -x vector`. You only lose the Logs page in local Studio.

**Sign-in fails or pages error with "fetch failed".** The database isn't running, or `.env.local` is missing. Check `npx supabase status`, then rerun the `.env.local` command from [step 2](#2-clone-and-start) and restart `npm run dev`.

**The data looks wrong, or you want a clean slate.** `npx supabase db reset` rebuilds everything from migrations and the seed. For a full restart of the containers too: `npx supabase stop --no-backup && npx supabase start`.

**Disk filling up.** Old Supabase images pile up after CLI upgrades. `docker image prune -a` removes images no container uses (they download again on the next start).

**The iPhone shows "This site can't be reached".** Both devices must be on the same Wi-Fi (not a guest network that isolates clients). Try the Mac's IP instead of its name: `ipconfig getifaddr en0` **(Mac only)**, then add that IP to `allowedDevOrigins` in `next.config.ts` while you use it.
