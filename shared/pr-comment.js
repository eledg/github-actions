/**
 * Shared utilities for PR comment actions.
 *
 * Provides a standardised way to create/update bot comments on pull requests
 * using hidden HTML markers for reliable identification.
 */

/**
 * Extract common context values from the GitHub Actions event.
 * @param {object} context - GitHub Actions context
 * @param {object} [overrides]
 * @param {string} [overrides.commitSha] - Explicit commit SHA (takes precedence over context)
 * @returns {{ prNumber: number, commitSha: string, timestamp: string }}
 */
const getCommentContext = (context, overrides = {}) => {
  const prNumber = context.issue.number || context.payload.pull_request?.number;
  if (!prNumber) {
    throw new Error('Could not determine PR number from context');
  }

  const commitSha = overrides.commitSha
    ? overrides.commitSha.substring(0, 7)
    : (context.payload.pull_request?.head.sha || context.sha).substring(0, 7);

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  return { prNumber, commitSha, timestamp };
};

/**
 * Build a standardised footer line for a PR comment.
 * @param {object} params
 * @param {string} params.label - Descriptive label (e.g. "CDK diff against production")
 * @param {string} params.commitSha - Short commit SHA
 * @param {string} params.timestamp - UTC timestamp string
 * @returns {string}
 */
const buildFooter = ({ label, commitSha, timestamp }) =>
  `---\n<sub>${label} • Commit: \`${commitSha}\` • Updated: ${timestamp} UTC</sub>`;

/**
 * Find an existing bot comment by its hidden marker, then update it or create a new one.
 * @param {object} params
 * @param {object} params.github - GitHub API client
 * @param {number} params.prNumber - Pull request / issue number
 * @param {object} params.repo - { owner, repo }
 * @param {string} params.marker - Hidden HTML comment marker (e.g. "<!-- my-marker -->")
 * @param {string} params.body - Full comment body (should include the marker)
 * @returns {Promise<number>} The comment ID
 */
const upsertComment = async ({ github, prNumber, repo, marker, body }) => {
  const { data: comments } = await github.rest.issues.listComments({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: prNumber,
  });

  const existingComment = comments.find(
    (c) => c.user?.login === 'github-actions[bot]' && c.body?.includes(marker),
  );

  if (existingComment) {
    await github.rest.issues.updateComment({
      owner: repo.owner,
      repo: repo.repo,
      comment_id: existingComment.id,
      body,
    });
    return existingComment.id;
  }

  const { data: newComment } = await github.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: prNumber,
    body,
  });
  return newComment.id;
};

module.exports = { getCommentContext, buildFooter, upsertComment };
