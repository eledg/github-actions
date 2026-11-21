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

  // Each label gets its own comment, so one PR can show several environments' diffs. No label keeps the original
  // marker, which is not a substring of a labelled one.
  const label = process.env.DIFF_LABEL?.trim() || '';
  const commentMarker = label
    ? `<!-- cdk-diff-comment:${label} -->`
    : '<!-- cdk-diff-comment -->';
  const { commitSha, timestamp, prNumber } = getCommentContext(context);

  // Parse stack-level changes from the diff output
  const stackSections = diffOutput
    .split(/(?=^Stack )/m)
    .filter((s) => s.startsWith('Stack '));

  const stacks = stackSections.map((section) => {
    // e.g. "Stack my-stack (aws://123456789012/eu-west-2)"; older CDK versions print the name only.
    const nameMatch = section.match(/^Stack (\S+)(?: \(aws:\/\/([^/)]+)\/([^)]+)\))?/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';
    const environment =
      nameMatch && nameMatch[2] ? `${nameMatch[2]}/${nameMatch[3]}` : '';
    const hasNoChanges = section.includes('There were no differences');
    const hasResources = section.includes('Resources');
    const hasSecurityChanges = section.includes('Security Group Changes');
    return {
      name,
      environment,
      hasChanges: !hasNoChanges && (hasResources || hasSecurityChanges),
    };
  });

  const stacksWithChanges = stacks.filter((s) => s.hasChanges).length;
  const hasChanges = stacksWithChanges > 0;

  // The account and region column shows which account each stack lands in, when the CDK prints it.
  const showEnvironment = stacks.some((s) => s.environment);
  const status = (s) => (s.hasChanges ? '⚠️ Changes' : '✅ No changes');
  let stackSummary = '';
  if (stacks.length > 0) {
    stackSummary = showEnvironment
      ? `| Stack | Account/Region | Status |
|-------|----------------|--------|
${stacks.map((s) => `| ${s.name} | ${s.environment || '—'} | ${status(s)} |`).join('\n')}`
      : `| Stack | Status |
|-------|--------|
${stacks.map((s) => `| ${s.name} | ${status(s)} |`).join('\n')}`;
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
    label: label ? `CDK diff against ${label}` : 'CDK diff',
    commitSha,
    timestamp,
  });

  const body = `${commentMarker}
## 🏗️ CDK Infrastructure Changes${label ? `: ${label}` : ''}

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
