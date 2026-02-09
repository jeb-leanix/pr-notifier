---
name: pr-watch
description: Monitor GitHub PR status - CI/CD checks, reviews, comments, and merge conflicts
version: 1.0.0
---

# GitHub PR Notifier

Monitor GitHub Pull Requests and get notified about important events.

## When to Use

This skill activates when:
- User wants to monitor a PR's CI/CD status
- User needs to wait for review completion
- User wants to track PR comments and changes
- User asks to "watch" or "monitor" a PR

## How to Use

```bash
# Basic - watch single PR (by number or Jira key)
/pr-watch <PR-NUMBER|JIRA-KEY>

# Using Jira ticket keys
/pr-watch TAK-1256
/pr-watch TAK-1674

# Multiple PRs (comma-separated, mixed)
/pr-watch <PR-NUMBER,JIRA-KEY,PR-NUMBER>

# With options
/pr-watch <IDENTIFIER> --notify-on=all|checks|reviews|comments
/pr-watch <IDENTIFIER> --interval=30s
/pr-watch <IDENTIFIER> --until=merged|approved|checks-pass
/pr-watch <IDENTIFIER> --desktop --bell

# Examples
/pr-watch 1085
/pr-watch TAK-1674
/pr-watch TAK-1674 --notify-on=checks --desktop
/pr-watch 1085 --until=merged --interval=60s --bell
/pr-watch 1085,TAK-1256,1087 --notify-on=checks
```

## What Gets Monitored

### CI/CD Checks
- ✅ Build status (pending → success/failure)
- ✅ Unit tests
- ✅ Integration tests
- ✅ Other workflow checks

### Reviews
- 👀 Review requests sent
- ✅ Reviews completed (approved/changes requested/commented)
- 👥 Reviewer assignments

### Comments
- 💬 PR-level comments
- 📝 Review comments on code
- 🔧 Inline suggestions

### PR Status
- 🔄 Status changes (draft → ready, merged, closed)
- ⚠️ Merge conflicts detected
- 🏷️ Label changes

## Notification Events

The skill reports:
- **Check Started**: When a CI/CD check begins
- **Check Completed**: Success or failure with details
- **Review Activity**: New reviews or reviewer changes
- **Comments Added**: New comments or suggestions
- **PR Status Change**: Merged, closed, or ready for review
- **Merge Conflict**: When conflicts are detected

## Options

### --notify-on
Filter what events to report:
- `all` (default): Report everything
- `checks`: Only CI/CD check status
- `reviews`: Only review activity
- `comments`: Only new comments

### --interval
How often to poll GitHub (default: 30s):
- `15s`: Fast polling (more API calls)
- `30s`: Balanced (default)
- `60s`: Slow polling (fewer API calls)

### --until
Stop monitoring when condition is met:
- `checks-pass`: Stop when all checks pass
- `approved`: Stop when PR is approved
- `merged`: Stop when PR is merged
- `closed`: Stop when PR is closed

### --desktop
Enable macOS desktop notifications (Notification Center):
- Shows important events as system notifications
- Includes summary when monitoring completes
- Uses different sounds for success/error/warning

### --bell
Enable terminal bell/beep:
- Beeps on important events (success, errors)
- Double beep when monitoring completes
- Non-intrusive audio feedback

## Examples

**Watch using Jira ticket key:**
```
/pr-watch TAK-1674
/pr-watch TAK-1256 --desktop --bell
```

**Wait for CI/CD to pass with notifications:**
```
/pr-watch TAK-1674 --notify-on=checks --until=checks-pass --desktop --bell
```

**Monitor reviews only:**
```
/pr-watch 1085 --notify-on=reviews --until=approved
```

**Watch everything until merged:**
```
/pr-watch TAK-1674 --until=merged --desktop
```

**Watch multiple PRs (mixed identifiers):**
```
/pr-watch 1085,TAK-1256,1087 --notify-on=checks --desktop
/pr-watch TAK-1674,TAK-1675,TAK-1676
```

**Quick check with desktop notification:**
```
/pr-watch TAK-1674 --interval=15s --desktop
```

## Requirements

- GitHub CLI (`gh`) must be installed and authenticated
- Access to the repository
- Valid PR number or Jira ticket key (e.g., TAK-1234)

## How Jira Key Resolution Works

When you provide a Jira ticket key (e.g., `TAK-1674`), the plugin:

1. Searches recent PRs (last 50) for the ticket key
2. Checks in this order:
   - **Branch name** (most reliable): `TAK-1674-fix-issue`
   - **PR title**: `TAK-1674: Fix the bug`
   - **PR body/description**: Contains `TAK-1674` or link to ticket
3. Uses the first match found
4. Shows resolution info: `TAK-1674 → PR #1085`

**Note:** If multiple PRs exist for the same ticket, it will use the first match (typically the most recent one).

## Tips

- Use `--notify-on=checks` to reduce noise when you only care about CI/CD
- Set `--until=checks-pass` to auto-stop when ready for review
- Longer `--interval` values reduce GitHub API usage