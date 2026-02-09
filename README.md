# PR Notifier - GitHub PR Observer

A Claude Code plugin that monitors GitHub Pull Requests and notifies you about CI/CD checks, reviews, and comments.

## Features

- 🔄 **CI/CD Monitoring**: Track build, test, and workflow status
- 👀 **Review Tracking**: Get notified when reviews are submitted
- 💬 **Comment Alerts**: See new comments as they arrive
- ⚠️ **Merge Conflict Detection**: Know immediately when conflicts occur
- 🎯 **Smart Auto-Stop**: Stops watching when conditions are met
- ⚙️ **Configurable**: Filter notifications and set polling intervals

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

Watch a PR until all checks pass:

```
/pr-watch 1085
```

### With Options

**Monitor only CI/CD checks:**
```
/pr-watch 1085 --notify-on=checks
```

**Stop when checks pass:**
```
/pr-watch 1085 --until=checks-pass
```

**Custom polling interval:**
```
/pr-watch 1085 --interval=15s
```

**Wait for approval:**
```
/pr-watch 1085 --notify-on=reviews --until=approved
```

### Options

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

- Use `--notify-on=checks` when you only care about CI/CD
- Set `--until=checks-pass` to auto-stop when ready for review
- Longer `--interval` values reduce GitHub API usage
- The plugin auto-stops when PR is merged or all conditions are met

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