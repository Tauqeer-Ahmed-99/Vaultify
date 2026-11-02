# Push notifications

Vaultify uses the existing Firebase Authentication project, Realtime Database, EAS project and application identifiers. `notification-server/` is an isolated API-only Next.js application deployed as Vercel Functions. Backend dependencies and secrets stay outside the mobile bundle. There is no Firestore, Firebase Cloud Function, Vercel Queue, cron job, reconciliation endpoint or persistent listener.

Delivery is intentionally **best effort, one attempt per device**. This replaces the earlier durable-retry design at the user's request. Automated validation is limited to lint and TypeScript checks. The user subsequently authorized the Vercel backend deployment and an Android production build, version bump and GitHub release. Exact APK/build results belong in the matching GitHub Release linked from [releases.md](releases.md). No tests, real notifications or billing-plan changes are part of this work.

## Recipient behavior

| New event | Eligible recipients |
| --- | --- |
| Group transaction | Creator, even without a membership record, and currently accepted members; exclude the author |
| Linked personal transaction | Currently linked recipient; exclude the author; reverse sent/received for their view |
| Personal ledger created with a verified linked contact | Linked recipient |
| Existing personal ledger newly linked or retargeted | Newly linked recipient; no repeat alert for saving the same recipient |
| Group invitation created or legitimately reissued | Invitee; pending/accepted invitations conflict |
| Private ledger creation or group creation alone | Nobody |

There are no edit/delete alerts or history backfills. Recipients and access epochs are captured from authoritative records during the mutation. Before sending, the server rechecks ledger/transaction existence, ownership, accepted membership or current link, invitation version and notification preferences. People joining afterward cannot receive historical transaction alerts. Leaving/rejoining or unlinking/relinking changes the access epoch. Stale invitations and revoked access are suppressed.

Visible transaction previews include ledger name, actor profile label, INR amount, recorded direction, date in the recipient device's registered time zone (UTC fallback), and a note capped at 90 characters. Group wording says the actor **recorded** a transaction; it never claims Vaultify executed a bank transfer. Linked-personal directions match the recipient's mirrored view. Hide-details mode uses a generic visible title/body; routing data contains identifiers only.

## Save once, attempt push once

`POST /api/mutations` handles `createLedger`, `editPersonalLedger` (including link/unlink/retarget), `createTransaction` and `invite`. It verifies a Firebase ID token with revocation checking, derives the actor UID, validates limits and explicitly enforces ownership, accepted membership, invitation conflicts and contact verification. Identity and notification text are derived server-side. Personal contacts require both the rule-protected verified profile and Admin Auth verification; email resolution must match the current verified Auth email. Username group invitations retain existing consent behavior.

The API accepts at most 8 KiB of JSON and applies a persistent 60 requests/minute/user limit. Configure Vercel Firewall protection for unauthenticated traffic. CORS allows configured web origins but is not authorization. Existing realtime reads, authorized edits/deletes, group metadata and membership consent transitions retain their paths. RTDB rules block direct creation, invitation reissue, link changes and client access to notification/device records. There is no alternate creation path that silently bypasses the API.

A stable timestamped UUID is scoped to authenticated UID and action. The mutation and its payload hash/idempotency record commit atomically. Deterministic resource IDs prevent duplicate saves; reusing the operation ID with different data is rejected. The phone preserves an unresolved operation by user and payload digest across restarts, shares simultaneous identical calls and clears it after success or a definitive rejection. Retry the same values after an interrupted save to confirm it safely; changing them is a separate operation.

The idempotency record reserves the notification attempt **in the same commit as the mutation**. Only the request that creates this record may send. After commit, that request awaits `sendOnce`; duplicate/concurrent/replayed requests confirm the mutation and read its status without sending again. If the function dies between commit and send, or an HTTP call times out ambiguously, the notification is lost or unknown and is **not retried**. A client retry never restarts an unfinished push attempt. No new outbox records, worker leases, retry timestamps, delivery queues or scheduled work are created.

Sends use at most six concurrent recipient jobs. Each job submits the recipient's currently registered devices in one Expo request (at most ten devices); each device token appears at most once in the event. There is a twelve-second soft processing budget and a maximum six-second timeout per Expo request. Recipients not reached before that budget expires are skipped permanently. Groups retain the 200-recipient cap; large/slow fan-outs may be incomplete. No unawaited promises or `waitUntil` are used. Database/auth latency adds to the request time, so the client can still time out after a successful save; idempotency makes confirmation safe.

