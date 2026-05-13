/* eslint-disable @typescript-eslint/no-require-imports */

const {
  getCommentContext,
  buildFooter,
  upsertComment,
} = require('../shared/pr-comment');

/**
 * GitHub Action script to post CDK diff output to PR.
 * Reads cdk-diff.txt from the workspace root.
 * @param {object} params
 * @param {object} params.github - GitHub API client
 * @param {object} params.context - GitHub Actions context
 */
module.exports = async ({ github, context }) => {
  const fs = require('fs');
  const diffOutput = fs.readFileSync('cdk-diff.txt', 'utf8');

  const commentMarker = '<!-- cdk-diff-comment -->';
  const { commitSha, timestamp, prNumber } = getCommentContext(context);

  // Parse stack-level changes from the diff output
  const stackSections = diffOutput
    .split(/(?=^Stack )/m)
    .filter((s) => s.startsWith('Stack '));

  const stacks = stackSections.map((section) => {
    const nameMatch = section.match(/^Stack (\S+)/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';
    const hasNoChanges = section.includes('There were no differences');
    const hasResources = section.includes('Resources');
    const hasSecurityChanges = section.includes('Security Group Changes');
    return {
      name,
      hasChanges: !hasNoChanges && (hasResources || hasSecurityChanges),
    };
  });

  const stacksWithChanges = stacks.filter((s) => s.hasChanges).length;
  const hasChanges = stacksWithChanges > 0;

  let stackSummary = '';
  if (stacks.length > 0) {
    stackSummary = `| Stack | Status |
|-------|--------|
${stacks.map((s) => `| ${s.name} | ${s.hasChanges ? '⚠️ Changes' : '✅ No changes'} |`).join('\n')}`;
  }

  let statusText;
  if (hasChanges) {
    statusText = `**${stacksWithChanges}** of **${stacks.length}** stack${stacks.length !== 1 ? 's' : ''} will be updated after merge`;
  } else {
    statusText = 'No infrastructure changes detected';
  }

  // Truncate diff output if too long (GitHub comment limit is 65536 chars)
  const maxDiffLength = 60000;
  let formattedDiff = diffOutput;
  if (formattedDiff.length > maxDiffLength) {
    formattedDiff = `${formattedDiff.substring(0, maxDiffLength)}\n\n... (output truncated)`;
  }

  const footer = buildFooter({
    label: 'CDK diff against production',
    commitSha,
    timestamp,
  });

  const body = `${commentMarker}
## 🏗️ CDK Infrastructure Changes

${stackSummary}

${hasChanges ? '⚠️' : '✅'} ${statusText}

<details>
<summary>📋 View full CDK diff</summary>

\`\`\`diff
${formattedDiff}
\`\`\`

</details>

${footer}`;

  return upsertComment({
    github,
    prNumber,
    repo: context.repo,
    marker: commentMarker,
    body,
  });
};
