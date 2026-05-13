/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable global-require */

/**
 * GitHub Action script to post Drizzle migration SQL preview to PR.
 * @param {object} params
 * @param {object} params.github - GitHub API client
 * @param {object} params.context - GitHub Actions context
 * @param {string} params.baseRef - Base branch to compare against
 * @param {boolean} params.hasChanges - Whether schema/migration changes exist
 * @param {string} params.schemaPath - Path prefix for schema files
 * @param {string} params.migrationsPath - Path prefix for migration SQL files
 * @param {string} params.generateCommand - Command to generate migrations
 */
module.exports = async ({
  github,
  context,
  baseRef,
  hasChanges,
  schemaPath,
  migrationsPath,
  generateCommand,
}) => {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');
  const {
    getCommentContext,
    buildFooter,
    upsertComment,
  } = require('../shared/pr-comment');

  const commentMarker = '<!-- drizzle-migration-preview-comment -->';
  const { commitSha, timestamp, prNumber } = getCommentContext(context);
  const footer = buildFooter({
    label: 'Generated from schema changes',
    commitSha,
    timestamp,
  });

  if (!hasChanges) {
    const body = `${commentMarker}
## 🗄️ Database Migration Preview

✅ No schema or migration changes detected in this PR.

${footer}`;

    return upsertComment({
      github,
      prNumber,
      repo: context.repo,
      marker: commentMarker,
      body,
    });
  }

  const changedFiles = execSync(`git diff --name-only origin/${baseRef}...HEAD`)
    .toString()
    .trim()
    .split('\n')
    .filter((f) => f);

  const schemaChanges = changedFiles.filter((f) => f.startsWith(schemaPath));
  const migrationFiles = changedFiles.filter(
    (f) => f.startsWith(migrationsPath) && f.endsWith('.sql'),
  );

  let comment = `${commentMarker}\n## 🗄️ Database Migration Preview\n\n`;

  if (schemaChanges.length > 0) {
    comment += '### Schema Changes Detected\n';
    schemaChanges.forEach((file) => {
      comment += `- \`${file}\`\n`;
    });
    comment += '\n';
  }

  if (migrationFiles.length > 0) {
    comment += '### Migrations to be Applied\n\n';

    let allSqlContent = '';

    for (const file of migrationFiles) {
      const fileName = path.basename(file);
      comment += `**Migration:** \`${fileName}\`\n`;
      comment += '```sql\n';

      try {
        const content = fs.readFileSync(file, 'utf8');
        allSqlContent += `${content}\n`;
        comment += content;
      } catch (err) {
        comment += `Error reading file: ${err.message}`;
      }

      comment += '\n```\n\n';
    }

    comment += '### 🔍 Automated Safety Checks\n\n';

    const checks = [
      {
        name: 'DROP statements',
        test: (sql) => {
          const dropMatches = sql.match(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/gi);
          return {
            pass: !dropMatches,
            details: dropMatches
              ? `⚠️ Found ${dropMatches.length} DROP statement(s) — review carefully`
              : '✅ No DROP statements detected',
          };
        },
      },
      {
        name: 'Index concurrency',
        test: (sql) => {
          const createIndexMatches = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX/gi);
          const concurrentMatches = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/gi);
          if (!createIndexMatches) {
            return { pass: true, details: '✅ No index creation detected' };
          }
          const nonConcurrent =
            createIndexMatches.length - (concurrentMatches?.length || 0);
          return {
            pass: nonConcurrent === 0,
            details:
              nonConcurrent > 0
                ? `⚠️ ${nonConcurrent} index(es) created without CONCURRENTLY — may lock tables`
                : '✅ All indexes created with CONCURRENTLY',
          };
        },
      },
      {
        name: 'NOT NULL columns',
        test: (sql) => {
          const notNullWithoutDefault = sql.match(
            /ADD\s+COLUMN\s+\w+\s+[^,;]+\s+NOT\s+NULL(?!\s+DEFAULT)/gi,
          );
          return {
            pass: !notNullWithoutDefault,
            details: notNullWithoutDefault
              ? `⚠️ ${notNullWithoutDefault.length} NOT NULL column(s) without DEFAULT value — may fail on existing rows`
              : '✅ All NOT NULL columns have DEFAULT values or no NOT NULL additions',
          };
        },
      },
      {
        name: 'Rename operations',
        test: (sql) => {
          const renameMatches = sql.match(/\bRENAME\s+(TABLE|COLUMN|TO)\b/gi);
          return {
            pass: !renameMatches,
            details: renameMatches
              ? `⚠️ Found ${renameMatches.length} RENAME operation(s) — ensure app code is updated`
              : '✅ No rename operations detected',
          };
        },
      },
    ];

    for (const check of checks) {
      const result = check.test(allSqlContent);
      comment += `${result.details}\n`;
    }

    comment += '\n### ✋ Manual Review Required\n\n';
    comment += '- [ ] Backwards compatible with current deployed app code\n';
    comment += '- [ ] Migration can be safely rolled back if needed\n';
    comment += '- [ ] Large table migrations tested for performance impact\n\n';
  } else {
    comment += `⚠️ Schema files changed but no migration files found. Please run \`${generateCommand}\`.\n\n`;
  }

  comment += `${footer}\n`;

  return upsertComment({
    github,
    prNumber,
    repo: context.repo,
    marker: commentMarker,
    body: comment,
  });
};
