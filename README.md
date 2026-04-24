# github-actions

Shared composite GitHub Actions used across eledg projects.

## Actions

### `setup-pnpm`

Installs Node.js 24, pnpm, restores the pnpm store cache, runs `pnpm clean`, and installs dependencies.

```yaml
- uses: eledg/github-actions/setup-pnpm@v1
```

No inputs.

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

| Input | Required | Default | Description |
|---|---|---|---|
| `production` | No | `false` | Deploy to production (`--prod`) |
| `vercel-org-id` | Yes | — | Vercel organisation ID |
| `vercel-project-id` | Yes | — | Vercel project ID |
| `vercel-token` | Yes | — | Vercel auth token |

---

### `check-coverage`

Runs `pnpm coverage` and uploads results to Codecov.

```yaml
- uses: eledg/github-actions/check-coverage@v1
  with:
    codecov-token: ${{ secrets.CODECOV_TOKEN }}
    actor: ${{ github.actor }}
```

| Input | Required | Default | Description |
|---|---|---|---|
| `codecov-token` | Yes | — | Codecov upload token |
| `actor` | No | `''` | GitHub actor (`github.actor`) — upload is skipped for `dependabot[bot]` and `dependabot-preview[bot]` |

---

### `filter-changes`

Outputs a boolean indicating whether any of the specified paths were modified in the current push or PR. Requires the repo to be checked out with `fetch-depth: 0`.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- id: set-result
  uses: eledg/github-actions/filter-changes@v1
  with:
    paths: apps/ui,packages/shared
```

| Input | Required | Description |
|---|---|---|
| `paths` | Yes | Comma-separated list of paths to watch |

| Output | Description |
|---|---|
| `result` | `true` if any matching files changed, otherwise `false` |

---

### `cdk-synth`

Assumes an AWS IAM role via OIDC and runs `pnpm --filter infra synth`. Any app-specific environment variables (e.g. secrets passed to the CDK app) should be set at the calling job level.

```yaml
- uses: eledg/github-actions/cdk-synth@v1
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsOIDCRole-eu-west-1
```

| Input | Required | Default | Description |
|---|---|---|---|
| `role-to-assume` | Yes | — | IAM role ARN to assume via OIDC |
| `aws-region` | No | `eu-west-1` | AWS region |

Requires `id-token: write` permission on the calling job.

---

### `cdk-diff`

Assumes an AWS IAM role via OIDC and runs `pnpm --filter infra prod:diff`. On pull requests, posts the diff as a comment. Any app-specific environment variables should be set at the calling job level.

```yaml
- uses: eledg/github-actions/cdk-diff@v1
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsOIDCRole-eu-west-1
```

| Input | Required | Default | Description |
|---|---|---|---|
| `role-to-assume` | Yes | — | IAM role ARN to assume via OIDC |
| `aws-region` | No | `eu-west-1` | AWS region |

Requires `id-token: write` and `pull-requests: write` permissions on the calling job.

---

## Versioning

Consuming repos pin to a major version tag (e.g. `@v1`). Dependabot in each consuming repo will open PRs when a new version is published here.

To release a new version, push a tag:

```bash
git tag v1.x.x
git push origin v1.x.x
# Move the floating major tag
git tag -f v1
git push origin v1 --force
```

## Dependabot

This repo has Dependabot configured to keep the upstream actions (e.g. `actions/setup-node`, `pnpm/action-setup`) up to date weekly.
