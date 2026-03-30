# set-sync-docs

Interactive CLI to set up a GitHub Actions workflow that automatically syncs documentation from one repository to another.

Powered by [andstor/copycat-action](https://github.com/andstor/copycat-action).

## Quick Start

```bash
npx set-sync-docs
```

Run this inside any GitHub repository. The CLI will walk you through the configuration and generate a `.github/workflows/sync-docs.yml` file.

## What It Does

1. **Detects** the current git repo (owner, name, branch) from your remote URL
2. **Asks** you to configure source path, target repo, target path, and branches
3. **Validates** the target repo exists (via `gh` CLI, if available)
4. **Generates** a GitHub Actions workflow that syncs docs on every push
5. **Reminds** you to set up the required Personal Access Token

## Example

```
$ npx set-sync-docs

🔄 set-sync-docs — Configure docs sync workflow

Detected repo: myorg/my-app (main)

? Source docs path (relative to repo root) docs/
? Source branch main
? Target repo owner myorg
? Target repo name wiki
? Target path (files will be copied here) docs/my-app/
? Target branch main
? Clean target directory before sync? Yes

Configuration summary:
  Source path:   docs/
  Source branch: main
  Target repo:   myorg/wiki
  Target path:   docs/my-app/
  Target branch: main
  Clean target:  yes

? Generate workflow file? Yes

✅ Written to /path/to/my-app/.github/workflows/sync-docs.yml

Next: set up a Personal Access Token:

  1. Create a PAT with repo scope:
     https://github.com/settings/tokens/new

  2. Add the PAT as a secret on the source repo (where the workflow runs):
     gh secret set PAT_SYNC_REPO_DOCS_TO_WIKI
```

## Generated Workflow

The tool generates a workflow like this:

```yaml
name: Sync Repo Docs to Wiki

on:
  push:
    branches: ["main"]
    paths:
      - "docs/**"
  workflow_dispatch:

jobs:
  copy-docs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source repo
        uses: actions/checkout@v4

      - name: Copy docs to target repo
        uses: andstor/copycat-action@v3
        with:
          personal_token: ${{ secrets.PAT_SYNC_REPO_DOCS_TO_WIKI }}
          src_path: "/docs/."
          dst_path: "/docs/my-app/"
          dst_owner: "myorg"
          dst_repo_name: "wiki"
          dst_branch: "main"
          src_branch: "main"
          clean: true
          commit_message: "docs: sync from source repo @ ${{ github.sha }}"
```

## PAT Setup

The workflow needs a Personal Access Token to push to the target repo:

1. Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Create a token with **repo** scope
3. Add it as a repository secret named `PAT_SYNC_REPO_DOCS_TO_WIKI`:
   ```bash
   gh secret set PAT_SYNC_REPO_DOCS_TO_WIKI
   ```

The secret must be added to the **source** repository (where the workflow runs), not the target.

## Requirements

- Node.js >= 20
- Must be run inside a git repository
- [GitHub CLI](https://cli.github.com/) (`gh`) is optional but recommended for target repo validation

## License

MIT