Successful saves return `{ committed: true, accountId, transactionId?, notification, notificationPending: false }`. `notification` is:

| Status | Meaning |
| --- | --- |
| `none` | No eligible notification event |
| `accepted` | Expo accepted all attempted sends and no recipients were skipped; this does not prove device delivery |
| `suppressed` | No current access, notifications disabled, or no active device registrations |
| `failed` | Expo rejected all attempted sends |
| `partial` | Some sends accepted and others failed, became unknown or were skipped |
| `unknown` | Attempt reserved but completion unknown, a network interruption occurred, or recipients were skipped |

Notification-service or status-recording failure never changes an already committed save into a failed save. Summary counts are saved with the idempotency record when possible; they contain no tokens or message bodies. While the winning request is still running, a concurrent confirmation can legitimately return `unknown`. `notificationPending` is always false because nothing is scheduled to resume.

## Receipts, retention and limitations

There is **no Expo receipt polling** or delayed provider-error handling. An immediate `DeviceNotRegistered` ticket removes the active registration only if its token/generation still match, protecting replacement registrations. Invalid registrations reported only by a later FCM/APNs receipt are not detected by this minimal implementation. Device registrations expire after seven days and refresh on authenticated activation/token changes. Expired registrations are ignored even if physical cleanup has not run.

Operation records last at least 31 days. First-time operation IDs must be at most one day old; the normal confirmation window is 30 days, so pruning cannot reopen an old mutation. Successful mutations opportunistically run small, awaited maintenance: at most five expired operation records, five stale throttle records and five expired device installations, with a two-second soft budget between operations. No maintenance task sends or retries a notification. With no activity, expired metadata remains until later activity or operator cleanup; there is no scheduled retention guarantee. User preferences remain until changed or handled by a future account-deletion flow.

Atomic authorization spans existing top-level RTDB paths, so the backend retains a **root compare-and-swap transaction**. It retries permission checks on concurrent deletion/access changes instead of recreating deleted data. Root transactions download the snapshot, contend with other writes and cost bandwidth. They fail closed above 16 MiB serialized size. Monitor size and mutation latency before this small-database boundary; opportunistic maintenance is not a high-volume retention service. A future scaling change must redesign atomic RTDB aggregates, not replace authorization with an unchecked Admin update.

The server attempts a device at most once for a given operation, but **exactly-once end-device delivery is not guaranteed**: Expo/FCM/APNs and the OS may duplicate or drop a notification. Already accepted or OS-queued messages cannot be revoked after deletion, logout, opt-out or access changes. There is an unavoidable interval between the last access check and external delivery. Without receipts, a successful ticket means only acceptance by Expo.

## Server configuration

Keep these in the notification server's Vercel environment or ignored `notification-server/.env.local`. Never put them in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variables.

| Variable | Value |
| --- | --- |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT` | Complete service-account JSON for the existing Firebase project, with RTDB administration and Auth verification/user lookup access |
| `FIREBASE_DATABASE_URL` | Exact existing RTDB instance URL matching the app |
| `EXPO_PROJECT_ID` | Existing EAS project `45b5b14c-c5a1-448d-9e39-77c1e691f6ea` |
| `EXPO_ACCESS_TOKEN` | Token with access to that Expo project's Push Service; enable enhanced push security |
| `NODE_OPTIONS` | `--experimental-require-module` on Vercel: required by the installed Firebase Admin/JWKS dependency chain |
| `ALLOWED_WEB_ORIGINS` | Comma-separated exact allowed HTTPS web origins; empty if no browser client is deployed |

No scheduler secret, queue region, queue credentials or OIDC setup is required. Existing `CRON_SECRET`/`QUEUE_REGION` values can be removed when retiring the old setup. Keep Admin credentials, FCM service-account keys, APNs keys, `.env.local` and `.vercel/` out of version control.

Vercel disables `require()` of ES modules by default. The installed Firebase Admin dependency chain requires the documented `NODE_OPTIONS` setting above; otherwise functions can fail at startup with `ERR_REQUIRE_ESM` even after a successful build. See [Vercel runtime configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

Use Node 22 and the Next.js preset with `notification-server/` as the Vercel project root. The existing API routes are `/api/mutations`, `/api/devices`, `/api/preferences` and `/api/destination`. The mutation route has a 60-second function duration. Locally, run `npm install` then `npm run dev`; Next.js serves port 3000 without Vercel login/linking. For deployment only, the locally installed CLI is `npx vercel`; the backend was linked and deployed during the authorized setup described below.

The app needs `EXPO_PUBLIC_NOTIFICATION_API_URL=https://<notification-server-domain>` without `/api`. This public base URL must accept Firebase bearer-authenticated native clients; do not embed Vercel protection bypass secrets in the app. For local device use, expose the API through a separate HTTPS tunnel; a Metro tunnel alone does not expose the API. Keep all existing public Firebase variables. Local API execution still reaches the configured Firebase instance and can send real pushes; use test accounts/devices you control.

