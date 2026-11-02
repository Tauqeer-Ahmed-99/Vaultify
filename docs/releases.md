# Releases

Current deployed version: **2.0.0**. Update this after publishing a new stable release. Full changelogs and build metadata live in [GitHub Releases](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases).

## Release instructions

1. Choose `MAJOR.MINOR.PATCH`: patch for fixes, minor for backward-compatible features, major for breaking changes; reset lower components on minor/major bumps. Bump for a release, not each commit. Keep `app.json` → `expo.version`, `package.json` → `version`, and the root version fields in `package-lock.json` identical. Use `npm version <version> --no-git-tag-version` for the package and lockfile, then update `app.json`.
2. Tags are exactly `MAJOR.MINOR.PATCH` (for example, `1.0.1`, without a `v` prefix), continuing the existing `1.0.0` convention. Never move or reuse a published tag. Use a new version for a replacement release.
3. EAS uses remote build versions (`cli.appVersionSource: "remote"`); production currently has no `autoIncrement`. Before **every** Android build, run `npx eas-cli@latest build:version:get --platform android --profile production`, then `npx eas-cli@latest build:version:set --platform android --profile production` and set an integer `versionCode` greater than all previously used codes. Editing local `android.versionCode` does not update the remote value. For iOS releases, also advance the remote `buildNumber` using the same commands with `--platform ios`.
4. Run `npx expo lint` and `npx tsc --noEmit`. Commit the release changes; build from a clean checkout. Run `npx eas-cli@latest build --platform android --profile production` (already configured for APK). Verify the successful EAS build's commit matches the release commit, its app version/build code are correct, and the signed APK installs and upgrades the deployed app with its data intact. Use the existing Android signing key.
5. Download that exact build's APK into ignored `dist/`. Name it `Name_MAJOR_MINOR_PATCH.apk`, e.g. `Vaultify_1_0_1.apk` (use the `.apk` extension). Do not commit binaries. Write the full changelog to ignored `dist/release-notes.md`: summarize Added/Changed/Fixed/Breaking changes as applicable from `git log <previous-tag>..<release-commit>`, excluding unreleased work. Include version/tag, UTC release date/time (ISO 8601), full commit SHA, EAS build ID/link, Android versionCode, APK filename and SHA-256, known issues/migration steps, and a GitHub compare link between the previous and new tags. Record unavailable historical metadata as unknown rather than inventing it.
6. Create and push the tag at the exact built commit, then use **GitHub CLI** to create the release with its changelog and APK attached. The PowerShell example below assumes the current commit is the verified build commit; replace the example version and prepare the APK/notes first. Stop on any failed command.

```powershell
$version = '1.0.1'
$releaseCommit = git rev-parse HEAD
$apk = "dist/Vaultify_$($version.Replace('.', '_')).apk"
Get-FileHash -LiteralPath $apk -Algorithm SHA256
git tag -a $version $releaseCommit -m "Vaultify $version"
git push origin HEAD
git push origin "refs/tags/$version"
gh release create $version $apk --verify-tag --title "Vaultify $version" --notes-file dist/release-notes.md --latest
gh release view $version --json tagName,publishedAt,url,assets,body
```

7. Verify the published tag, changelog, and downloadable APK. Use the actual `publishedAt` returned above for the final UTC release timestamp in the GitHub notes and local history. Correct notes with `gh release edit <tag> --notes-file dist/release-notes.md`; attach a missing APK with `gh release upload <tag> <apk-path>`. Do not replace an already published binary. For prereleases, use a matching SemVer suffix in the app version/tag, pass `--prerelease --latest=false` instead of `--latest`, and leave the stable deployed-version marker unchanged.
8. After publication, update the deployed-version marker and prepend **only one linked version heading with its UTC publication date/time** under Release history. Keep changelog bullets and build metadata on GitHub to limit repository context. Commit the index update separately; never retag the already built commit.

References: [Expo version management](https://docs.expo.dev/build-reference/app-versions/), [APK builds](https://docs.expo.dev/build-reference/apk/), [EAS CLI](https://docs.expo.dev/eas/cli/), [gh release create](https://cli.github.com/manual/gh_release_create), [gh release edit](https://cli.github.com/manual/gh_release_edit), [gh release upload](https://cli.github.com/manual/gh_release_upload).

## Release history

### [2.0.0](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases/tag/2.0.0) | 2026-11-02T10:34:57Z

### [1.0.0](https://github.com/Tauqeer-Ahmed-99/Vaultify/releases/tag/1.0.0) | 2026-10-04T13:42:36Z
