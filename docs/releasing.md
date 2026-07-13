# Releasing Singularity

Singularity uses annotated Git tags and GitHub Releases. Release artifacts are currently source-only; desktop packaging is not implemented.

## Prepare

1. Confirm `main` is clean and synchronized with `origin/main`.
2. Update `package.json` version and move release notes from `CHANGELOG.md`'s Unreleased section.
3. Run the complete checklist in `docs/11-release-checklist.md`.
4. Push the release commit and wait for GitHub Actions to pass.

## Tag and publish

```powershell
$version = "v0.1.0"
git tag -a $version -m "Singularity $version"
git push origin $version
gh release create $version --title "Singularity $version" --notes-file CHANGELOG.md
```

For later releases, use a release-specific notes file instead of the full changelog. Never retag a published version; fix forward with a patch release.

## Verify reproduction

Clone the tag into a clean directory, run the frozen install, execute all verification commands, run `corepack pnpm demo`, and confirm the cited bundled source is visible. Verify the tag commit matches the GitHub Release target and no `.future`, environment, report, log, or secret file is present in the source archive.
