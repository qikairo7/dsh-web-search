# Issue tracker: GitHub

Issues and specs live as GitHub issues. Use the `gh` CLI.

## Core commands

- Create: `gh issue create --title "..." --body "..."` (use a heredoc for multi-line bodies).
- Read: `gh issue view <n> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,labels`; add `--label` to filter.
- Comment: `gh issue comment <n> --body "..."`.
- Labels: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- Close: comment with the explanation, then `gh issue close <n>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

## Sub-issues and blocking

- Sub-issue: `gh issue create --parent <parent> ...` or `gh issue edit <parent> --add-sub-issue <child>` (`gh` 2.94+). Fallback: put `Part of #<parent>` at the top of the child body.
- Blocking: `gh issue create --blocked-by <n>,<n>` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Fallback: put `Blocked by: #<n>, #<n>` at the top of the child body. A ticket is unblocked when every blocker is closed.
- Open blockers: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by`; 0 means startable.
- Older `gh`: use the REST sub-issues and dependencies endpoints with the blocker's numeric database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), not the `#number` or `node_id`.

## Repo target

Infer the repo from `git remote -v`; `gh` does this inside a clone. File issues only into the user's own repo. Before the first `gh issue create` of a session, run `gh repo view --json nameWithOwner` and confirm the target if it is not the user's repo.

## Pull requests

PRs as a request surface: no. GitHub shares one number space across issues and PRs, so resolve a bare `#42` with `gh pr view 42`, then `gh issue view 42`.

## Skill phrases

- "publish to the issue tracker": create a GitHub issue.
- "fetch the relevant ticket": read the issue.
