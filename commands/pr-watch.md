---
name: pr-watch
description: Monitor GitHub PR status - CI/CD checks, reviews, comments, and merge conflicts
usage: /pr-watch <PR-NUMBER|JIRA-KEY[,...]> [--notify-on=all|checks|reviews|comments] [--interval=30s] [--until=checks-pass|approved|merged|closed] [--desktop] [--bell]
examples:
  - /pr-watch 1085
  - /pr-watch TAK-1674
  - /pr-watch TAK-1674 --notify-on=checks --desktop
  - /pr-watch 1085 --until=checks-pass --interval=15s --bell
  - /pr-watch 1085,TAK-1256,1087 --notify-on=checks --desktop
---

# Monitor GitHub Pull Request

Execute the pr-notifier skill to watch a GitHub PR's CI/CD status, reviews, and comments.

## Parameters

- **PR-NUMBER|JIRA-KEY** (required): PR number (e.g., 1085) or Jira ticket key (e.g., TAK-1674)
  - Supports comma-separated list for multiple PRs
- **--notify-on** (optional): Filter notifications - `all` (default), `checks`, `reviews`, or `comments`
- **--interval** (optional): Polling interval - `30s` (default), `15s`, `60s`, or `1m`
- **--until** (optional): Auto-stop condition - `checks-pass`, `approved`, `merged`, or `closed`
- **--desktop** (optional): Enable macOS desktop notifications
- **--bell** (optional): Enable terminal bell/beep

## Instructions for Claude

When this command is invoked:

1. **Extract parameters** from the command:
   - PR identifier(s) (required, first argument - can be PR number or Jira key, comma-separated for multiple)
   - `--notify-on` flag (optional, default: "all")
   - `--interval` flag (optional, default: "30s")
   - `--until` flag (optional)
   - `--desktop` flag (optional boolean)
   - `--bell` flag (optional boolean)

2. **Call the TypeScript skill** with parsed parameters:
   ```typescript
   import { execute } from './build/index.js';

   const result = await execute(
     context,
     prIdentifiers, // e.g., "1085" or "TAK-1674" or "1085,TAK-1256,1087"
     {
       notifyOn: "checks",     // or "all", "reviews", "comments"
       interval: "30s",
       until: "checks-pass",   // or "approved", "merged", "closed"
       desktop: true,
       bell: true
     }
   );
   ```

3. **The skill will**:
   - Resolve Jira ticket keys to PR numbers (if needed)
   - Poll GitHub via `gh` CLI at specified interval
   - Detect and report changes:
     - ✅ CI/CD check status changes
     - 👀 New reviews or reviewer changes
     - 💬 New comments
     - ⚠️ Merge conflicts
     - 🔄 PR status changes (merged, closed, etc.)
   - Send desktop notifications (if enabled)
   - Play terminal bell (if enabled)
   - Auto-stop when conditions are met
   - Generate summary report

4. **Output the results** to the user:
   - Real-time event notifications with timestamps
   - PR state overview
   - Summary statistics when monitoring completes

## What Gets Monitored

### CI/CD Checks
- Build status changes (pending → success/failure)
- Test execution (unit tests, integration tests)
- Other workflow checks

### Reviews
- New reviews submitted
- Review state changes (approved, changes requested)
- Reviewer assignments

### Comments
- PR-level comments
- Review comments on code
- Inline suggestions

### PR Status
- Status changes (draft → ready, merged, closed)
- Merge conflict detection
- Label changes

## Notification Options

### --notify-on Filter
- `all` (default): Report all events
- `checks`: Only CI/CD check status
- `reviews`: Only review activity
- `comments`: Only new comments

### --interval Polling
- `15s`: Fast polling (more API calls)
- `30s`: Balanced (default)
- `60s` or `1m`: Slow polling (fewer API calls)

### --until Auto-Stop
- `checks-pass`: Stop when all checks succeed
- `approved`: Stop when PR is approved
- `merged`: Stop when PR is merged
- `closed`: Stop when PR is closed or merged

### --desktop Notifications
- Shows important events as macOS system notifications
- Includes summary when monitoring completes
- Uses different sounds for success/error/warning

### --bell Terminal Bell
- Beeps on important events
- Double beep when monitoring completes
- Non-intrusive audio feedback

## Jira Key Resolution

When a Jira ticket key is provided (e.g., `TAK-1674`):
1. Searches recent PRs (last 50) for the ticket key
2. Checks in order:
   - Branch name (most reliable): `TAK-1674-fix-issue`
   - PR title: `TAK-1674: Fix the bug`
   - PR body: Contains `TAK-1674` or link to ticket
3. Uses the first match found
4. Shows resolution info: `TAK-1674 → PR #1085`

## Multi-PR Support

When multiple identifiers are provided (comma-separated):
- Monitors all PRs simultaneously
- Reports events for each PR
- Shows summary when all PRs are complete
- Example: `/pr-watch 1085,TAK-1256,1087`

## Requirements

- **GitHub CLI** (`gh`) must be installed and authenticated
- Access to the repository
- Valid PR number or Jira ticket key

## Example Outputs

### Single PR Monitoring
```
🔍 Watching PR #1085
📊 Notify on: checks
⏱️  Polling interval: 30s
🎯 Until: checks-pass

[13:30:15] 🔄 Check started: build-test / build
[13:32:15] ✅ Check success: build-test / build
[13:32:45] 🔄 Check started: build-test / unit-tests

✅ Condition met: checks-pass
Stopping watch.
```

### Multi-PR Monitoring
```
🔍 Watching 3 PRs: #1085, #1256, #1087
📊 Notify on: checks
⏱️  Polling interval: 30s

[13:30:15] PR #1085: ✅ Check success: build-test / build
[13:30:45] PR #1256: ❌ Check failure: build-test / tests
[13:31:15] PR #1087: ✅ Check success: build-test / build

✅ All PRs complete!
```