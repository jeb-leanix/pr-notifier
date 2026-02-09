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
# Basic - watch single PR
/pr-watch <PR-NUMBER>

# Multiple PRs (comma-separated)
/pr-watch <PR-NUMBER,PR-NUMBER,PR-NUMBER>

# With options
/pr-watch <PR-NUMBER> --notify-on=all|checks|reviews|comments
/pr-watch <PR-NUMBER> --interval=30s
/pr-watch <PR-NUMBER> --until=merged|approved|checks-pass
/pr-watch <PR-NUMBER> --desktop --bell

# Examples
/pr-watch 1085
/pr-watch 1085 --notify-on=checks --desktop
/pr-watch 1085 --until=merged --interval=60s --bell
/pr-watch 1085,1086,1087 --notify-on=checks
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

**Wait for CI/CD to pass with notifications:**
```
/pr-watch 1085 --notify-on=checks --until=checks-pass --desktop --bell
```

**Monitor reviews only:**
```
/pr-watch 1085 --notify-on=reviews --until=approved
```

**Watch everything until merged:**
```
/pr-watch 1085 --until=merged --desktop
```

**Watch multiple PRs:**
```
/pr-watch 1085,1086,1087 --notify-on=checks --desktop
```

**Quick check with desktop notification:**
```
/pr-watch 1085 --interval=15s --desktop
```

## Requirements

- GitHub CLI (`gh`) must be installed and authenticated
- Access to the repository
- Valid PR number

## Tips

- Use `--notify-on=checks` to reduce noise when you only care about CI/CD
- Set `--until=checks-pass` to auto-stop when ready for review
- Longer `--interval` values reduce GitHub API usage