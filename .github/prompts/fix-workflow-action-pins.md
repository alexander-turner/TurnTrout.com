# Finish the GitHub Actions pin bumps under `.github/workflows/`

The weekly security scan (`security-vulnerability-scan.yaml`) applied these
bumps to `.github/actions/**` but **could not apply them to
`.github/workflows/**`**. Its `GITHUB_TOKEN` is a GitHub App installation
token without the `workflows` permission, so the push is rejected:

```text
! [remote rejected] refusing to allow a GitHub App to create or update
  workflow `.github/workflows/a11y.yml` without `workflows` permission
```

All four tokens in that job's environment (`GH_TOKEN`, `GITHUB_TOKEN`,
`DEFAULT_WORKFLOW_TOKEN`, `OVERRIDE_GITHUB_TOKEN`) are byte-identical, so the
job has no alternative credential. Until the permission gap is closed, the
scan can never subsume a dependabot `actions-all` PR, even though its own
prompt instructs it to.

## Unblock it first

Add `actions: write` to the `permissions:` block of
`.github/workflows/security-vulnerability-scan.yaml`, **or** pass
`secrets.PUSH_TOKEN` to the checkout and claude-code-action steps the way the
"Fetch GitHub security alerts" step already does. This file is itself a
workflow, so the scan cannot make this change on its own — a human or a
PUSH_TOKEN-authenticated run has to.

## Then apply these two mechanical rewrites

Both are confined to `uses:` lines under `.github/workflows/`. Nothing else
changes. `.github/actions/**` already has both applied, so the two trees
should agree afterwards.

### 1. Version bumps (subsumes the `actions-all` dependabot PR)

| Action | Old SHA | New SHA | New comment |
| --- | --- | --- | --- |
| `anthropics/claude-code-action` | `c038e4dcdedfbbca18dfb17df35a17e40ded4ddc` | `925afb53776cf1a2b738c6bdbed37b4d4000ef13` | `# v1.0.262` |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | `# v7.0.2` |
| `actions/download-artifact` | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | `# v8.0.2` |
| `astral-sh/setup-uv` | `c771a70e6277c0a99b617c7a806ffedaca235ff9` | `07a047e608db84b3d8c06cd9a7c7dcc9c355c18e` | `# v10.3.2` |

`setup-uv` is pinned at three different majors across the repo (`v7`,
`v8.2.0`, `v9.0.0`); collapse them all onto the single pin above. Two of its
call sites carry a stale comment — `c771a70e…` is labelled `# v7` in
`lint-and-validate.yaml` and `# v9.0.0` in `zizmor.yaml`.

`setup-uv` v10 disables caching for `pull_request_target`, `workflow_run` and
`release` when `enable-cache` is `auto`. No call site is reached from those
events, and `setup-base-env` / `setup-site` set `enable-cache: true`
explicitly, so caching behaviour does not change.

### 2. Version comments that drifted from their SHA

SHAs stay exactly as they are; only the trailing comment changes, so that a
reviewer reading a workflow sees the version actually being run.

| Action | SHA (unchanged) | Comment says | Should say |
| --- | --- | --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `# v6` | `# v7.0.1` |
| `actions/cache`, `actions/cache/restore` | `27d5ce7f107fe9357f9df03efb73ab90386fccae` | `# v5` | `# v5.0.5` |
| `actions/cache/save`, `actions/cache/restore` | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | `# v5` | `# v6.1.0` |
| `actions/setup-node` | `53b83947a5a98c8d113130e565377fae1a50d02f` | `# v6` | `# v6.3.0` |

Some `actions/checkout` lines carry a trailing `# zizmor: ignore[artipacked]`
rationale; keep it. `lint-and-validate.yaml` also echoes a `checkout` pin
inside the "Check for unpinned action references" help text — update that
string too.

## Verifying

```bash
uvx zizmor@1.25.2 --persona regular .github/
```

Must report no findings. Run it **online**: the `ref-version-mismatch` audit
resolves tags over the network, so the `--offline` invocation CI uses cannot
catch a wrong SHA or a drifted comment.

Resolve a tag to a commit with `gh api repos/<owner>/<repo>/commits/<tag> -q
.sha`. Do **not** use `gh api repos/<owner>/<repo>/git/ref/tags/<tag> -q
.object.sha` — for an annotated tag that returns the tag object's SHA, which
is not a valid `uses:` ref and fails at checkout time. `claude-code-action`
v1.0.262 is annotated, and this is exactly how its pin was first got wrong.
