#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
#   INPUT_PATHS         - Comma-separated list of paths to monitor for changes
#   GITHUB_BASE_REF     - Base branch ref for pull request events (e.g., "main")
#   GITHUB_EVENT_BEFORE - Commit SHA before the event (for push events)
#   GITHUB_SHA          - Commit SHA after the event (for push events)
#   GITHUB_EVENT_NAME   - The name of the GitHub event (e.g., "pull_request" or "push")
#   GITHUB_OUTPUT       - File path to write outputs to

git fetch origin
echo "Fetched latest origin refs"

paths="${INPUT_PATHS}"
echo "Paths to monitor: $paths"
pattern=$(echo "$paths" | sed 's/,/|/g')

if [[ "${GITHUB_EVENT_NAME}" == "pull_request" ]]; then
  base_ref="origin/${GITHUB_BASE_REF}"
  echo "PR event: base ref (merge target branch) is $base_ref"
  before_commit=$(git rev-parse "$base_ref")
  after_commit=HEAD
else
  before_commit="${GITHUB_EVENT_BEFORE}"
  echo "Push event: using previous commit on the same branch"
  after_commit="${GITHUB_SHA}"
fi

echo "Using before_commit=$before_commit"
echo "Using after_commit=$after_commit"
echo "Running diff and filtering matching paths..."

changed_files=$(git diff --name-only "$before_commit" "$after_commit")
echo "Changed files:"
echo "$changed_files"

echo "Files matching filter:"
if echo "$changed_files" | grep -E "^(${pattern})"; then
  echo "result=true" >> $GITHUB_OUTPUT
  echo "Detected changes in paths: ${paths}"
  echo "Output set: result=true"
else
  echo "result=false" >> $GITHUB_OUTPUT
  echo "No changes detected in paths: ${paths}"
  echo "Output set: result=false"
fi