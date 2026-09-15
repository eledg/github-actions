# github-actions

Shared composite GitHub Actions used across eledg projects.

## Actions

### `setup-pnpm`

Installs Node.js 24, pnpm, restores the pnpm store cache, caches the Turborepo local cache, and installs dependencies.

```yaml
- uses: eledg/github-actions/setup-pnpm@v1
  with:
    enable-turbo-cache: "true" # enable for jobs that run turbo tasks
```

| Input                | Required | Default | Description                                                                               |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `enable-turbo-cache` | No       | `false` | Cache the `.turbo` directory between runs. Set to `'true'` for jobs that run turbo tasks. |

---

### `deploy-vercel`

Deploys a Vercel project to preview or production.

```yaml
- uses: eledg/github-actions/deploy-vercel@v1
  with:
    production: true
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

| Input               | Required | Default | Description                     |
| ------------------- | -------- | ------- | ------------------------------- |
| `production`        | No       | `false` | Deploy to production (`--prod`) |
| `vercel-org-id`     | Yes      | —       | Vercel organisation ID          |
| `vercel-project-id` | Yes      | —       | Vercel project ID               |
| `vercel-token`      | Yes      | —       | Vercel auth token               |

---

### `check-coverage`

Runs `pnpm coverage` and uploads results to Codecov.

```yaml
- uses: eledg/github-actions/check-coverage@v1
  with:
    codecov-token: ${{ secrets.CODECOV_TOKEN }}
```

| Input           | Required | Description          |
| --------------- | -------- | -------------------- |
| `codecov-token` | Yes      | Codecov upload token |

---

### `filter-changes`

Outputs a boolean indicating whether any of the specified paths were modified in the current push or PR. Requires the repo to be checked out with `fetch-depth: 0`.

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0
- id: set-result
  uses: eledg/github-actions/filter-changes@v1
  with:
    paths: apps/ui,packages/shared
```

| Input   | Required | Description                            |
| ------- | -------- | -------------------------------------- |
| `paths` | Yes      | Comma-separated list of paths to watch |

| Output   | Description                                             |
| -------- | ------------------------------------------------------- |
| `result` | `true` if any matching files changed, otherwise `false` |

---

### `cdk-synth`

Assumes an AWS IAM role via OIDC and runs `pnpm --filter <filter> synth -- -c <context-key>=<env-name>`. Any app-specific environment variables (e.g. secrets passed to the CDK app) should be set at the calling job level.

```yaml
- uses: eledg/github-actions/cdk-synth@v1
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsOIDCRole-eu-west-1
    env-name: staging
    # filter: cdk        # override if your CDK workspace is not named 'infra'
    # context-key: env   # override if your CDK app uses a different context key
```

| Input            | Required | Default     | Description                                               |
| ---------------- | -------- | ----------- | --------------------------------------------------------- |
| `role-to-assume` | Yes      | —           | IAM role ARN to assume via OIDC                           |
| `env-name`       | Yes      | —           | CDK context value passed as `-c <context-key>=<env-name>` |
| `aws-region`     | No       | `eu-west-1` | AWS region                                                |
| `filter`         | No       | `infra`     | pnpm workspace filter for the CDK app                     |
| `context-key`    | No       | `envName`   | CDK context key passed via `-c KEY=value`                 |

Requires `id-token: write` permission on the calling job.

---

### `cdk-diff`

Assumes an AWS IAM role via OIDC and runs `pnpm --filter <filter> diff -- -c <context-key>=<env-name>`. On pull requests, posts the diff as a comment. Any app-specific environment variables should be set at the calling job level.

```yaml
- uses: eledg/github-actions/cdk-diff@v1
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsOIDCRole-eu-west-1
    env-name: prod
    # filter: cdk        # override if your CDK workspace is not named 'infra'
    # context-key: env   # override if your CDK app uses a different context key
```

| Input            | Required | Default     | Description                                               |
| ---------------- | -------- | ----------- | --------------------------------------------------------- |
| `role-to-assume` | Yes      | —           | IAM role ARN to assume via OIDC                           |
| `env-name`       | Yes      | —           | CDK context value passed as `-c <context-key>=<env-name>` |
| `aws-region`     | No       | `eu-west-1` | AWS region                                                |
| `filter`         | No       | `infra`     | pnpm workspace filter for the CDK app                     |
| `context-key`    | No       | `envName`   | CDK context key passed via `-c KEY=value`                 |

Requires `id-token: write` and `pull-requests: write` permissions on the calling job.

---

### `check-action-dependencies`

Scans composite `action.yml` files for outdated action dependencies and opens a PR with major-version updates. Dependabot covers `.github/workflows/` files but not composite action files — this fills that gap.

Add a scheduled workflow to any repo that uses composite actions:

```yaml
name: Check Action Dependencies

on:
  schedule:
    - cron: "0 3 * * 5" # Every Friday at 3am UTC
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: eledg/github-actions/check-action-dependencies@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

| Input          | Required | Description                                                          |
| -------------- | -------- | -------------------------------------------------------------------- |
| `github-token` | Yes      | GitHub token — pass `secrets.GITHUB_TOKEN` from the calling workflow |

Requires `contents: write` and `pull-requests: write` permissions on the calling workflow. If updates are found, the action commits the changes to a `deps/action-updates` branch and opens a PR. If a PR from a previous run is still open, it force-pushes to that branch instead of opening a duplicate.

---

### `update-pnpm`

Checks for a newer pnpm version on npm and opens a PR to update the `packageManager` field in `package.json` and regenerate the lockfile. No-ops if already on the latest version.

```yaml
- uses: actions/checkout@v7
- uses: eledg/github-actions/update-pnpm@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    reviewers: your-github-username
    assignees: your-github-username
```

| Input          | Required | Default | Description                                                    |
| -------------- | -------- | ------- | -------------------------------------------------------------- |
| `github-token` | Yes      | —       | GitHub token with `contents: write` and `pull-requests: write` |
| `reviewers`    | No       | `''`    | Comma or newline separated list of pull request reviewers      |
| `assignees`    | No       | `''`    | Comma or newline separated list of pull request assignees      |
| `labels`       | No       | `build` | Labels to apply to the pull request                            |

Requires `contents: write` and `pull-requests: write` permissions on the calling workflow.

> **Note:** PRs created with `secrets.GITHUB_TOKEN` will not trigger `pull_request` workflows in the consuming repo — this is a GitHub limitation to prevent recursive runs. If you need the opened PR to run your CI, pass a PAT instead:
>
> ```yaml
> github-token: ${{ secrets.PAT_TOKEN }}
> ```
>
> The PAT needs `contents: write` and `pull-requests: write` scopes. When a PAT is used, GitHub treats the PR as user-initiated and `pull_request` fires normally.

---

### `review-dependency-update`

Posts a comment asking Claude to review a dependency update — one package or a grouped multi-package bump, any severity: check compatibility with the repo (and its other dependencies), make safe fixes directly on the PR branch, and reply with a structured summary. Used internally by [`update-turbo`](#update-turbo) and [`update-pnpm`](#update-pnpm), and by the [Dependabot dependency review](#dependabot-dependency-review) workflow below — it can also be called directly from any workflow that opens or reacts to a dependency-update PR.

Requires the [Claude GitHub App](https://github.com/apps/claude) to be installed on the repository so that `@claude` mentions are picked up.

`dependabot/fetch-metadata`'s `previous-version`/`new-version` outputs are only reliable for single-dependency updates — they come back blank for grouped updates covering more than one package. Pass `pr-body` in that case: Dependabot always renders a structured per-package version table into the PR body it generates, regardless of grouping, and Claude sources exact versions from there instead.

Single dependency, versions known precisely:

```yaml
- uses: eledg/github-actions/review-dependency-update@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ steps.create-pr.outputs.pull-request-number }}
    dependency-name: some-package
    previous-version: "3.4.0"
    new-version: "4.0.0"
    severity: major
    # release-notes-url: https://github.com/owner/some-package/releases/tag/v4.0.0
    # hints: |
    #   - Specific config file or API this dependency's updates tend to affect
```

Grouped update, versions sourced from the PR body:

```yaml
- uses: eledg/github-actions/review-dependency-update@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ github.event.pull_request.number }}
    dependency-name: ${{ steps.metadata.outputs.dependency-names }}
    severity: ${{ steps.metadata.outputs.update-type }}
    pr-body: ${{ github.event.pull_request.body }}
```

| Input                | Required | Default | Description                                                                                          |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `github-token`        | Yes      | —       | GitHub token with `pull-requests: write`, used to post the comment                                     |
| `pr-number`           | Yes      | —       | Pull request number to comment on                                                                      |
| `dependency-name`     | Yes      | —       | Name of the dependency being updated (comma-separated for grouped updates)                              |
| `previous-version`    | No       | `''`    | Current version, if known precisely. Reliable only for single-dependency updates                        |
| `new-version`         | No       | `''`    | New version, if known precisely. Same caveat as `previous-version`                                       |
| `severity`            | No       | `''`    | `major`/`minor`/`patch`, or Dependabot's `version-update:semver-major` form. Empty/unrecognized is always reviewed |
| `min-severity`        | No       | `minor` | Skip (no comment) if `severity` ranks below this. Default reviews major + minor, skips patch             |
| `pr-body`             | No       | `''`    | Full PR body — pass it for grouped updates so Claude can source exact per-dependency versions             |
| `release-notes-url`   | No       | `''`    | Direct link to the changelog/release notes. If omitted, Claude looks them up itself                      |
| `hints`               | No       | `''`    | Freeform extra context appended to the prompt, one bullet point per line                                 |

Requires `pull-requests: write` permission on the calling workflow.

---

### `update-turbo`

Checks for a newer turbo version on npm and opens a PR to update using `@turbo/codemod`, which migrates `turbo.json` and other config files automatically. No-ops if already on the latest version.

Requires dependencies to already be installed — run [`setup-pnpm`](#setup-pnpm) before this action. `@turbo/codemod` detects the current turbo version by shelling out to `pnpm turbo --version`; without `node_modules` already present, that triggers pnpm's auto-install-on-run behavior, which prints install progress noise to stdout that the codemod mistakes for the version string and crashes on.

```yaml
- uses: actions/checkout@v7
- uses: eledg/github-actions/setup-pnpm@v1
  with:
    enable-turbo-cache: "true"
