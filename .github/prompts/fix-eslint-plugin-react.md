# Fix eslint-plugin-react compatibility with eslint 10

## Context

`eslint-plugin-react` (and often `eslint-plugin-jsx-a11y`) crash on eslint 10 because they
call `context.getFilename()` / `contextOrFilename.getFilename()` — methods removed in
eslint 10 in favor of `context.filename`. The repro is:

```text
TypeError: Error while loading rule 'react/display-name':
  contextOrFilename.getFilename is not a function
  at resolveBasedir (node_modules/.../eslint-plugin-react/lib/util/version.js:31)
```

This blocks us from taking the eslint 10 dependabot group bump. The dependabot
config in `.github/dependabot.yml` temporarily ignores `eslint` and `@eslint/js`
at `>=10` to keep the lockfile stable.

## Your task

Resolve the incompatibility so that eslint 10.x lints cleanly. Try each
option below in order; stop at the first one that succeeds.

### Option 1 — Wait for an upstream release

1. Check latest versions:
   - `pnpm view eslint-plugin-react version`
   - `pnpm view eslint-plugin-react peerDependencies.eslint`
   - `pnpm view eslint-plugin-jsx-a11y version`
   - `pnpm view eslint-plugin-jsx-a11y peerDependencies.eslint`
2. Also scan the plugins' repos / changelogs for an `eslint@^10` entry in
   `peerDependencies`. If a compatible release exists, bump the plugin in
   `package.json`, run `pnpm install`, and remove the eslint ignore block
   from `.github/dependabot.yml` (both `eslint` and `@eslint/js`).

### Option 2 — Apply a patch via `patch-package`

If no upstream release is ready but the fix is mechanical (swap
`context.getFilename()` → `context.filename ?? context.getFilename()`), use
`patch-package`:

1. `pnpm add -D patch-package` (already present — see `postinstall`).
2. Edit the offending file under `node_modules/eslint-plugin-react/lib/util/`
   to fall back to `.filename` when `.getFilename` is unavailable.
3. `pnpm exec patch-package eslint-plugin-react`.
4. Commit the generated `patches/eslint-plugin-react+<ver>.patch`.
5. Verify with `pnpm exec eslint -c config/javascript/eslint.config.js
   --no-warn-ignored quartz/build.ts` (should exit 0).
6. Repeat for `eslint-plugin-jsx-a11y` if it breaks too.

### Option 3 — Replace the plugin

If both options above fail, evaluate alternatives:

- Drop `eslint-plugin-react` if the rules it enforces are already covered by
  `typescript-eslint` + `eslint-plugin-react-hooks` (we use Preact, not React,
  so most `react/*` rules are low value here).
- Remove `eslint-plugin-jsx-a11y` or swap for an actively maintained fork.

Adjust `config/javascript/eslint.config.js` accordingly, run `pnpm check` and
`pnpm test` to confirm nothing regresses, and delete the plugin from
`package.json`.

## Validation

Regardless of which option succeeds, finish with:

```bash
pnpm install
pnpm check
pnpm exec eslint -c config/javascript/eslint.config.js --no-warn-ignored .
pnpm test
```

All must pass. Then remove the `eslint` / `@eslint/js` `>=10` ignore entries
from `.github/dependabot.yml` and commit.

## PR

Open a PR titled `chore(deps): unblock eslint 10 upgrade` summarizing which
option you took and linking the upstream issue (if any). If you went with
Option 2, call out that the patch is temporary and should be removed once
upstream ships a fix.
