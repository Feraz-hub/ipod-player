# Nightshift

A cinematic music player inside a responsive iPod body, built with React, TypeScript and Vite. The night-city browser is the device's display; a permanent physical-style click wheel controls it. Desktop uses the horizontal screen-and-wheel arrangement, while phones put the screen above a large wheel. The attached video was played in VLC and inspected frame by frame. Its artwork reel, dark city and direct transition into clips guide the display. The disc spins in a fixed position while its music logo stays upright. During playback, video fills the display and screen controls fade out after two seconds; the physical wheel remains available. The reference films, songs, album artwork and anime excerpts are not redistributed.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the printed localhost address. Without environment variables, the complete local player works: five original ambient demo tracks, audio/video imports, browser-persistent files, editable audio tags, favorites, playback, seeking, shuffle, repeat, volume, dimming and scene selection. Audio starts after a Play gesture. The spinning disc is part of browsing; full-screen playback gives the scene the screen.

```sh
npm test
npm run build
npm run preview
```

`npm test` runs 20 checks: real PostgreSQL migration and row-level access tests using PGlite, the actual Edge handler against a mocked Auth/Storage transport, upload validation, wheel boundary cases, video manifest/license/SD-source consistency, project-path/offline-cache privacy checks, and Home Screen email-link validation. No Supabase account is required for these tests. Hosted Auth, Storage and Edge Functions still need the live setup and acceptance check below.

## iPhone Home Screen

Open the published player in **Safari → Share → Add to Home Screen**. Keep **Open as Web App** enabled if shown, and tap **Add**. Open the Nightshift icon. Settings also contains these steps. The manifest, Apple icon and standalone display support a normal Home Screen launch; safe-area spacing accommodates the phone’s system areas.

After an online visit, the production service worker caches the interface, metadata parsers, original demo generator and small background stills. External clips and account music require a connection. The service worker never caches private audio, API responses, authorization requests or auth callback URLs. Updates install in the background and activate after the old app closes, without forcing a reload during uploads.

### Keeping your music

**Sign in and choose “Upload to my account.”** Wait for the saved confirmation before closing the app. The file is stored in a private Supabase bucket, independent of this phone’s browser storage. Signing back in retrieves the account library even after local site data is cleared. GitHub holds the app source, never your uploaded music.

Unsigned users must explicitly choose a **device-only import**. It is stored in IndexedDB and requests persistent browser storage when available, but iPhone cleanup, clearing site data, removing the app or browser storage eviction can remove it. The app never silently substitutes a device import for a failed cloud upload. Safari and the Home Screen app may have separate local storage; sign in and upload from the Home Screen app for your account library.

