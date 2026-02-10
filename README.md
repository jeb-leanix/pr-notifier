# PR Notifier - GitHub PR Observer

A Claude Code plugin that monitors GitHub Pull Requests and notifies you about CI/CD checks, reviews, and comments.

## Features

- 🔑 **Jira Key Support**: Use ticket keys like `TAK-1256` instead of PR numbers
- 🔄 **CI/CD Monitoring**: Track build, test, and workflow status
- 👀 **Review Tracking**: Get notified when reviews are submitted
- 💬 **Comment Alerts**: See new comments as they arrive
- ⚠️ **Merge Conflict Detection**: Know immediately when conflicts occur
- 🎯 **Smart Auto-Stop**: Stops watching when conditions are met
- 🔔 **Rich Desktop Notifications**: macOS notifications with GitHub/Jira icons via terminal-notifier
- 🎫 **Auto-Jira Transition**: Automatically move tickets to "In Review" when checks pass
- 📊 **Summary Reports**: Statistics, timings, and insights
- 🔢 **Multi-PR Support**: Watch multiple PRs simultaneously
- 🔄 **Smart Retry**: Exponential backoff with health monitoring
- 🧠 **PR Analysis**: Detects slow checks and provides insights
- ⚙️ **Configurable**: Filter notifications and set polling intervals
- 🚨 **Error Notifications**: Get alerted immediately if the watcher crashes or fails
- 💓 **Heartbeat Monitoring**: Regular status updates to confirm the watcher is still running

## Installation

```bash
# 1. Clone to local plugins directory
cd ~/.claude/local-plugins
git clone <repo-url> pr-notifier
cd pr-notifier

# 2. Install dependencies
npm install

# 3. Build the plugin
npm run build

# 4. Enable in Claude settings
# Edit ~/.claude/settings.json and add:
{
  "enabledPlugins": {
    "pr-notifier@local": true
  },
  "extraKnownMarketplaces": {
    "local": {
      "source": {
        "source": "directory",
        "path": "/Users/YOUR_USERNAME/.claude/local-plugins"
      }
    }
  }
}
```

## Requirements

- **GitHub CLI** (`gh`) installed and authenticated
- Claude Code
- Access to the GitHub repository

## Usage

### Basic

Watch a PR using number or Jira key:

```
/pr-watch 1085
/pr-watch TAK-1674
```

### With Options

**Using Jira ticket keys (desktop notifications ON by default):**
```
/pr-watch TAK-1674
/pr-watch TAK-1674 --bell
```

**Monitor only CI/CD checks:**
```
/pr-watch TAK-1674 --notify-on=checks
```

**Stop when checks pass:**
```
/pr-watch 1085 --until=checks-pass --bell
```

**Custom polling interval:**
```
/pr-watch TAK-1256 --interval=15s
```

**Wait for approval:**
```
/pr-watch 1085 --notify-on=reviews --until=approved
```

**Watch multiple PRs (mixed):**
```
/pr-watch 1085,TAK-1256,1087 --notify-on=checks
```

**Without desktop notifications:**
```
/pr-watch TAK-1674 --until=checks-pass --no-desktop
```

**Without Jira auto-transition:**
```
/pr-watch TAK-1674 --until=checks-pass --no-jira-transition
```

### Options

- `<PR-NUMBER|JIRA-KEY>`: PR number (e.g., `1085`) or Jira ticket key (e.g., `TAK-1674`)
  - Supports comma-separated list for multiple PRs
  - Auto-resolves Jira keys to PR numbers

- `--notify-on=<filter>`: What to report
  - `all` (default): Everything
  - `checks`: Only CI/CD status
  - `reviews`: Only reviews
  - `comments`: Only comments

- `--interval=<time>`: Polling frequency
  - `15s`: Fast (more API calls)
  - `30s`: Balanced (default)
  - `60s` or `1m`: Slow (fewer API calls)

- `--until=<condition>`: Auto-stop condition
  - `checks-pass`: Stop when all checks succeed
  - `approved`: Stop when PR is approved
  - `merged`: Stop when PR is merged
  - `closed`: Stop when PR is closed

- `--desktop`: Enable macOS desktop notifications (default: **ON**)
- `--no-desktop`: Disable desktop notifications
- `--bell`: Enable terminal bell/beep
- `--no-jira-transition`: Disable automatic Jira ticket transition to "In Review"

## Example Output

```
🔍 Watching PR #1085
📊 Notify on: checks
⏱️  Polling interval: 30s
🎯 Until: checks-pass

[13:30:15] Monitoring PR #1085: Fix BufferedWriter IOException
State: OPEN
Checks: 0 passed, 0 failed, 3 pending (3 total)
Reviews: 5
Comments: 2

[13:30:45] 🔄 Check started: build-test / build
[13:32:15] ✅ Check success: build-test / build
[13:32:45] 🔄 Check started: build-test / unit-tests
[13:38:15] ✅ Check success: build-test / unit-tests
[13:38:45] 🔄 Check started: build-test / integration-tests
[13:48:15] ✅ Check success: build-test / integration-tests

✅ Condition met: checks-pass
Stopping watch.
```

## How It Works

1. **Polls GitHub API** via `gh` CLI at regular intervals
2. **Compares snapshots** to detect changes
3. **Filters events** based on your preferences
4. **Reports changes** in real-time
5. **Auto-stops** when conditions are met or no more activity

## Development

```bash
# Watch mode for development
npm run watch

# Build
npm run build

# Test manually
node build/index.js --help
```

## Tips

- Desktop notifications are **ON by default** - use `--no-desktop` to disable them
- Use `--notify-on=checks` when you only care about CI/CD
- Set `--until=checks-pass` to auto-stop when ready for review
- Longer `--interval` values reduce GitHub API usage
- The plugin auto-stops when PR is merged or all conditions are met
- Jira ticket auto-transition to "In Review" happens when `--until=checks-pass` is met

## Troubleshooting

**"gh: command not found"**
- Install GitHub CLI: `brew install gh`
- Authenticate: `gh auth login`

**"Failed to fetch PR"**
- Check you have access to the repository
- Verify PR number is correct
- Ensure `gh` is authenticated

**Plugin not showing up**
- Verify path in `~/.claude/settings.json`
- Run `npm run build`
- Restart Claude Code

## License

MIT