### Current backend deployment

The authorized setup deployed the server at **https://vaultify-notification-server.vercel.app** in the existing `tauqeerahmed99s-projects` Vercel scope, project `vaultify-notification-server`, using Node 22. Firebase Admin credentials and the Expo token are configured as production-only sensitive variables; project IDs, database URL and the required Node runtime option are configured server-side. No queue or cron is configured. A read-only request to `/api/preferences` returned JSON 401 without authentication; no authenticated mutation or notification was invoked.

The root ignored `.env.local` now contains `EXPO_PUBLIC_NOTIFICATION_API_URL=https://vaultify-notification-server.vercel.app`. The ignored server `.env.local` contains local server credentials. `.vercelignore` excludes those files and credential-key files from source upload. The existing Firebase Android configuration was downloaded to ignored `google-services.json` after verifying project and package IDs. No Firebase/Expo project was replaced.

Android release preparation configured the existing Firebase service-account credential as the FCM v1 key for `com.assetsmanagement.app` in EAS, preserving the existing Android keystore. EAS's production environment includes the public API URL, the existing public Firebase variables, and the `GOOGLE_SERVICES_JSON` secret file variable. The production build profile explicitly selects that environment. `.easignore` excludes the entire notification server, local environment files, credentials and documentation from mobile upload; the Google config is supplied separately by EAS. App/package versions advance together to 2.0.0 because strict API-only creation rules require older clients to update. The remote Android versionCode is managed separately following the release instructions.

The user-authorized rules cutover completed at **2026-11-02T10:40:26Z** on `https://assets-management-1afc6-default-rtdb.firebaseio.com` in the existing `assets-management-1afc6` project. The Firebase Admin SDK deployed the exact repository `database.rules.json`; authenticated readback matched its canonical SHA-256 `65a37e17d337b6a32ee481cfff67a79370b8e2834d2a07a5739b3cbc388a4747`. Before deployment, the live rules were backed up to ignored `dist/firebase-rules-backup-2026-11-02T10-39-57-568Z.json`; a bounded shallow inspection found no additional production paths omitted by the new rules. No ledger data was changed by this deployment. Older clients' direct creation/link/invitation write paths are now blocked, so users need the 2.0.0 app.

Remaining rollout work: confirm the FCM HTTP v1 API/permissions and verify authenticated mutations, rule allow/deny behavior and device delivery. APNs/iOS setup is deferred because the authorized build targets Android only. No billing plan was changed.

## Native credentials and mobile behavior

Keep the existing Android/iOS identifier `com.assetsmanagement.app` and EAS project above. SDK 57-compatible `expo-notifications`, `expo-device` and `expo-crypto` were installed with Expo's installer; `expo-constants` already exists. The notifications config plugin is configured. No native directories were created or edited by hand.

For Android, download the existing Firebase Android app's `google-services.json` to the ignored root path, or provide EAS file variable `GOOGLE_SERVICES_JSON`; `app.config.ts` reads that path. Separately configure the FCM HTTP v1 service-account credential in EAS (`npx eas-cli@latest credentials`, Android, Google Service Account, Push Notifications FCM v1). Use the existing project and matching package, API permissions and key restrictions. See [Expo FCM v1 setup](https://docs.expo.dev/push-notifications/fcm-credentials/).

