# OTA updates

Vaultify uses EAS Update for JavaScript and bundled asset changes on Android and iOS. The app checks on cold launch, downloads a compatible update in the background, and uses it on the next restart. Startup uses the cached or embedded bundle without waiting for the network. An update never forces a restart during a ledger entry.

## First rollout

The published 2.0.1 APK predates this setup and cannot receive OTA updates. Version 2.1.0 is the first native release containing `expo-updates` and this configuration. Install its APK over the existing app without uninstalling to enable future compatible production updates. Native releases follow [releases.md](releases.md); web deployments remain separate.

The `preview` and `production` EAS build profiles embed their respective update channels. Each channel points to an EAS branch with the same name. Development builds continue using Metro; use a preview release build to test automatic update delivery.

## Compatibility and environment

`runtimeVersion` uses Expo's `appVersion` policy: updates can run only on builds with the same `expo.version` and platform. Keep the app version unchanged for an OTA targeting an installed build. Before changing native dependencies, Expo SDK, config plugins, permissions, identifiers, icons, splash screens, or other native configuration, bump the app version and distribute a new native build using the release instructions. Never publish native-dependent JavaScript to an older runtime. Native Android versionCode and iOS buildNumber changes alone do not change this runtime.

Builds and updates must use the same EAS environment. The npm scripts select both channel and environment explicitly, as required by SDK 57. EAS Update uses the selected server environment rather than local `.env` files or `eas.json` build-profile `env` values. Configure all `EXPO_PUBLIC_FIREBASE_*` variables referenced by `firebaseConfig.ts` and `EXPO_PUBLIC_NOTIFICATION_API_URL` as plain text or sensitive variables in each environment before using it. Secret variables, including the build-only `GOOGLE_SERVICES_JSON` file, are unavailable to updates. Never put backend credentials in `EXPO_PUBLIC_*` variables.

At setup, the production environment contains all seven required public variable names and the native-build Google services file variable. The preview environment has none of these configured; supply its Firebase/API values and native-build Google services file before creating a preview build or publishing to preview.

OTA changes must remain compatible with the deployed notification API, database rules, and stored user data. A bundle rollback cannot undo server changes or data migrations.

## Publish and verify

Run from a clean, committed checkout with the version of the installed build you intend to update:

```sh
npm run lint
npm run typecheck
npm run update:preview -- --message "Describe the change"
```

Install a matching preview build first. Force close and reopen it online, allow the update to download, then force close and reopen again. Confirm the visible change, login, ledger saves, navigation, and offline startup. Check the EAS dashboard for the expected channel, platform, runtime, commit, and update group. Expo Go and Metro sessions do not verify release update delivery.

When the same change is ready for production, publish from that committed checkout:

```sh
npm run update:production -- --message "Describe the change"
```

The production bundle is exported again with production environment values. Retain its EAS update group/link, commit, runtime version, and message in the deployment record. GitHub APK releases and their version history still follow [releases.md](releases.md).

## Rollback

```sh
npx eas-cli@latest update:rollback
```

Select the affected channel/runtime and either a known-good previous update or the embedded bundle. Verify on a matching release build using the same restart cycle. Keep the backend and stored data compatible with the selected bundle.

References: [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/), [SDK 57 update behavior](https://docs.expo.dev/versions/v57.0.0/sdk/updates/), [deployment and runtime policy](https://docs.expo.dev/eas-update/deployment/), [EAS environments](https://docs.expo.dev/eas/environment-variables/usage/), [rollbacks](https://docs.expo.dev/eas-update/rollbacks/).

Setup validation passed lint, typecheck, Expo dependency compatibility, and native configuration introspection for Android and iOS. Both remote channels are active and point to their matching branches. No native build or OTA bundle was published during setup; device delivery remains to be verified after the first native rollout.
