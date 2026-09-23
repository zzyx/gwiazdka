# What an iOS home-screen PWA can do offline and with the camera

Research for [issue #7](https://github.com/zzyx/gwiazdka/issues/7). Researched 2026-09-23. Target: iPhone home-screen web app, iOS 17/18 and later (iOS/Safari 27 is current per MDN browser-compat-data 8.1.2).

## Sources and access notes

The network proxy **blocked** these hosts: `webkit.org`, `developer.mozilla.org`, `nextjs.org`, `tanstack.com`, `html.spec.whatwg.org`, `caniuse.com`. I read the same first-party content from the source repos instead:

- MDN compatibility data: the npm package `@mdn/browser-compat-data@8.1.2` (`data.json`, timestamp 2026-09-17). This is the data behind MDN's compat tables. Cited below as **BCD `<key>`**, with the repo at <https://github.com/mdn/browser-compat-data>.
- MDN prose: <https://github.com/mdn/content> (raw Markdown).
- Next.js docs: <https://github.com/vercel/next.js/tree/canary/docs> (raw MDX; the same docs are served on nextjs.org).
- TanStack Query docs and source: <https://github.com/TanStack/query>.
- WebKit source: <https://github.com/WebKit/WebKit> (`main`).
- WHATWG HTML source: <https://github.com/whatwg/html/blob/main/source>.
- npm registry metadata for versions and publish dates.

One WebKit blog claim came only from a search-engine snippet, because webkit.org was blocked. It is marked **(snippet only)**.

---

## 1. Service workers and Background Sync: can a queued write be sent while the app is closed?

**Short answer: no. On iOS, a queued write goes out only when the app is running again (opened or brought back to the foreground).**

| Capability | iOS Safari / home-screen app | Source |
|---|---|---|
| Service Worker | Yes, since iOS 11.3 | BCD `api.ServiceWorker`: `safari_ios.version_added: "11.3"` |
| Background Sync (`SyncManager`, `registration.sync`) | **Not supported** (`version_added: false`, open bug webkit.org/b/182565) | BCD `api.SyncManager`, `api.ServiceWorkerRegistration.sync` |
| Periodic Background Sync | **Not supported** | BCD `api.PeriodicSyncManager` |
| Background Fetch | **Not supported** | BCD `api.BackgroundFetchManager` |
| Push API | Yes, iOS 16.4+, *"Notifications are supported in web apps saved to the home screen."* | BCD `api.PushManager` |

- WebKit's preference registry has a `BackgroundFetchAPIEnabled` flag that is `status: testable` and `defaultValue: false`. It has no Background Sync preference at all, so nothing is sitting behind a flag either. Source: [UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml).
- Serwist, the maintained Workbox fork, has `BackgroundSyncQueue`. It checks `"sync" in self.registration`. If that is false, it logs *"Background sync replaying without background sync event"* and replays the queue immediately, which means when the service worker next starts up. On iOS, that is when the app next runs. Source: `serwist@9.5.12` `dist/chunks/printInstallDetails-*.js`, `BackgroundSyncQueue._addSyncListener` ([repo](https://github.com/serwist/serwist)). Its default queue retention is `MAX_RETENTION_TIME = 1440 * 7` minutes, which is 7 days (same file).
- The only way iOS wakes a closed web app is a Push message (BCD `api.PushManager`). Push is a server-to-device channel, so it cannot flush a local queue that only the device has.

**Implication:** the offline queue must survive the app being killed, which means it must live in IndexedDB (section 2). It flushes when the child next opens the app or brings it to the foreground while online. A task checked off in the lift reaches the server the next time the app is used with signal, not by itself in the background.

## 2. Offline persistence: IndexedDB, TanStack Query persistence, `networkMode`, and eviction on iOS

### Storage APIs on iOS

| API | iOS support | Source |
|---|---|---|
| IndexedDB | Yes (iOS 8+) | BCD `api.IDBFactory` |
| `navigator.storage.persist()` | Yes, iOS 15.2+ | BCD `api.StorageManager.persist` |
| `navigator.storage.estimate()` | Yes, iOS 17+ | BCD `api.StorageManager.estimate` |

### Quotas and eviction (MDN, "Storage quotas and eviction criteria")

Source: [mdn/content …/storage_quotas_and_eviction_criteria/index.md](https://github.com/mdn/content/blob/main/files/en-us/web/api/storage_api/storage_quotas_and_eviction_criteria/index.md)

- On macOS 14 / iOS 17 and later, a browser app (Safari) gives each origin up to about 60% of total disk. *"If the user has saved the site as a web app on the Home Screen … it uses the same origin quota as the browser app (around 60% of disk space)."* Across all origins, WebKit caps storage at 80% of disk. Earlier Safari versions started each origin at 1 GiB and asked the user before allowing more.
- Data is "best-effort" by default. `persist()` exempts an origin from storage-pressure eviction. *"Safari … automatically approve[s] or den[ies] the request based on the user's history of interaction with the site and do[es] not show any prompts."*
- Proactive eviction: *"Safari proactively evicts data when cross-site tracking prevention is turned on. If an origin has no user interaction … in the last seven days of browser use, its data created from script will be deleted."*
- **Home-screen exemption (snippet only):** the WebKit blog post [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) reportedly says that the first-party domain of a home-screen web app is exempt from the 7-day cap on script-writable storage. Home-screen apps keep their own count of "days of use", and deleting their data would be "a serious bug". I could not open the page. The storage-policy post (<https://webkit.org/blog/14403/updates-to-storage-policy/>) was also blocked.

### TanStack Query (v5, `@tanstack/react-query@5.103.2`, published 2026-09-21)

- **`networkMode`** ([docs/…/guides/network-mode.md](https://github.com/TanStack/query/blob/main/docs/framework/react/guides/network-mode.md)):
  - `online` (default): *"Queries and Mutations will not fire unless you have network connection"*. They sit in `paused` and continue once the connection is back.
  - `offlineFirst`: runs the function once, then pauses retries. It is meant for a service worker or HTTP cache that may answer offline.
  - `always`: ignores connectivity.
- **Online detection:** `onlineManager` listens only to `window` `online`/`offline` events by default, and `setEventListener` can replace it. Source: [query-core/src/onlineManager.ts](https://github.com/TanStack/query/blob/main/packages/query-core/src/onlineManager.ts).
- **Mutation persistence** ([guides/mutations.md, "Persist mutations"](https://github.com/TanStack/query/blob/main/docs/framework/react/guides/mutations.md)):
  - Paused mutations can be dehydrated and resumed with `queryClient.resumePausedMutations()`.
  - *"mutations cannot be resumed when the page is reloaded unless you provide a default mutation function"*, because *"functions cannot be serialized"*. Register one with `queryClient.setMutationDefaults([key], { mutationFn })`.
  - Call `resumePausedMutations()` in `PersistQueryClientProvider`'s `onSuccess`.
  - By default only paused mutations are persisted: `defaultShouldDehydrateMutation = mutation => mutation.state.isPaused` ([hydration.ts](https://github.com/TanStack/query/blob/main/packages/query-core/src/hydration.ts)).
- **persistQueryClient** ([plugins/persistQueryClient.md](https://github.com/TanStack/query/blob/main/docs/framework/react/plugins/persistQueryClient.md)):
  - The default `maxAge` is 24 hours, and `gcTime` must be at least `maxAge`. The maximum `gcTime` is about 24 days because of the `setTimeout` limit.
  - A `buster` string throws away a cache written by an older build.
  - Writes are throttled to at most once per second (`throttleTime = 1000`).
  - The docs include an IndexedDB persister example using `idb-keyval`: *"Compared to Web Storage API, Indexed DB is faster, stores more than 5MB, and doesn't require serialization … can readily store … `Date` and `File`."* That means a pending photo `Blob`/`File` can sit in IndexedDB next to the queued mutation.

### Next.js built-in (experimental) offline retry

- Next.js 16.x adds `experimental.useOffline` and a `useOffline()` hook from `next/offline`. It detects offline state from browser events or failed fetches, polls with `HEAD` requests, and *"automatically retr[ies] blocked"* navigation, prefetch and **Server Action** requests.
- Its retry state lives in memory: polling *"continues … until a check succeeds or the page unloads"*. It does **not** survive the app being closed.
- The docs are present at tags `v16.3.0` and `v16.3.6` (the current `latest`).
- Sources: [use-offline.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/04-functions/use-offline.mdx), [config useOffline.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/05-config/01-next-config-js/useOffline.mdx).

## 3. Camera and photo: capture, HEIC, and client-side compression

### Picking or taking a photo

- `<input type="file" accept="image/*" capture="environment|user">`: iOS Safari supports `capture` since iOS 10 (BCD `html.elements.input.capture`). The values are `user` (front camera) and `environment` (rear camera), per MDN ([capture/index.md](https://github.com/mdn/content/blob/main/files/en-us/web/html/reference/attributes/capture/index.md)).
- WebKit behaviour ([WKFileUploadPanel.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/forms/WKFileUploadPanel.mm)):
  - **With `capture`**, if a camera is available, the panel opens the camera directly (`_shouldMediaCaptureOpenMediaDevice` → `_showCamera`), so the photo library is not offered.
  - **Without `capture`**, it shows a menu with Photo Library, Camera (when available) and Choose File.
  - For "photo of the day", omitting `capture` lets the child either take a photo or pick one they already took.

### HEIC

- **Camera shots are always JPEG.** WebKit notes *"Photos taken with the camera will not have an image URL. Fall back to a JPEG representation"*. It encodes with `UIImageJPEGRepresentation(image, 0.8)` and names the file `image.jpg`. Per the same file's FIXME, EXIF is not kept. Source: `WKFileUploadPanel.mm`, `_uploadItemForJPEGRepresentationOfImage`.
- **Library picks are converted by default.** The photo picker uses `PHPickerConfigurationAssetRepresentationModeCompatible` unless the `PhotoPickerPrefersOriginalImageFormat` preference is on. That preference is `status: internal` with `defaultValue: false` ([UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)). In the "compatible" mode, Photos hands over a widely compatible format (JPEG) in place of HEIC. A WebKit FIXME (bug 270470) says this should eventually follow the `accept` attribute.
  - Caveat: this is WebKit `main`, and I did not verify which iOS release ships exactly this code. The line that maps "Compatible" to JPEG is Apple PhotosUI behaviour. I could not open Apple's documentation page, so that mapping is inferred.
- **Safari can decode HEIF anyway.** It renders HEIF images since Safari/iOS 17 (BCD `mediatypes.image.heif`), and Chrome and Firefox cannot. If a HEIC file slips through on iOS 17+, the browser should still be able to decode it for canvas-based compression. This is inferred from the compat data and was not tested. Converter libraries such as `heic2any` (last published 2023-03-29) are therefore not needed for the iPhone-only case.

### Compressing to about 200 KB and 1000 px

- **Canvas cannot encode WebP on Safari.** BCD `api.HTMLCanvasElement.toBlob.type_parameter_webp` and `api.OffscreenCanvas.convertToBlob.option_type_parameter_webp` are both `safari_ios: false`.
  - The HTML spec says that when the type is not supported, the default `"image/png"` *"is also used if the given type isn't supported"* ([whatwg/html source](https://github.com/whatwg/html/blob/main/source), `toDataURL`/`toBlob` notes).
  - So `toBlob(cb, 'image/webp')` on an iPhone silently returns a **large PNG**. **Use `image/jpeg`.**
- **Supporting APIs:** `toBlob` works on iOS 11+, `createImageBitmap` on iOS 15+, and `OffscreenCanvas` on iOS 16.4+ (BCD `api.HTMLCanvasElement.toBlob`, `api.createImageBitmap`, `api.OffscreenCanvas`).
- **`browser-image-compression`** ([README](https://github.com/Donaldcwl/browser-image-compression/blob/master/README.md)):
  - Options include `maxSizeMB`, `maxWidthOrHeight`, `useWebWorker` (default true; falls back to the main thread), `fileType`, `initialQuality` and `preserveExif` (default false).
  - It uses OffscreenCanvas in a worker when available.
  - Settings for our target: `{ maxSizeMB: 0.2, maxWidthOrHeight: 1000, fileType: 'image/jpeg', useWebWorker: true }`.
  - **Maintenance note:** the latest version is 2.0.2, last published 2023-03-06 (npm registry). It still works, but it is unmaintained. A 30-line `createImageBitmap` → canvas → `toBlob('image/jpeg', q)` loop is a reasonable alternative.
- **Size check:** a 1000-px JPEG around quality 0.7 typically comes in under 200 KB. This is an estimate and was not measured on a device.

## 4. Making a Next.js App Router app installable and offline-capable

Source: the Next.js PWA guide ([progressive-web-apps.mdx](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/progressive-web-apps.mdx)). Next.js latest is `16.3.6` (npm).

- **Manifest:** create `app/manifest.ts` (or `.json`), the [manifest file convention](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.mdx).
- **Install requirements:** *"A valid web app manifest"* and *"The website served over HTTPS"*.
- **No install prompt on iOS:** `beforeinstallprompt` *"does not work on Safari iOS"*. The guide shows an iOS-only "tap Share → Add to Home Screen" hint component instead.
- **Web Push:** supported for *"iOS 16.4+ for applications installed to the home screen"*.
- **Offline:** the guide points to the experimental `useOffline` (section 2) and says: *"For full service-worker-based offline caching, one option is [Serwist]"*. It links Serwist's Turbopack and webpack examples.
- **Serwist status:**
  - Active. `serwist`, `@serwist/next` and `@serwist/turbopack` are at 9.5.12, published 2026-07-22 (npm).
  - README: *"a fork of Workbox that came to be due to its development being stagnated"*. It lists `next-pwa` and `@ducanh2912/next-pwa` as its original works ([README](https://github.com/serwist/serwist/blob/main/README.md)).
  - Examples: `examples/next-turbo-basic` uses `@serwist/turbopack` with `next build --turbopack`. `examples/next-basic` uses `@serwist/next` with `next build --webpack`. Both are on Next 16.2.
- **next-pwa status:** stale. `next-pwa` was last published 2022-08-23 (v5.6.0) and `@ducanh2912/next-pwa` 2024-09-18 (v10.2.9) (npm). Do not use either.
- **iOS manifest support** (BCD `manifests.webapp.*`, `safari_ios`):
  - Supported: `name`, `short_name`, `start_url`, `scope`, `display: standalone` (11.3), `theme_color` (15), `icons` (15.4, used only when no `apple-touch-icon` is present), `id` (16.4).
  - Not supported: `background_color`, `orientation`, `shortcuts`, `share_target`, `display: fullscreen/minimal-ui`.
  - So keep an `apple-touch-icon`.

---

## Recommendation

1. **Queue writes in the app, not in the service worker.**
   - Use TanStack Query with an IndexedDB persister (`idb-keyval`) and `setMutationDefaults` for each mutation key (e.g. `['completeTask']`). Call `resumePausedMutations()` after restore.
   - Keep the default `networkMode: 'online'` for mutations so they pause offline, with optimistic `onMutate`.
   - Also call `onlineManager.setOnline(navigator.onLine)` and `resumePausedMutations()` on `visibilitychange` → visible. Default detection relies only on `online`/`offline` events, and I could not confirm those fire reliably when an iOS app resumes.
   - Serwist's request-replay queue is less suitable. It replays stored HTTP requests, which carry a Supabase access token that may have expired by then. An app-level queue re-authenticates first. This is my reasoning, not a sourced claim.
2. **Set expectations: nothing syncs while the app is closed on iOS.** Background Sync is unsupported. Sync happens on the next open or foreground with signal. The parent's approval view should treat "not yet synced" as normal. Make writes idempotent, for example with a client-generated UUID per completion, because replays can repeat.
3. **Photos:**
   - Use `<input type="file" accept="image/*">` **without** `capture`, so the child can take a new photo or pick an existing one. Add `capture="environment"` only if picking from the library should be prevented.
   - iOS hands over JPEG in both cases, so no HEIC library is needed.
   - Compress to JPEG (never WebP on iPhone), 1000 px on the long edge, targeting 200 KB or less. Use `browser-image-compression` or a small `createImageBitmap` + canvas helper.
   - Store the pending `Blob` in IndexedDB with the queued mutation and upload it to Supabase Storage on resume.
4. **Installable and offline shell:**
   - Use `app/manifest.ts`, an `apple-touch-icon`, and an iOS "Add to Home Screen" hint.
   - Use Serwist for precaching the app shell (`@serwist/turbopack` if building with Turbopack, which is the Next 16 default; otherwise `@serwist/next` with webpack).
   - Do not use `next-pwa`.
   - `experimental.useOffline` is a nice extra for the offline banner and navigation retries, but it is not a durable queue.
5. **Protect storage:** call `navigator.storage.persist()` once after install. Children should log in **inside** the installed home-screen app. Home-screen apps are reportedly exempt from Safari's 7-day eviction, but that is unverified (snippet only).

## Claims not verified from a primary source

- The home-screen app exemption from the 7-day script-writable storage cap. It comes from a search snippet of webkit.org/blog/10218, which I could not open.
- Whether home-screen apps have a storage container separate from Safari (so a Safari login does not carry over), and whether removing the icon wipes the data. The WebKit blog was blocked.
- That PhotosUI "Compatible" representation mode yields JPEG for HEIC originals. Apple's docs were not fetched.
- Which exact iOS release ships the WebKit `main` file-upload code quoted above.
- Whether `online`/`offline` events fire reliably when an iOS home-screen app resumes from suspension.
- That canvas can decode a HEIC `File` on iOS 17+. This is inferred from BCD `mediatypes.image.heif` and was not tested.
- The size of a 1000-px JPEG at a given quality. It is an estimate, not measured.
