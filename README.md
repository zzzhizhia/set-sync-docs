# set-docsync

Sync documentation between GitHub repositories. One action handles **push** (on commit), **pull** (on schedule), or **both** in a single workflow. Multi-repo targets, incremental SHA-based pulls, optional cross-source deduplication.

## Table of contents

- [Quick start](#quick-start)
- [Inputs](#inputs)
- [sources / targets syntax](#sources--targets-syntax)
- [Event matrix](#event-matrix)
- [Scenarios](#scenarios)
  - [Push to one or more target repos](#push-to-one-or-more-target-repos)
  - [Pull multiple sources into a hub](#pull-multiple-sources-into-a-hub)
  - [Combined push + pull in one workflow](#combined-push--pull-in-one-workflow)
  - [Whole-repo sync (wikis and similar)](#whole-repo-sync-wikis-and-similar)
- [State file](#state-file)
- [Dedup semantics](#dedup-semantics)
- [PAT setup](#pat-setup)
- [CLI (optional)](#cli-optional)
- [Troubleshooting](#troubleshooting)
- [Migration from v1](#migration-from-v1)
- [Requirements](#requirements)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [License](#license)

## Quick start

```yaml
name: Sync Docs

on:
  push:
    branches: [main]
    paths: ['docs/**']
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
      - uses: zzzhizhia/set-docsync@v2
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          src-path: docs/
          targets: |
            org/wiki:docs/website/@main
          sources: |
            org/api:docs/:docs/api/@main
          dedup: 'true'
```

Only setting `targets` runs push; only setting `sources` runs pull; both set runs both (gated by event type, see [Event matrix](#event-matrix)).

## Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `token` | yes | — | PAT with `repo` scope for cross-repo git and `gh api` access |
| `sources` | no | `''` | Pull sources, one per line |
| `targets` | no | `''` | Push targets, one per line |
| `src-path` | no | `docs/` | Source docs path in this repo (push only) |
| `dedup` | no | `'false'` | Replace byte-identical files with relative symlinks |
| `clean` | no | `'true'` | Clean each target's `dst_path` before syncing (push only; preserves `.git`) |
| `state-path` | no | `.github/docsync.json` | Where last-synced SHAs are stored |

## sources / targets syntax

Both inputs are multiline strings, one entry per line. Blank lines are ignored.

**Push targets** — where to send `src-path` contents:

```
owner/repo[:dst_path][@branch]
```

| Part | Default | Example |
|------|---------|---------|
| `owner/repo` | required | `org/wiki` |
| `:dst_path` | `/` (repo root) | `:docs/website/` |
| `@branch` | `main` | `@main` |

Examples:
- `org/wiki` — push to repo root of `org/wiki`, branch `main`
- `org/wiki:docs/site/` — push under `docs/site/` in `org/wiki`, `main`
- `org/wiki@staging` — push to repo root, `staging` branch
- `org/wiki:docs/site/@staging` — everything specified

**Pull sources** — where to fetch docs from:

```
owner/repo[:src_path[:dst_path]][@branch]
```

| Part | Default | Example |
|------|---------|---------|
| `owner/repo` | required | `org/api` |
| `:src_path` | `docs/` | `:docs/`, `:/` (whole repo) |
| `:dst_path` | `docs/<repo>/` | `:docs/api/` |
| `@branch` | `main` | `@master` |

Examples:
- `org/api` — sync `org/api`'s `docs/` into this repo's `docs/api/`
- `org/api:guides/:docs/guides/@develop` — sync `org/api@develop`'s `guides/` into this repo's `docs/guides/`
- `org/wiki:/:raw/wiki/@master` — sync the **whole** `org/wiki@master` repo into `raw/wiki/`

Use `:/` explicitly for whole-repo syncs (wikis). An empty `src_path` segment would default to `docs/` and silently narrow the sync; `/` round-trips cleanly.

## Event matrix

The Action inspects `GITHUB_EVENT_NAME` and runs only what makes sense:

| Event | `targets` set | `sources` set | Both set |
|-------|---------------|---------------|----------|
| `push` | runs push | no-op | push only |
| `schedule` | no-op | runs pull | pull only |
| `workflow_dispatch` | runs push | runs pull | runs both |

That is: push events never trigger pull, schedule never triggers push, and manual `workflow_dispatch` does whatever is configured. Use this to keep one workflow file even when the same repo is both a source and a hub.

## Scenarios

### Push to one or more target repos

Real-time sync: every commit to `main` that touches `docs/**` fans out to one or more target repos.

```yaml
on:
  push:
    branches: [main]
    paths: ['docs/**']
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { token: "${{ secrets.PAT_DOCSYNC }}" }
      - uses: zzzhizhia/set-docsync@v2
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          src-path: docs/
          targets: |
            org1/wiki:docs/web/@main
            org2/docs:api/@main
```

### Pull multiple sources into a hub

Aggregator pattern: one hub repo pulls docs from N source repos on a schedule. SHA-based skipping means unchanged sources add near-zero cost per run.

```yaml
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          ref: main
      - uses: zzzhizhia/set-docsync@v2
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          sources: |
            org/api:docs/:docs/api/@main
            org/cli:docs/:docs/cli/@main
            org/wiki:/:raw/wiki/@master
          dedup: 'true'
```

### Combined push + pull in one workflow

A repo that is both a source (publishes its own docs) and a hub (aggregates others'). One Action invocation covers both. Note the conditional `ref`: push events check out the pushed commit (so `runPush` reads the latest `docs/`); schedule/dispatch check out the hub branch.

```yaml
on:
  push:
    branches: [main]
    paths: ['docs/**']
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          ref: ${{ github.event_name == 'push' && github.ref_name || 'docs-hub' }}
      - uses: zzzhizhia/set-docsync@v2
        with:
          token: ${{ secrets.PAT_DOCSYNC }}
          src-path: docs/
          targets: |
            org/mirror:docs/@main
          sources: |
            org/api:docs/:docs/api/@main
```

### Whole-repo sync (wikis and similar)

GitHub wiki repos live as a separate git repo (`<repo>.wiki.git`) where everything of interest is at the root. Use `:/` as the src_path:

```yaml
sources: |
  org/wiki:/:raw/wiki/@master
```

Resulting dst contains everything that was at the source repo's root (minus `.git`).

## State file

The Action reads and writes `.github/docsync.json` (override with `state-path`). Shape:

```json
{
  "sourceSHAs": {
    "org/api@main": "abc123...",
    "org/wiki@master": "def456..."
  }
}
```

- **When read**: before each pull source, to decide whether to skip clone
- **When written**: after each changed source, and once at the end of the pull pass
- **Not needed for push**: only pull uses this

**CLI compatibility**: if you also use the npx CLI to (re)generate the workflow, the CLI writes its config to the same file. The CLI preserves `sourceSHAs` across rewrites, so reconfiguring does not trigger a full re-sync.

**How to force a full re-sync**: remove the relevant keys from `sourceSHAs` (or delete the file), commit, and dispatch the workflow.

## Dedup semantics

`dedup: 'true'` replaces byte-identical **regular files** with **relative symlinks** pointing to one canonical copy. Useful for aggregator hubs where many source wikis share identical assets (license files, CI templates, boilerplate).

**Canonical pick**: lexicographically first path wins. Stable across runs, so re-runs produce the same symlink direction (no diff noise).

**What counts as identical**: full `sha256` of file contents. Filename, size, and mtime are not consulted.

**Scope**:
- Push: within each target's `dst_path` after rsync
- Pull: across all pull destinations at once, after the last source is synced

**Skipped when**: in pull mode, every source's SHA matched the stored state (nothing could have changed). Saves a hub-wide walk+hash per idle cron run.

**Idempotent**: re-running on an already-deduped tree is a no-op. Broken symlinks left over from prior runs (e.g. canonical was deleted in source) are cleaned up before the scan.

**Linux-only**: the generated symlinks have no portable fallback. Workflows must run on `ubuntu-latest` (or another Linux runner).

## PAT setup

1. Create a PAT with `repo` scope at [github.com/settings/tokens/new](https://github.com/settings/tokens/new). A fine-grained PAT with read+write to the relevant repos also works.
2. Add it as a secret to **the repo where the workflow runs** (not every source repo):
   ```bash
   gh secret set PAT_DOCSYNC
   ```
3. The Action passes this token to `git clone`, `git push`, and `gh api` calls for both the hub repo and any cross-repo source/target.

The default `GITHUB_TOKEN` is not used: it has no access to repos beyond the current one, and new repos default it to read-only.

## CLI (optional)

The `set-docsync` npm package generates the workflow for you. It produces a thin wrapper that `uses: zzzhizhia/set-docsync@v2`, so bug fixes and new Action features propagate without re-running the CLI.

```bash
# Interactive
npx set-docsync

# Push, one-shot
npx set-docsync push --src docs/ --to org/wiki:docs/website/@main

# Pull, one-shot
npx set-docsync pull --from org/website:docs/:docs/website/@main

# Multiple targets
npx set-docsync push --to org/wiki:docs/web/ --to org/docs:api/
```

Flags:

```
--src <path>        Source docs path (default: docs/)
--branch <branch>   Source/commit branch (default: main)
--to <target>       Push target — owner/repo[:dst_path][@branch] (repeatable)
--from <source>     Pull source — owner/repo[:src_path[:dst_path]][@branch] (repeatable)
--no-clean          Don't clean target directory before push
--dedup             Enable dedup
```

The CLI is in maintenance mode. New features land in the Action.

## Troubleshooting

**`remote: Write access to repository not granted` / 403 on push**
Your PAT is missing `repo` scope, or the secret is named something other than `PAT_DOCSYNC` (the Action reads `token` from the input — make sure your workflow passes `${{ secrets.PAT_DOCSYNC }}`).

**`warning: adding embedded git repository` and mode `160000` entries**
Something is placing a source repo's `.git` directory inside the hub working tree. This Action uses `rsync --exclude '.git'` to prevent it. If you see this, check whether another step is doing its own clone into the hub.

**Pull run reports `Unchanged` but the source really did change**
The state file's SHA is stale or the wrong branch is being checked. Inspect `.github/docsync.json`, compare against `gh api repos/OWNER/REPO/commits/BRANCH --jq .sha`, and if they match but the source still looks wrong, delete the relevant key from `sourceSHAs` to force a resync.

**`docs: pull from source repos @ ...` empty commits**
Should not happen — the Action checks `git diff --cached --quiet` before committing. If you see them, please file an issue with the run log.

**Files disappeared from the hub after enabling the Action**
Most likely cause: your sources changed and rsync `--delete` removed files that existed in the hub but not in source. This is by design. If the disappearance seems wrong, verify the source actually has the files at the expected path (`gh api repos/OWNER/REPO/contents/PATH`).

**`git clone --sparse` with empty src_path materialized only root files**
Fixed in v2.0.3; upgrade your pin. If you were on `@v2` the floating tag has already rolled forward.

## Migration from v1

v2 is a breaking change. What to update:

| v1 | v2 |
|----|----|
| `mode: push \| pull \| both` in config | Removed. Inferred from whether `targets`/`sources` are set |
| `PushTarget.dedup` (per-target) | Single global `dedup` input |
| `PushTarget.clean` (per-target) | Single global `clean` input |
| Generated workflow expands to ~100 lines of shell | Generated workflow is ~15 lines; invokes `zzzhizhia/set-docsync@v2` |

If you were using the v1 CLI: re-run `npx set-docsync` once. It reads the old config shape, collects the new globals (asking only when needed), and emits the v2 workflow.

## Requirements

- `ubuntu-latest` runner (or another Linux runner with `bash`, `rsync`, `git`, `jq`, `gh`)
- Secret `PAT_DOCSYNC` with `repo` scope on the repo that runs the workflow
- For the CLI: Node.js >= 20

## Versioning

- **Action**: pin `@v2` for automatic patch / minor updates, or `@v2.x.y` for exact. The `v2` tag is force-moved to the latest `v2.x.y` on each release.
- **npm CLI**: standard semver. Published as `set-docsync` on the public registry.

Releases are tagged `vX.Y.Z`; a major-floating tag (`vX`) is maintained alongside.

## Contributing

```bash
pnpm install
pnpm test
pnpm build   # rebuilds dist/cli.mjs and dist/action/index.cjs
```

The Action bundle `dist/action/index.cjs` must be committed — Action users load it directly from the repo at the pinned tag. CI verifies it is up to date with `src/` on every push/PR.

Release flow:

```bash
pnpm build
git add dist/action package.json
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main vX.Y.Z
```

The publish workflow handles npm publish and the floating major tag automatically.

## License

MIT