- uses: eledg/github-actions/update-turbo@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    reviewers: your-github-username
    assignees: your-github-username
```

| Input          | Required | Default | Description                                                    |
| -------------- | -------- | ------- | -------------------------------------------------------------- |
| `github-token` | Yes      | —       | GitHub token with `contents: write` and `pull-requests: write` |
| `reviewers`    | No       | `''`    | Comma or newline separated list of pull request reviewers      |
| `assignees`    | No       | `''`    | Comma or newline separated list of pull request assignees      |
| `labels`       | No       | `build` | Labels to apply to the pull request                            |

Requires `contents: write` and `pull-requests: write` permissions on the calling workflow.

> **Note:** PRs created with `secrets.GITHUB_TOKEN` will not trigger `pull_request` workflows in the consuming repo — this is a GitHub limitation to prevent recursive runs. If you need the opened PR to run your CI, pass a PAT instead:
>
> ```yaml
> github-token: ${{ secrets.PAT_TOKEN }}
> ```
>
> The PAT needs `contents: write` and `pull-requests: write` scopes. When a PAT is used, GitHub treats the PR as user-initiated and `pull_request` fires normally.

---

### `setup-playwright`

Installs Playwright Chromium for the `ui` workspace with caching. On a cache hit, only the system dependencies are installed (skipping the full browser download).

```yaml
- uses: eledg/github-actions/setup-playwright@v1
```

No inputs.

---

### Dependabot dependency review

Add a workflow to any repo that uses Dependabot, so that a dependency-update PR gets an `@claude` comment asking it to check compatibility and fix what it safely can. Uses [`review-dependency-update`](#review-dependency-update) under the hood.

This must trigger on `pull_request_target`, not `pull_request`: GitHub always gives `pull_request`-triggered workflows a **read-only** token with no secrets when the PR author is Dependabot, regardless of the `permissions:` block, so a plain `pull_request` workflow can't post a comment. `pull_request_target` runs with the base repo's normal permissions instead. This is safe here because the workflow never checks out or runs the PR's code — it only reads event metadata and calls the GitHub API.

```yaml
name: Dependabot dependency review

on:
  pull_request_target:
    types: [opened, reopened]

permissions:
  pull-requests: write

jobs:
  review-dependency-update:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - name: Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Ask Claude to review dependency update
        uses: eledg/github-actions/review-dependency-update@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          pr-number: ${{ github.event.pull_request.number }}
          dependency-name: ${{ steps.metadata.outputs.dependency-names }}
          previous-version: ${{ steps.metadata.outputs.previous-version }}
          new-version: ${{ steps.metadata.outputs.new-version }}
          severity: ${{ steps.metadata.outputs.update-type }}
          pr-body: ${{ github.event.pull_request.body }}
          # min-severity defaults to `minor` — reviews major and minor
          # updates, skips patch. Set to `patch` to review everything, or
          # `major` to only review major bumps.
```

[`dependabot/fetch-metadata`](https://github.com/dependabot/fetch-metadata) is GitHub's own action for reading Dependabot PR metadata (dependency name, versions, and `update-type`) without parsing the PR title. For grouped updates it reports the highest-severity update type across the group, but its `previous-version`/`new-version` outputs come back **blank**, not just imprecise — `review-dependency-update`'s `pr-body` input works around this by having Claude read Dependabot's own per-package version table from the PR description instead.

Requires `pull-requests: write` permission on the calling workflow, and the [Claude GitHub App](https://github.com/apps/claude) installed on the repository.

---

## Versioning

Consuming repos pin to a major version tag (e.g. `@v1`). Dependabot in each consuming repo will open PRs when a new version is published here.

Releases are automated by [`release.yml`](.github/workflows/release.yml) via `semantic-release` on every push to `main` — don't tag manually. The version bump comes from the conventional-commit type of each merged commit (configured in [`.releaserc.json`](.releaserc.json)): `fix` → patch, `feat` → minor, a `BREAKING CHANGE:` footer (or `!` after the type) → major. Once a release publishes, the same workflow force-moves the floating major tag (e.g. `v1`) to it, so pinned consumers pick it up automatically.

## Dependency updates

Upstream actions referenced in `.github/workflows/` are kept up to date by Dependabot (configured in `.github/dependabot.yml`), which runs weekly and groups all updates into a single PR.

Upstream actions referenced inside composite `action.yml` files are kept up to date by the `check-action-dependencies` workflow in this repo, which runs every Friday and opens a PR with any major-version bumps. Consuming repos can use the `check-action-dependencies` action to get the same coverage for their own composite actions.

Once Dependabot (or `check-action-dependencies`) opens a dependency-update PR, consuming repos can add the [Dependabot dependency review](#dependabot-dependency-review) workflow to have Claude check compatibility and fix what it safely can before a human reviews it.
