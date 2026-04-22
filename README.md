# set-docsync

Sync documentation between GitHub repositories. One action for **push** (on commit), **pull** (on schedule), or **both** in a single workflow — with multi-repo targets, optional deduplication, and incremental SHA-based pulls.

## Quick Start (Action)

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

Set both `targets` (push) and `sources` (pull) for combined mode. Event-aware: `push` events run push; `schedule` runs pull; `workflow_dispatch` runs whatever is configured.

## Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `token` | yes | — | PAT with `repo` scope for cross-repo git and `gh api` access |
| `sources` | no | `''` | Pull sources, one per line: `owner/repo[:src_path[:dst_path]][@branch]` |
| `targets` | no | `''` | Push targets, one per line: `owner/repo[:dst_path][@branch]` |
| `src-path` | no | `docs/` | Source docs path in this repo (push only) |
| `dedup` | no | `'false'` | Replace byte-identical files with relative symlinks |
| `clean` | no | `'true'` | Clean each target's `dst_path` before syncing (push only; preserves `.git`) |
| `state-path` | no | `.github/docsync.json` | Path to the state file tracking last-synced SHAs |

## How it works

- **Push**: checks out each target repo, rsyncs `src-path/` contents into the target's `dst_path`, commits, pushes. Respects `clean` (removes existing files except `.git`).
- **Pull**: for each source, compares the source's HEAD SHA against `sourceSHAs` in the state file. If unchanged, skips clone entirely. Otherwise does a shallow sparse checkout, rsyncs into the destination, and updates the state SHA.
- **Dedup** (optional): after sync, scans the target directory (push) or all pull destinations (pull) for byte-identical files. Replaces duplicates with relative symlinks to the lexicographically first occurrence. Idempotent across runs.

## PAT Setup

1. Create a PAT with `repo` scope at [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Add it to the repo where the workflow runs:
   ```bash
   gh secret set PAT_DOCSYNC
   ```

## CLI (optional)

The npm package generates the workflow interactively — useful if you want a starter config. The generated workflow is a 15-line wrapper that calls this Action, so updates roll forward automatically via the floating `@v2` tag.

```bash
# Interactive
npx set-docsync

# Non-interactive push
npx set-docsync push --src docs/ --to org/wiki:docs/website/@main

# Non-interactive pull
npx set-docsync pull --from org/website:docs/:docs/website/@main

# Multiple targets
npx set-docsync push --src docs/ --to org/wiki:docs/web/ --to org/docs:api/
```

CLI options:

```
  --src <path>        Source docs path (default: docs/)
  --branch <branch>   Source/commit branch (default: main)
  --to <target>       Push target — owner/repo[:dst_path][@branch]  (repeatable)
  --from <source>     Pull source — owner/repo[:src_path[:dst_path]][@branch]  (repeatable)
  --no-clean          Don't clean target directory before push
  --dedup             Enable dedup
```

The CLI is in maintenance mode — bug fixes only. New features land in the Action.

## Requirements

- `ubuntu-latest` runner (Linux-only; symlinks via dedup rely on POSIX)
- Node.js >= 20 (for CLI)
- Repo with the secret `PAT_DOCSYNC`

## Versioning

- Action: pin `@v2` for rolling updates, or `@v2.0.0` for exact. The floating `v2` tag is moved forward on each v2.x.y release.
- npm (CLI): standard semver, `set-docsync@2.x`.

## License

MIT
