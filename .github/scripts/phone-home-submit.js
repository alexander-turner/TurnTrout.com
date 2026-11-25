// @ts-check
"use strict";

const fs = require("fs");

const PHONE_HOME_DIR = "/tmp/phone-home";

/**
 * Submit extracted lessons as an issue on the template repository.
 *
 * Called by the phone-home workflow via actions/github-script.
 * Expects PR_TITLE, PR_URL, SOURCE_REPO, and TEMPLATE_REPO env vars.
 *
 * Every API failure propagates and fails the run. This runs once per merged
 * PR, so a swallowed failure loses that PR's lessons for good behind a green run.
 *
 * @param {object} params
 * @param {object} params.github - Authenticated Octokit client
 */
module.exports = async ({ github }) => {
  const lessons = fs.readFileSync(`${PHONE_HOME_DIR}/lessons.txt`, "utf8");
  const prTitle = process.env.PR_TITLE;
  const prUrl = process.env.PR_URL;
  const repo = process.env.SOURCE_REPO;
  const templateRepo = process.env.TEMPLATE_REPO;

  if (!prTitle || !prUrl || !repo || !templateRepo) {
    throw new Error(
      "Missing required env vars: PR_TITLE, PR_URL, SOURCE_REPO, TEMPLATE_REPO must all be set",
    );
  }

  const title = `[phone-home] ${prTitle}`;
  const [templateOwner, templateRepoName] = templateRepo.split("/");

  // A job re-run (e.g. after a transient createLabel/addLabels failure) would
  // otherwise re-submit the same PR's lessons as a second, duplicate issue —
  // dedup on open issues with the same title before creating a new one.
  const openIssues = await github.paginate(github.rest.issues.listForRepo, {
    owner: templateOwner,
    repo: templateRepoName,
    state: "open",
    labels: "phone-home",
    per_page: 100,
  });
  const existing = openIssues.find(
    (issue) => !issue.pull_request && issue.title === title,
  );
  if (existing) {
    console.log(`Issue already exists for this PR: ${existing.html_url}`);
    return;
  }

  const issueBody = [
    `## Improvement Suggestion from \`${repo}\``,
    "",
    `**Source PR:** ${prUrl}`,
    `**PR Title:** ${prTitle}`,
    "",
    "## Lessons Learned",
    "",
    lessons,
    "",
    "---",
    `*Automatically submitted by the phone-home workflow from \`${repo}\`.*`,
  ].join("\n");

  const issue = await github.rest.issues.create({
    owner: templateOwner,
    repo: templateRepoName,
    title,
    body: issueBody,
  });
  console.log(`Created issue on template repo: ${issue.data.html_url}`);

  // GitHub creates a label that does not exist yet, so a failure here is real.
  // Without the phone-home label, a re-run's dedup above cannot see this issue.
  await github.rest.issues.addLabels({
    owner: templateOwner,
    repo: templateRepoName,
    issue_number: issue.data.number,
    labels: ["phone-home", "triage"],
  });
};
