# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `zzyx/gwiazdka`.

Use the `gh` CLI where it is available. In Claude Code cloud sessions `gh` is not installed; use the GitHub MCP tools (`mcp__github__*`) for the same operations: `issue_write` (create/update/close, labels, assignees), `issue_read` (body, comments, labels, sub-issues), `add_issue_comment`, `list_issues` / `search_issues`, `sub_issue_write`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` (or `issue_read` via MCP).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Destination / Notes / Decisions-so-far / Not-yet-specified / Out-of-scope body.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (sub-issues endpoint, or `sub_issue_write` via MCP). Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's native issue dependencies where the tooling can set them (`gh api --method POST repos/zzyx/gwiazdka/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`). The MCP tools cannot set dependencies, so tickets also carry a `Blocked by: #<n>, #<n>` line at the top of the body; that line is authoritative when the two disagree. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open sub-issues, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: assign the ticket to the driving dev, the session's first write.
- **Resolve**: comment the answer, close the issue, then append a context pointer (gist + link) to the map's Decisions-so-far.
