# Vaultify notification server

Independent API-only Next.js application for Vercel Functions. Firebase Authentication and RTDB remain authoritative. Each new committed mutation makes one best-effort push attempt per eligible device; there are no retries, queues, cron jobs or receipt workers. Replaying a save confirms the mutation without sending again.

See [configuration, credentials, limitations and rollout](../docs/push-notifications.md).

```sh
npm install
npm run lint
npm run typecheck
npm run dev
```

Local development uses port 3000 and ignored `.env.local` containing Firebase Admin and Expo configuration. Vercel login/OIDC is not required locally. Use this directory as the deployment root with the Next.js preset. The locally installed CLI is `npx vercel`; the backend is deployed at https://vaultify-notification-server.vercel.app. See the deployment notes linked above for remaining mobile/rules setup.

A failed/interrupted attempt may lose the alert permanently while the ledger mutation remains committed. No Expo receipt polling is performed.

Vercel production uses `NODE_OPTIONS=--experimental-require-module` for the installed Firebase Admin dependency chain. This is required even when the cloud build succeeds. Local `.env*` and private keys are excluded from deployments by `.vercelignore`.
