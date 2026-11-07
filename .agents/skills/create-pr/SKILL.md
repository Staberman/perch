---
name: create-pr
description: Opens a pull request with a clear, professional title and description built from the branch's commits, diff, and linked issue. Use when the user wants to open, create, or update a pull request or merge request, or asks for a PR title or description.
license: MIT
metadata:
  author: elrincondeldev
  version: "1.0.0"
---

# Create PR

Write the PR for its **reviewer**: someone who has not seen the work and should understand what changed, why, how it was verified, and what could break without asking the author anything. Every statement in the PR traces to the diff, a commit, an issue, or a command you ran this session.

## 1. Gather the change

- **Base branch**: the one the user named, else the repo's default branch (`git symbolic-ref refs/remotes/origin/HEAD`).
- **Head branch**: when you are on the base branch, create one named after the change, following the naming pattern of existing branches (`git branch -r`), or `<type>/<short-slug>` when there is none.
- **Uncommitted changes**: ask whether they belong in this PR. Commit them, in the repo's commit style, only on a yes.
- **Existing PR**: check whether the head branch already has an open PR (`gh pr view`, `glab mr view`). If it does, this run updates that PR's title and body.
- Read `git log <base>..HEAD`, `git diff <base>...HEAD --stat`, and the full diff, file by file when it is large.

Done when you have read every changed hunk and can say in one sentence what the change does.

## 2. Collect context

- **Linked issue**: look for references in the branch name and commit messages (`#123`, `PROJ-45`) and fetch each one with the forge CLI (`gh issue view`, `glab issue view`) to learn the goal it states.
- **Repo template**: look for `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, `docs/pull_request_template.md`, and `.gitlab/merge_request_templates/`. When one exists, its sections are the structure: fill every one of them and use the section rules in step 4 only as guidance for content.
- **Conventions**: read `CONTRIBUTING.md` if present, and the titles and bodies of the last five merged PRs (`gh pr list --state merged --limit 5 --json title,body,labels`). They set the title style, the labels, and the **language**: write the PR, headings included, in the language those PRs use, else the language of the commit messages.
- **Verification**: note which tests, lints, and builds ran this session and their results. When none ran and the project has a fast test command, run it and record the outcome.

Done when you know the structure, the title convention, the language, and which verification you can state as observed fact.

## 3. Write the title

Follow the repo's title convention; when the commits use Conventional Commits, use `type(scope): summary`. State the outcome in the imperative mood ("Add retry to webhook delivery"), in 72 characters or fewer, with no trailing period.

Done when the title matches the convention and fits in 72 characters.

## 4. Write the body

Without a repo template, fill [assets/pr-body-template.md](assets/pr-body-template.md), section by section:

- **Summary**: one to three sentences on what changes for the user or the system, outcome first.
- **Why**: the problem or motivation, in your own words, linking the issue for the full story.
- **Changes**: bullets grouped by area, each describing a behavior rather than naming a file. Put migrations, new environment variables or config, new dependencies, and breaking changes in **bold** at the top of the list.
- **How to test**: numbered steps a reviewer can follow, then what you ran and its result. Report only results you observed; list anything unchecked under "Not verified".
- **Screenshots**: only for visible UI changes, as a placeholder for the user to fill in before or after opening.
- **Risk and rollout**: what could break, how widely, and how to roll back (revert, feature flag, migration down).
- **Reviewer notes**: where to start reading, the tricky parts, and open questions for the reviewer.
- **Related**: closing keywords (`Closes #123`) and linked PRs.

Scale the body to the change: a one-line fix carries Summary and How to test. Delete every section that has nothing true to say instead of writing "N/A".

Done when every remaining section is backed by the diff, an issue, or a command you ran, and no template placeholder remains apart from screenshots awaiting the user.

## 5. Confirm and open

Show the user the title, the body, `base ← head`, and whether the PR opens as a draft. Make it a draft when the user calls the work in progress or a check you ran failed. Wait for a clear yes, then:

1. Write the body to a temporary file so its formatting survives the shell.
2. Push the branch: `git push -u origin HEAD`.
3. Open or update the PR with the forge CLI: `gh pr create --base <base> --title "<title>" --body-file <file>` (add `--draft` when needed) or `gh pr edit` for an existing PR; on GitLab, `glab mr create` or `glab mr update` with `--description`.
4. Without a forge CLI or a remote, give the user the title and body in a fenced Markdown block, ready to paste.

Done when the user has the PR's URL, or the paste-ready title and body.