For iOS, configure the existing Apple application ID/team's push capability, APNs key and provisioning profile in EAS Credentials. See [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [app credentials](https://docs.expo.dev/app-signing/app-credentials/). A fresh native build is required; Expo Go and an OTA update cannot add the native modules. Read [releases.md](releases.md) before any future build/version/release action. Android is the only platform selected for this release; there is no store submission.

Sharing offers account-wide push opt-out, hide-details previews, device enable/retry and system settings. The OS prompt requires explicit enable after sign-in. Registration failures do not block ledger use. Users can register ten devices; token uniqueness and installation proof prevent one token remaining subscribed under two accounts. Logout unregisters before Firebase sign-out and clears displayed notifications best-effort; if unregister fails, logout remains signed in with a connection/retry message. An uninstall, cleared app data or external Auth revocation can leave a registration until expiry or an immediate invalid-token response. Already queued OS notifications may still arrive after logout.

Allowlisted identifier-only taps wait for auth/account loading and the main navigator, match recipient UID and recheck server access. Transaction alerts open/highlight the transaction; linked views use `linked_{ownerUid}_{sourceAccountId}`. Invitations open Sharing. Missing/deleted or inaccessible records show unavailable states. Web uses a native-free stub, supports API mutations/preferences and has no browser push delivery.

## Rollout and migration

1. Configure the backend's credentials, existing database and mobile API URL. Deploy only when separately authorized. Keep preview/test data and credentials separate from production.
2. Prepare the fresh app/FCM/APNs setup and coordinate a mandatory update. Deploy `database.rules.json` to the existing RTDB instance with the correct Firebase project/database target before enabling required creation traffic. The CLI command is `npx firebase-tools deploy --only database --project <existing-project-id>`; confirm its database target if the project has multiple instances. The authorized production cutover above used the Admin SDK's `setRules` against the exact configured instance, with a prior-rules backup and readback verification.
3. Release following `releases.md`. Older clients' direct creation, personal link changes and invitation reissues are denied by strict rules; there is no bypass grace period. Reads and authorized existing edits/deletes/consent remain available, though old editor payloads touching protected fields can fail.

If a previous queue/scheduler version was deployed, disable its old queue consumers, cron jobs and external schedulers before cutover so it cannot retry historical pushes. This revision removes `/api/reconcile` and `/api/queues/push`. Existing operation records still prevent duplicate mutations; legacy outbox events are never resumed. Legacy `pushOutbox` data remains client-denied and must be archived/pruned by an authorized operator if present; do not rebuild or replay it. If no earlier server was deployed, no data migration is needed. Keep an API-compatible backend and strict rules for rollback; restoring broad client writes would silently bypass notifications.

## Validation and operations

```sh
npm run lint
npm run typecheck
cd notification-server
npm run lint
npm run typecheck
```

Lint and typecheck pass for the app and isolated backend. The Next.js backend cloud build and deployment completed, and an unauthenticated API request returned the expected JSON 401. Consult the release metadata for the authorized Android cloud build's outcome. Production RTDB rule deployment and exact readback are verified. Physical APK installation/upgrade with existing data, mobile web builds, authenticated ledger mutations, rule allow/deny behavior, real FCM/APNs delivery, notification tap states and logout races remain unverified. No tests or emulators were added/run, and no real pushes were sent. Dependency installation reported transitive audit advisories; security remediation was not performed in this scope.

Monitor save latency, root RTDB size/bandwidth, function failures and one-shot acceptance/failure/unknown/skip counts. Logs contain codes and event IDs, not tokens, contact identifiers, amounts, notes or credentials. Failed/unknown attempts are terminal; do not replay them automatically. When investigating, remember that no receipt evidence of provider/device delivery is collected.

[Expo's reliability guidance](https://docs.expo.dev/push-notifications/sending-notifications/) recommends retries and receipt checks; this minimal implementation deliberately omits them in exchange for simpler setup and accepts missed notifications. [Vercel Functions pricing](https://vercel.com/docs/functions/usage-and-pricing) still applies. [Hobby](https://vercel.com/docs/plans/hobby) is for personal, non-commercial use; [Pro](https://vercel.com/docs/plans/pro-plan) infrastructure credit is shared across resources. No workload measurements or free-delivery guarantees are made. No billing plan was changed.