Keep original music files or an independent backup. No free hosted service can guarantee retention “no matter what”: Supabase Free may pause inactive projects and has limited recovery windows; a database backup does not include Storage file contents. The app has no automatic file expiry or deletion when a quota is reached. [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [database versus Storage backups](https://supabase.com/docs/guides/platform/backups).

## Controls

The wheel is always visible outside the display. Circular dragging, scrolling over the ring, or arrow keys moves the highlighted song. Press its center to select. MENU opens the Music menu; rotate to highlight All tracks, Favorites, demos, uploads, shuffle, repeat, community, account, settings, trailers or help, then press the center. MENU closes the menu or returns from playback to browsing. The left/right buttons move selection while browsing and skip tracks during playback. The bottom button plays or pauses. During playback, wheel rotation changes music volume, shown below the ring. The `W` key or the display's disc icon focuses the controls. On desktop, the body corner button enlarges the display while keeping the wheel beside it. Moving the pointer or tapping brings playback controls back. The magnifier opens search, Wi-Fi opens community clips, and the speech bubble opens your account.

| Input                                   | Browse                          | Playback                     |
| --------------------------------------- | ------------------------------- | ---------------------------- |
| Drag around wheel / mouse wheel over it | Move selection                  | Change music gain            |
| Center                                  | Play selected track             | Play / pause                 |
| Top / MENU                              | Return to library               | Return to library            |
| Left / right wheel buttons              | Previous / next selection       | Previous / next track        |
| Bottom wheel button                     | Play                            | Play / pause                 |
| Keyboard ↑ / ↓                          | Move selection                  | Volume up / down             |
| Enter                                   | Play selection                  | Native focused button action |
| Space                                   | Play / pause                    | Play / pause                 |
| ← / →                                   | Previous selection / next track | Seek five seconds            |
| + / −                                   | Music volume                    | Music volume                 |
| Escape                                  | Return                          | Return to library            |

Touch gestures use the same circular motion. Player gain uses Web Audio `MediaElementAudioSourceNode → GainNode → destination`, with smooth gain ramps. The phone's system volume is not changed. The video element is always muted. Motion is reduced when the operating system requests it. Browser full-screen is optional and may be unavailable in embedded or mobile browsers.

The highlighted song smoothly grows larger than neighboring rows, including its artwork, title and artist. Short synthesized beeps mark wheel steps and menu selections. Sounds unlock after the first pointer/key interaction and can be disabled with **Settings → Wheel sounds**; this preference is saved in the browser. No external sound files or audio service are needed.

## Connect Supabase Free

The hosted player is connected to a dedicated Nightshift iPod Supabase Free project. Its schema, private buckets, gateway and production auth URL are deployed. No billing or paid upgrades are enabled. The steps below document rebuilding this setup in a new project; do not rerun the initial migration in the existing database.

1. Create a **Free** Supabase project in a Free organization. Use a dedicated project for this app. Do not add a payment method or enable a paid plan. If a service requests payment, keep using local mode.
2. In the new project's SQL Editor, execute `supabase/migrations/202611020001_nightshift.sql` **once**. It creates tables, policies, atomic limit functions, and the two private storage buckets. The migration is intended for a fresh project.
3. Verify that both `private-music` and `community-clips` are **private**. Do not create public buckets or add permissive `storage.objects` policies. Approved community videos are public through the gateway only. They are stored once and every viewer fetches that same object.
4. Use Supabase CLI to deploy the included gateway when ready:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy media-gateway --no-verify-jwt
   ```

   Gateway JWT verification is deliberately implemented inside the function with `auth.getUser()`: approved clip playback is public, while music, uploads, state and mutations require a verified account. Every operation checks ownership or the explicit moderator table. `verify_jwt = false` does **not** disable these application checks.

5. In **Edge Functions → Secrets**, set `ALLOWED_ORIGINS` to an exact comma-separated list of origins, with no paths or trailing slashes:

   ```text
   http://127.0.0.1:5173,http://localhost:5173,https://YOUR_USERNAME.github.io
   ```

   The hosted runtime already supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key belongs only in that server runtime. Never add it to a `VITE_` variable, GitHub repository variable, frontend code, or committed file.

6. Copy `.env.example` to `.env.local`. Fill in the project URL and its **public publishable/anon key**. Leave `VITE_BASE_PATH=/` for local development. Restart Vite after changing the file.
7. In **Authentication → URL Configuration**, set the Site URL to the future site URL. Add both localhost URLs and the exact future Pages URL as allowed redirect URLs, for example `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.
8. Enable Email auth. The app offers magic-link sign-in. In an iPhone Home Screen app, hold the Sign in link in the email, choose Copy Link, and paste it into the player’s sign-in form before opening it elsewhere. Only this project’s verification links are accepted. A one-time code is also supported if your custom email template supplies one. Supabase Free currently requires custom SMTP for editing email templates. Supabase's built-in email sender currently only sends to organization team addresses and is limited to roughly two emails per hour. Test with your project owner's email. Public sign-ins require custom SMTP; use a free SMTP allowance you already have that requires no payment method, or use the included GitHub OAuth option described below. Do not enable paid email delivery to proceed. [Supabase SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
9. After signing in, add a file again to save it in your account. Browser-local files are not silently uploaded. Your private audio metadata and file are then readable only by your account through the app. Application moderators can review clips but cannot browse or stream other accounts' music.

### Optional GitHub sign-in without SMTP

The sign-in dialog can also offer **Continue with GitHub**. It is hidden until configured. Set the public build variable `VITE_GITHUB_AUTH_ENABLED=true` only after completing the provider setup, then redeploy. To configure it, create a GitHub OAuth App in your GitHub account's **Settings → Developer settings → OAuth Apps**. Set the homepage to your website URL and the authorization callback URL to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. In Supabase **Authentication → Sign In / Providers → GitHub**, enable GitHub and enter that OAuth App's Client ID and Client Secret. Keep the secret in Supabase's provider settings only. Retain your site URLs in the auth redirect allowlist. This uses GitHub's account sign-in and does not send magic-link emails or require a paid SMTP service. An unconfigured provider returns an auth error; local mode remains available.

### Moderation queue

In **Authentication → Users**, copy the UUID of your moderator account. Run this in SQL Editor as the project administrator:

```sql
insert into public.moderators(user_id) values ('YOUR_MODERATOR_USER_UUID');
```

Sign out and back in. **Community clips → Moderation queue** shows pending and hidden clips. Review the source link, rights declaration and file before approving. The clip's details show submitted reports. Approve exposes the single stored file through the public gateway; Hide stops new playback requests. Previously fetched browser copies cannot be recalled.

Signed-in uploaders must provide a title, category, source URL, permission details, and explicit confirmation of sharing rights. New clips are pending. Users can report an approved clip once; three distinct reports automatically hide it. Each user is limited to five reports and 20 upload reservations per 24 hours. Users can delete their own uploads; moderators can also remove clips. There is no automated copyright verification or production abuse-detection service.

### Limits and safe failure

The **aggregate ceiling is 850,000,000 bytes (850 MB)** across private music, approved clips, pending clips and incomplete upload reservations. It is enforced in a serialized PostgreSQL function before accepting a file, not just in frontend JavaScript. Each file is limited to 40 MB. The provider's separate 1 GB file-storage allowance leaves headroom. Use a dedicated project; unrelated files in another bucket are outside this ledger.

`public.app_limits` is administrator-only. Change limits downward, or pause uploads/streams, using SQL Editor:

```sql
update public.app_limits
set storage_cap = 800000000,
    monthly_egress_cap = 3500000000,
    uploads_enabled = true,
    streams_enabled = true
where id = true;
```

The database prevents raising these values above 850 MB storage / 4 GB media transfer budget. No automatic deletions or paid upgrades exist. If the library is full, existing files remain and uploads pause. Explicit user deletion removes the object through the Storage API before releasing its reservation. Do not delete `storage.objects` rows directly.

Media requests reserve **three times the entire file size plus 16 KB** before downloading. This conservative budget allows for Storage-to-Edge-to-browser transfer and overhead. The app downloads one requested music file or clip into a temporary Blob, so local seeking does not create repeated range requests. A new request is charged again. Only the active and fading scene are kept; object URLs are revoked. A 40 MB file can take time to buffer on a slow connection. Upload progress measures network transfer and then shows a finishing stage.

The media ledger resets automatically in a new UTC calendar month. Failed transfers keep bandwidth reservations. It is a **media safety budget**, not a real-time meter for every Supabase byte: database queries, Auth, errors, logs, unrelated project traffic, and Edge invocations also consume provider quotas. The app cannot guarantee public, unbounded traffic fits a free service. Check **Supabase → Usage** regularly and pause the project or gateway if other quotas are near their limit. Provider-side Free plan restrictions remain the final boundary. Never move the organization to a paid plan or add a payment method to address traffic.

Official limits checked on 2026-11-02: [Supabase billing/free quotas](https://supabase.com/docs/guides/platform/billing-on-supabase), [Storage pricing](https://supabase.com/docs/guides/storage/pricing), [Storage egress](https://supabase.com/docs/guides/storage/serving/bandwidth), [Edge runtime limits](https://supabase.com/docs/guides/functions/limits). Free quotas can change; cached/uncached egress have separate allowances. Auth mail and paused inactive projects can affect availability. All local scenes and browser-local music continue without Supabase.

### Recover an interrupted upload

A reservation is counted before uploading. Failed uploads never release space automatically, because a partially completed object may exist. Reserved files appear in **My account → Your uploads** and can be deleted there. Files stuck in `uploading` intentionally cannot race with deletion.

For an interrupted upload, the project administrator should wait until the Edge request is no longer active (at least the provider's 150-second Free runtime limit), confirm the object path `OWNER_UUID/MEDIA_UUID` in the appropriate bucket, and remove that object with the Storage UI/API. Only after successful removal, mark that exact reservation deleted:

```sql
update public.media set status='deleted', cover=null, updated_at=now()
where id='EXACT_MEDIA_UUID' and status in ('reserved','uploading','deleting');
```

Never mark reservations deleted while an upload is in flight. An administrator should handle account deletion by removing the user's stored files first; the media foreign key prevents silently orphaning objects.

## GitHub source and Pages

The source repository is `Feraz-hub/ipod-player`; its Pages workflow publishes the production app at `https://feraz-hub.github.io/ipod-player/` after deployment is configured and a workflow succeeds.

1. Create a **public** GitHub source repository for free Pages hosting. Public source does not contain uploaded music or video. [GitHub Free Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
2. Commit source, lockfile, migration and README. `.env.local`, references, test media, uploads, build output and dependency folders are ignored. Review staged files before pushing. Do not force-add ignored files.
3. In the repository, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using only the public project values. Leave them unset for a local-only public demo. These values are visible in the browser bundle by design.
5. `.github/workflows/pages.yml` tests, builds and deploys on pushes to `main`. It can also be run from **Actions → Publish Nightshift to GitHub Pages → Run workflow**. Only `dist/` is uploaded; source, configuration secrets and uploads are not part of the Pages artifact. Changing repository variables requires another workflow run.
6. The workflow builds a project site under `/REPOSITORY_NAME/`. For a `USERNAME.github.io` repository or custom root domain, change its `VITE_BASE_PATH` to `/`. The app uses state navigation, so it does not require server-side SPA rewrites.
7. Set the matching auth redirect URL and gateway allowed origin in Supabase. Open the resulting Pages URL and run the acceptance checks.

Do not place MP3, MP4, WebM, WAV, FLAC or M4A files in the Git repository or Pages artifact. GitHub Pages serves the application code and the small licensed background still. User files belong in the private Supabase buckets, or in the visitor's IndexedDB for local sessions.

## Starter scenes, footage and trailers

`public/clip-manifest.json` records individual source pages, creators, license details, enabled items, reviewed exclusions and source-only candidates. The interface shows credits in scene details.

- Six original procedural scenes are included as source code: rainy city, window rain, abstract orbits, moving skyline, moonlit rooftop silhouette and teal cyberpunk skyline. These and the original demo audio generator/cover graphics are dedicated under **CC0-1.0**. They are rendered on-device and use no paid API or file storage. They are clearly identified as original scenes, not stock video or actual anime footage.
- **35 individually verified videos** stream on demand: 24 Mixkit Free videos, ten Pexels videos using their published 240p/360p download selections, and a Wikimedia Tokyo rain clip using its published 240p transcode. The collection includes Tokyo streets, transit and rain; Chinese lanterns and Chinatown; rainy forests, leaves and water; jellyfish, clockwork, a night carousel, church candlelight, a desert road, a ringed planet, a projector, a retro TV and swirling ink. Source pages, creators and license links are preserved in the manifest and scene details. The Wikimedia work is attributed to Fumikas Sagisavas under CC BY 4.0, with muting, cropping and dimming identified. These are creative playback scenes with no stock-file download feature. External links can change; errors keep the backdrop visible and allow the montage to continue. No video file is committed or deployed through Pages.
- The specific Pixabay anime-style scene by SYG_Anime was verified under the Pixabay Content License, but its file download was blocked by an access challenge. It remains a source link and disabled manifest entry. Another rainy-city candidate is also source-only. No guessed CDN URLs or licenses are included, and no Pixabay API key is required.
- Mixkit items marked **personal-use only** remain excluded. The montage shuffles for each song, visits every item before repeating, and keeps only the current and incoming scenes loaded. Four-second shots count from readiness, with soft crossfades and a 15-second load timeout. Small Pexels sources avoid 4K downloads; Mixkit uses its published 720p previews. Existing dimming, grain, scanlines and slight softness preserve the older display look.
- **Below the sleeping sea** is an original hand-drawn-style canvas animation: a drifting figure, giant jellyfish, submerged arches and particles in dim blue water. It is CC0-1.0, contains no anime/franchise artwork, and joins the automatic montage. The six earlier procedural scenes remain available manually. The city backdrop's generation prompt is recorded in `docs/background-asset.md`.

When a song is selected, its highlighted artwork pulses briefly while audio prepares. There is no separate “Tuning in” loading label.

- To add more stock footage, verify the **individual** item and license for your creative player, retain its source/creator/license, compress under 40 MB, submit it through a signed-in clip upload, and approve it as moderator. Never approve a clip simply because it is watchable online. Review restrictions on standalone redistribution; don't add a download button for licensed stock originals.
- Real anime/film trailers are linked to the official GKIDS distributor page in a separate area. Opening it pauses music. No trailer is downloaded, muted, cropped, looped or used as a background.
- If a future Pixabay integration needs an API key, implement it in a server-only Edge Function secret. Never introduce `VITE_PIXABAY_KEY` or commit a key. Manual verified uploads already work without an API.

The player uses local Arial/Helvetica/system fonts. Icons are Lucide. No analytics, subscriptions, billing SDK, paid API, paid hosting, or automatic upgrade integration is included.

## Live acceptance checks after setup

1. Sign in as account A. Upload music, edit its title and artist, favorite it, play, seek, rotate both directions to change gain, pause, skip and return with MENU. Reload and verify library/settings persistence. Playback never resumes without a gesture.
2. Sign in as account B in a separate browser. A's tracks, covers, state and files must be unavailable. Also test with the moderator role: it must not reveal A's music.
3. Submit a permitted clip as A. B must not see or stream it until approved. Approve from the moderator queue, watch as B while music plays, and check the video is muted. Confirm there is just one stored object.
4. Report with three distinct accounts; verify hiding. Test owner deletion and unauthorized deletion. Check moderation report reasons in the clip details.
5. Lower the storage and bandwidth limits in SQL Editor. Attempt a file that crosses the remaining budget. It must fail with a useful message and retain existing media. Restore the limits only within the hard ceilings.
6. Interrupt an upload and follow the recovery procedure. Never release a reservation before object removal.

## Verification and practical limits

Local browser testing covers desktop and phone layouts, center/outer wheel actions, audio start/pause, metadata import, favorites and file persistence. The production build and SQL/access tests run locally. Live Supabase integration is not claimed to be verified without your project. Browser quota eviction, disabled site storage, unsupported codecs, provider downtime and slow connections can interrupt playback. Keep originals of local uploads: IndexedDB is not a backup. There is no cross-device synchronization until Supabase is configured, no automatic rights verification, and no promise that unrestricted public traffic fits free hosting.
