# Can an installed iOS PWA keep a child signed in for months?

Research for [issue #6](https://github.com/zzyx/gwiazdka/issues/6). Researched 2026-09-23.

**Short answer: yes, with one change to the plan.** A Home Screen web app keeps its own storage. WebKit exempts it from ITP's 7-day storage deletion, and Supabase sessions do not expire by default. So a child who signs in *inside the installed app* can stay signed in for months. The weak point is the sign-in itself. On iOS, a join link opened in Safari signs in **Safari**, not the Home Screen app, because their storage is separate. The child has to finish joining inside the installed app, for example by typing a one-time code there.

## How the sources were checked

- `webkit.org` and `supabase.com` were **blocked by the network proxy** in this session.
  - **Supabase** claims were checked against the Markdown source of the docs site in `github.com/supabase/supabase` (`apps/docs/content/...`) and against the `supabase-js` / `@supabase/ssr` source code. Each one cites the public docs URL together with the GitHub source that was actually read.
  - **WebKit blog** claims marked *(search snippet)* came from web-search result excerpts of the webkit.org pages. The pages themselves could not be opened, so treat these as strong but not directly verified.
- `developer.apple.com` was reachable. That covers the WWDC23 session transcript and the Safari release notes, which were read through their JSON data endpoints.

---

## 1. Does a Home Screen web app share storage or cookies with Safari?

**No, not after installation.**

- Apple's WWDC23 session "What's new in web apps" says: *"From that point on, cookies are separate between Safari and the web app. If the user logs into your web page in their default browser, they will not be logged into the web app that has already been added to the Dock, since cookies and storage are separate after the web app is added."* — https://developer.apple.com/videos/play/wwdc2023/10120/
- The same session describes a **one-time copy of cookies at creation time**: *"we copy website cookies when a web app on Mac is added to the Dock."* It adds that `localStorage` is **not** copied: *"Since local storage is not copied when a web app is created, users would have to re-authenticate… keep authentication state saved within cookies."* The transcript says this about **web apps on Mac**. It does not say that iOS or iPadOS Home Screen apps copy cookies. — https://developer.apple.com/videos/play/wwdc2023/10120/
- WebKit's ITP documentation says Home Screen web apps *"are not part of Safari and thus have their own counter of days of use"* *(search snippet)*. — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Safari 26 release notes: *"Added support for any website to become a web app on iOS or iPadOS."* A site without a manifest can now be opened as a Home Screen web app too, but it is still a separate container. — https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes

**What this means for "open the join link in Safari, then install":**
- `supabase-js` stores its session in `globalThis.localStorage` by default (`persistSession: true`). — https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts (default settings ~L204–206, storage selection ~L517–522)
- Apple says `localStorage` is not copied into a new web app (see above).
- `@supabase/ssr`, the Next.js integration, stores the session in cookies (`maxAge` 400 days, `httpOnly: false`). — https://github.com/supabase/ssr/blob/main/src/utils/constants.ts
- A cookie-based session *might* come across when the app is installed if iOS copies cookies at install time the way macOS does. **I could not confirm that iOS does this.** Even if it does, the copy happens once: whatever is logged in or out later in Safari never reaches the app.
- **So the design must not depend on a Safari session carrying over.**

**Links do not open in the installed app on iOS.**
- Safari 18 added *"support for opening links directly in web apps on **macOS**"*. No matching iOS entry was found in the Safari 17, 17.4, 18, 26 or 26.2 release notes. — https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes
- **So a join link tapped in Messages or Mail on the iPhone opens in Safari, not in the installed app.** This is inferred from that absence plus the Apple guidance below. It is not stated outright by Apple for iOS.

**How Apple says to hand a session into an installed web app:**
- *"Some websites use email links to automatically sign in users by opening the link. Since links from email will open in the default browser, this will not automatically sign users in to the web app that they already have. You may want to provide an alternative **one-time code** in the email that your user can easily enter into the sign-in flow on your site."* — https://developer.apple.com/videos/play/wwdc2023/10120/
- The same session also suggests passkeys. — https://developer.apple.com/videos/play/wwdc2023/10120/

## 2. Storage eviction on iOS

**ITP 7-day cap on script-writable storage**
- Safari deletes all script-writable storage for a site after 7 days of Safari use without user interaction on it. This covers `localStorage`, IndexedDB, service worker registrations and cache. *(search snippet)* — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Home Screen web apps have *"their own counter of days of use. Their days of use will match actual use of the web application which resets the timer."* *(search snippet)* — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Later, WebKit *"implemented an explicit exception for the first-party domain of home screen web applications to make sure ITP always skips that domain in its website data removal algorithm"*. It says that domain is *"exempt from ITP's 7-day cap on all script-writeable storage."* *(search snippet)* — https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/ (the WebKit tracking-prevention page says the same: https://webkit.org/tracking-prevention/)
- **So ITP will not log the child out of the installed app.** It *would* clear a `localStorage` session kept only in Safari if the child didn't visit for a while.

**Quota and eviction under storage pressure (Safari 17 / iOS 17 and later)**
- Safari 17 added *"complete support for the Storage API"*, `StorageManager.estimate()`, and *"calculating quota based on disk space"*. — https://developer.apple.com/documentation/safari-release-notes/safari-17-release-notes
- Each origin may use up to 60% of disk in a browser app and up to 15% in other apps. Total quota is 80% or 20% respectively. *(search snippet)* — https://webkit.org/blog/14403/updates-to-storage-policy/
- *"Origin might be excluded from eviction if it has active page at the time of eviction, or its storage is in persistent mode"*. For `navigator.storage.persist()`, *"WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App."* *(search snippet)* — https://webkit.org/blog/14403/updates-to-storage-policy/
- Safari 17.4: *"Fixed cases where website data is unexpectedly evicted."* This shows unexpected eviction was a real bug in iOS 17.0–17.3. — https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes
- **So the installed app should call `navigator.storage.persist()` once after sign-in.** A few KB of auth tokens will not come near any quota. Remaining risks are things outside our control: the child deletes the app, clears website data, or restores or replaces the phone. **We need a cheap way back in, not a way to prevent every loss.**
- There is a WebKit bug report titled "REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app". It concerns *session* cookies, meaning cookies without `Max-Age`. **I could not read the bug (webkit.org is blocked), so its status is unknown.** — https://bugs.webkit.org/show_bug.cgi?id=272325. `@supabase/ssr` sets a 400-day `maxAge`, so its cookies are not session cookies.

## 3. Supabase Auth options for a password-less, long-lived child session

**Session lifetime (default: effectively forever)**
- *"By default, it lasts indefinitely and a user can have an unlimited number of active sessions on as many devices."* — https://supabase.com/docs/guides/auth/sessions (source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx)
- *"Access tokens are designed to be short lived, usually between 5 minutes and 1 hour while refresh tokens never expire but can only be used once."* The default access token lifetime is 1 hour. — same source
- A session ends when the user signs out, changes their password, hits a configured inactivity timeout or time-box, or when single-session-per-user is on and they sign in elsewhere. Time-box, inactivity timeout and single-session are **Pro plan and up** settings and are off by default. — same source
- **Refresh token reuse detection:** reusing an already-used refresh token outside a 10-second window (or the parent-token exception) revokes the **whole session**. — same source
  - Risk for us: two tabs or processes racing each other. `supabase-js` handles this with its lock and `BroadcastChannel`. — https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts (~L537)
  - Keep the session in **one** place per app: either client `localStorage` or `@supabase/ssr` cookies, not both refreshing on their own.
- A refresh token has no expiry, so a child who does not open the app for months just refreshes on next launch. (Supabase's docs say refresh tokens never expire. I did not confirm that no hidden server-side cap exists.)
- `signOut()` defaults to `scope: 'global'`. **Signing out anywhere ends every session of that user.** Don't show kids a sign-out button that calls it with the default. — https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts (~L4061–4069)

**Anonymous sign-in, linked later**
- `signInAnonymously()` creates a real user with the `authenticated` role and an `is_anonymous` JWT claim. However, *"the user can't access their account if they sign out, clear browsing data, or use another device."* — https://supabase.com/docs/guides/auth/auth-anonymous (source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-anonymous.mdx)
- To turn it into a permanent account, you link an email, phone or OAuth identity. That needs manual linking to be enabled. Anonymous sign-ins are rate-limited to 30 per hour per IP, CAPTCHA is recommended, and there is no automatic cleanup. — same source
- **Not a good fit.** If storage is lost, the child's identity and stars are gone unless we build our own re-attach step. A parent-created user avoids this.

**Magic link / email OTP**
- Links are single-use. The OTP and link expiry is configurable. More than one day is *"strongly discouraged"* and can only be set through the Management API. — https://supabase.com/docs/guides/auth/auth-email-passwordless (source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-email-passwordless.mdx)
- The children would need to read an email on the phone, and a tapped link opens in Safari (section 1). Typing a 6-digit email OTP inside the app does work, but it needs a real mailbox for each child.
- PKCE auth codes last 5 minutes and are exchanged once. — https://supabase.com/docs/guides/auth/sessions/pkce-flow
- The `token_hash` variant is checked with `verifyOtp({ token_hash, type })`. It does not need a PKCE code verifier stored in the same browser, so **it can be completed in a different context from the one that asked for it** (for example, inside the installed app). — https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-email-passwordless.mdx and `VerifyTokenHashParams` in https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts

**Admin-generated links (server-side, service role)**
- `auth.admin.generateLink({ type: 'magiclink', email })` returns `properties.action_link`, `email_otp` and `hashed_token` **without sending an email**. — https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts (`generateLink`, ~L370) and `GenerateLinkProperties` in `lib/types.ts` (~L1025)
- The server can pass `hashed_token` to the client, which calls `verifyOtp({ token_hash, type: 'magiclink' })` to create a session in whatever context runs it. `EmailOtpType` includes `'magiclink'`. — `lib/types.ts` (~L905)
- `auth.admin.createUser({ email, email_confirm: true, app_metadata })` can create the child user up front. `app_metadata` maps to `auth.users.app_metadata`. — https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts (~L480), `lib/types.ts` (~L591–605)
- The email can be a placeholder address on a domain we control, because no mail is ever sent to it.
  - **Not verified:** whether Supabase Auth checks email deliverability or MX records on admin-created users.

**Custom claims and RLS (child vs parent)**
- Use `app_metadata` for roles, not `user_metadata`: *"`raw_user_meta_data` — can be updated by the authenticated user… It is not a good place to store authorization data. `raw_app_meta_data` — cannot be updated by the user, so it's a good place to store authorization data."* — https://supabase.com/docs/guides/database/postgres/row-level-security (source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx, ~L599–608)
- The **Custom Access Token Hook** can add claims, such as `family_id` and `role: child|parent`, before each token is issued, including on `token_refresh`. — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook (source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-hooks/custom-access-token-hook.mdx)
- Policies then read `auth.jwt() -> 'app_metadata' ->> 'role'` or the custom claim.
  - Example: the child may insert a "task done" row for themselves, and only a `parent` in the same `family_id` may approve.
- Using a `profiles` / `family_members` table joined on `auth.uid()` is just as valid, and is easier to change without re-issuing tokens.
- If anonymous users are ever enabled, policies must check `is_anonymous` with **restrictive** policies. — auth-anonymous source above

## 4. Recommended join flow (iOS 17 / 18 / 26)

1. **Parent adds a child** (in the parent's app, through a Next.js server action using the service-role key):
   - `auth.admin.createUser({ email: 'child-<uuid>@<a domain we own>', email_confirm: true, app_metadata: { role: 'child', family_id } })`
   - Store a `family_members` row.
2. **Parent taps "Invite / re-connect device".** The server creates a short **join code**:
   - 6–8 characters, or a QR code of `https://<app>/join#code=…`
   - Store only its hash, in a `join_codes` table, with a 10–15 minute expiry and single use. Rate-limit attempts per IP and per code.
3. **Child installs the app first.** They open the site in Safari, then Share → Add to Home Screen, then open the app from the Home Screen. When the app has no session it shows only a "Enter your join code" screen. If it detects it is running in Safari (not in standalone mode), it shows "Add to Home Screen first" instructions instead.
4. **Child types the code in the installed app.** A server route checks and uses up the code, then calls `auth.admin.generateLink({ type: 'magiclink', email: childEmail })` and returns **only** `hashed_token`. The app calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`. The session is now created **inside the Home Screen app's own storage**.
   - If we use `@supabase/ssr` cookies, do the `verifyOtp` in the route handler instead, so the `Set-Cookie` headers land in the app's cookie jar.
5. **After sign-in:**
   - Call `navigator.storage.persist()`.
   - Leave `autoRefreshToken` on.
   - Keep JWT expiry at the default 1 hour.
   - Leave Pro-plan session time-box and inactivity timeout **off**.
   - Never give children a global `signOut()`.
6. **Recovery:** if the app loses its session (deleted, website data cleared, new phone), the parent issues a new code. The child's user id, and so their stars, stays the same.
7. **Optional later:** add a passkey for the child so they can recover without a parent. Apple suggests passkeys for web apps (WWDC23 session above).

The "open a join link once" idea does work if the link carries only the **code** (`/join#code=…`) and the child then opens and pastes or types it in the installed app. Tapping the link alone cannot sign in the installed app on iOS.

## Recommendation

**Change the provisional plan** from "open a join link once" to **"install first, then enter a one-time parent-issued code inside the installed app"**:
- The code is exchanged server-side through `auth.admin.generateLink` and turned into a session in the app with `verifyOtp({ token_hash })`.
- The child is a real, parent-created user, not an anonymous one, with `role`/`family_id` in `app_metadata` for RLS.

After that, the session should last for months:
- Supabase refresh tokens don't expire by default.
- Home Screen apps are exempt from ITP's 7-day wipe.
- `navigator.storage.persist()` guards against eviction when storage runs low.

Accept that the device can still lose the session (app deleted, data cleared, new phone). Handle it with a one-tap "re-connect device" code from the parent.

## Could not verify

- webkit.org pages (blog 10218, 11338, 14403, tracking-prevention) were read only as search-result snippets. The proxy blocked direct access.
- Whether **iOS** copies Safari cookies into a new Home Screen app. Apple's WWDC23 transcript describes this only for macOS.
- The status of WebKit bug 272325 (random session-cookie resets in iOS 17 Home Screen apps). bugs.webkit.org is blocked.
- The default magic-link/OTP expiry value. The docs source uses a config placeholder.
- Whether Supabase rejects undeliverable placeholder emails on `admin.createUser`.
- Whether there is any server-side maximum lifetime for refresh tokens beyond what the docs say.
