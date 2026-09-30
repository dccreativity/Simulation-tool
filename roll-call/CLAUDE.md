# Bhutan trip roll call

A phone app (installable web app) for the school trip to Bhutan, 01–07 Oct 2026. Six team in-charges take attendance; marks sync live between every teacher's phone and keep working offline. 70 students in 6 groups. Owner: Deepak Chaudhary.

## Layout
- `site/` is the whole deployable app, hosted on Vercel: import the GitHub repo in Vercel with Root Directory `roll-call/site`, Framework Preset "Other", no build command. `site/vercel.json` stops the page and service worker being cached stale.
  - `index.html`: the app in one file (no build step). Design follows Deepak's template: hero dashboard, group list, student list with ✓/✗ circles, Save Attendance, Attendance Summary with day chips and donut, Absent Students, Switch Group sheet.
  - `sw.js`: offline cache. **Bump `CACHE` on every deploy.** Page is network-first, so phones pick up new deploys when online.
- `supabase/roll_call_sync.sql`: the database (already applied to project `bhutan-roll-call`, ref `pbslzkivjowyakpttuau`, ap-south-1).
- `tools/lock_roster.py`: re-encrypts `private/student-list.json` with the trip code into `site/index.html` and prints the SQL to register the new sync key.
- `private/` (git-ignored, never deploy or commit): plain student list and trip code.

## What teachers do
Open the shared link `https://<site>/#code=<trip code>`: it unlocks by itself (the `#` part never reaches the server and is removed from the address bar). Then tap their group. No home-screen install needed. Nothing else: no files, no list editing, no creating roll calls.

## Roll calls (fixed, no setup)
- One roll call per trip day, id `dYYYYMMDD` (from `TRIP.start` and `TRIP.days`).
- Four airport sheets with all 70 students in one list, ids `air1`–`air4`: Ahmedabad check-in, Bagdogra check-out (going); Bagdogra check-in, Ahmedabad check-out (return).
- Master sheet: every student × every roll call, with present/absent totals, live.
- Group names/icons are in `GROUPS` (t1–t6); teacher names come from the encrypted list.

## Sync
- Marks only (the list can't be edited, so no roster sync). Local data in `localStorage` `bhutan-roll-call-v2`: `{teams, marks: {checkId: {studentId: {st, at}}}, outbox, lastSrv, myTeam}`.
- Sync key: PBKDF2-SHA256 512 bits from the trip code with `LOCKED_LIST` salt/iterations; bytes 0–32 decrypt the list, bytes 32–64 (hex) are the sync key, stored under `bhutan-roll-call-sync`.
- Client pushes the outbox to `rc_push`, then pulls `rc_pull(since = lastSrv − 60 s)`, merges last-writer-wins on `at`. Polls every 10 s while visible, plus on `online` / `visibilitychange`. Status pill in the hero.
- Server: `rc_marks` + `rc_secret` (sha256 of the sync key), RLS on with no policies; only the two SECURITY DEFINER functions are granted to anon.

## Not done / open
- The Absent Students screen has no call button: the student list has no phone numbers. Add a `phone` field to students if wanted.
- Flight numbers/times aren't shown (not provided).
