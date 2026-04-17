#!/bin/bash

set -e

# Constants
COMMENT_TAG="<!-- cdk-diff-comment -->"
PR_NUMBER=$(jq --raw-output .pull_request.number "$GITHUB_EVENT_PATH")
OWNER=$(echo "$GITHUB_REPOSITORY" | cut -d '/' -f 1)
REPO=$(echo "$GITHUB_REPOSITORY" | cut -d '/' -f 2)

#
# Parse CDK diff output into a markdown table summarizing stack changes
TABLE_HEADER="| Stack | Status |
|-------|--------|"
TABLE_ROWS=""
STACK_NAME=""
STACK_STATUS=""
CHANGES=""
while IFS= read -r line; do
  if [[ $line =~ ^Stack\ (.*)$ ]]; then
    if [[ -n "$STACK_NAME" ]]; then
      # Append previous stack details
      STATUS_TEXT="${STACK_STATUS:-Changes detected}"
      EMOJI=$([[ "$STATUS_TEXT" == "No changes" ]] && echo "✅" || echo "⚠️")
      TABLE_ROWS+=$'| '"$STACK_NAME"' | '"${EMOJI} $STATUS_TEXT"$'\n'
      if [[ "$STATUS_TEXT" == "Changes detected" ]]; then
        COMMENT_BODY+="\n<details><summary>🔍 <strong>$STACK_NAME</strong> - View changes</summary>\n\n\`\`\`\n$CHANGES\n\`\`\`\n</details>\n"
      fi
    fi
    STACK_NAME="${BASH_REMATCH[1]}"
    STACK_STATUS=""
    CHANGES=""
  elif [[ $line =~ ^There\ were\ no\ differences ]]; then
    STACK_STATUS="No changes"
  else
    CHANGES+="$line"$'\n'
  fi
done < cdk-diff.txt

# Handle last stack
if [[ -n "$STACK_NAME" ]]; then
  STATUS_TEXT="${STACK_STATUS:-Changes detected}"
  EMOJI=$([[ "$STATUS_TEXT" == "No changes" ]] && echo "✅" || echo "⚠️")
  TABLE_ROWS+=$'| '"$STACK_NAME"' | '"${EMOJI} $STATUS_TEXT"$'\n'
  if [[ "$STATUS_TEXT" == "Changes detected" ]]; then
    COMMENT_BODY+="\n<details><summary>🔍 <strong>$STACK_NAME</strong> - View changes</summary>\n\n\`\`\`\n$CHANGES\n\`\`\`\n</details>\n"
  fi
fi

STACK_DIFF_SUMMARY="✨ $(grep 'Number of stacks with differences' cdk-diff.txt | sed 's/✨ *//')"
COMMENT_BODY="${STACK_DIFF_SUMMARY}"$'\n\n'"${TABLE_HEADER}"$'\n'"${TABLE_ROWS}"

RAW_OUTPUT=$(cat cdk-diff.txt)
COMMENT_BODY+=$'\n\n<details><summary>📜 Full <code>cdk diff</code> output</summary>\n\n```\n'"$RAW_OUTPUT"$'\n```\n</details>'

COMMENT="### Expected AWS Infrastructure Changes (Post-Merge)
${COMMENT_TAG}

${COMMENT_BODY}
"

# Find existing comment
COMMENT_ID=$(gh api repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments \
  --jq ".[] | select(.body | contains(\"${COMMENT_TAG}\")) | .id")

if [ "$COMMENT_ID" ]; then
  echo "Updating existing comment..."
  gh api --method PATCH repos/${OWNER}/${REPO}/issues/comments/${COMMENT_ID} \
    --field body="$COMMENT"
else
  echo "Creating new comment..."
  gh pr comment "$PR_NUMBER" --body "$COMMENT"
fi
