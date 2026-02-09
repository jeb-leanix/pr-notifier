#!/usr/bin/env node

/**
 * PR Notifier Skill for Claude
 *
 * Monitors GitHub PRs for CI/CD checks, reviews, and comments
 */

import { PRFetcher } from "./pr-fetcher.js";
import { EventDetector } from "./event-detector.js";
import { WatchOptions, NotifyFilter, UntilCondition, PRSnapshot, PREvent } from "./types.js";

interface SkillContext {
  mcp?: {
    callTool(serverName: string, toolName: string, args: any): Promise<any>;
  };
}

/**
 * Main skill execution function
 */
export async function execute(
  context: SkillContext,
  prNumber: string,
  options: {
    notifyOn?: NotifyFilter;
    interval?: string;
    until?: UntilCondition;
  } = {}
): Promise<string> {
  const watchOptions: WatchOptions = {
    prNumber: parseInt(prNumber, 10),
    notifyOn: options.notifyOn || "all",
    interval: parseInterval(options.interval || "30s"),
    until: options.until,
  };

  if (isNaN(watchOptions.prNumber)) {
    return `❌ Invalid PR number: ${prNumber}`;
  }

  try {
    const fetcher = new PRFetcher();
    const detector = new EventDetector();

    let previousSnapshot: PRSnapshot | null = null;
    let iteration = 0;
    const maxIterations = 200; // Prevent infinite loops (200 * 30s = 100 minutes max)

    const output: string[] = [];

    output.push(`🔍 Watching PR #${watchOptions.prNumber}`);
    output.push(`📊 Notify on: ${watchOptions.notifyOn}`);
    output.push(`⏱️  Polling interval: ${watchOptions.interval}s`);
    if (watchOptions.until) {
      output.push(`🎯 Until: ${watchOptions.until}`);
    }
    output.push("");

    while (iteration < maxIterations) {
      try {
        // Fetch current state
        const currentSnapshot = await fetcher.fetch(watchOptions.prNumber);

        // Detect changes
        const events = detector.detectChanges(previousSnapshot, currentSnapshot);

        // Filter events based on notify preferences
        const filteredEvents = filterEvents(events, watchOptions.notifyOn);

        // Report events
        for (const event of filteredEvents) {
          output.push(formatEvent(event));
        }

        // Check if we should stop watching
        if (watchOptions.until && shouldStopWatching(currentSnapshot, watchOptions.until)) {
          output.push("");
          output.push(`✅ Condition met: ${watchOptions.until}`);
          output.push("Stopping watch.");
          break;
        }

        previousSnapshot = currentSnapshot;
        iteration++;

        // If no more changes expected, break
        if (iteration > 0 && filteredEvents.length === 0 && shouldAutoStop(currentSnapshot)) {
          output.push("");
          output.push("ℹ️  No more activity detected. Stopping watch.");
          break;
        }

        // Wait before next poll
        if (iteration < maxIterations) {
          await sleep(watchOptions.interval * 1000);
        }
      } catch (error) {
        output.push(`⚠️  Error fetching PR data: ${error}`);
        break;
      }
    }

    if (iteration >= maxIterations) {
      output.push("");
      output.push("⚠️  Max monitoring duration reached. Stopping watch.");
    }

    return output.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `❌ Error watching PR: ${errorMessage}\n\nPlease ensure:\n- GitHub CLI (gh) is installed and authenticated\n- You have access to the repository\n- The PR number is correct`;
  }
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(s|m)?$/);
  if (!match) return 30;

  const value = parseInt(match[1], 10);
  const unit = match[2] || "s";

  return unit === "m" ? value * 60 : value;
}

function filterEvents(events: PREvent[], filter: NotifyFilter): PREvent[] {
  if (filter === "all") return events;

  return events.filter((event) => {
    if (filter === "checks") return event.type === "check";
    if (filter === "reviews") return event.type === "review";
    if (filter === "comments") return event.type === "comment";
    return true;
  });
}

function formatEvent(event: PREvent): string {
  const timestamp = event.timestamp.toLocaleTimeString();
  return `[${timestamp}] ${event.message}`;
}

function shouldStopWatching(snapshot: PRSnapshot, condition: UntilCondition): boolean {
  switch (condition) {
    case "checks-pass":
      return snapshot.checks.every(
        (c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral"
      );
    case "approved":
      return snapshot.reviews.some((r) => r.state === "APPROVED");
    case "merged":
      return snapshot.state === "MERGED";
    case "closed":
      return snapshot.state === "CLOSED" || snapshot.state === "MERGED";
    default:
      return false;
  }
}

function shouldAutoStop(snapshot: PRSnapshot): boolean {
  // Auto-stop if PR is merged or closed
  if (snapshot.state === "MERGED" || snapshot.state === "CLOSED") {
    return true;
  }

  // Auto-stop if all checks passed and there are reviews
  const allChecksPassed = snapshot.checks.every(
    (c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral"
  );
  const hasApproval = snapshot.reviews.some((r) => r.state === "APPROVED");

  return allChecksPassed && hasApproval;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CLI interface for direct execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log(`
PR Notifier - GitHub PR Observer

Usage:
  /pr-watch <PR-NUMBER> [options]

Options:
  --notify-on=<all|checks|reviews|comments>  Filter notifications (default: all)
  --interval=<30s|1m|etc>                    Polling interval (default: 30s)
  --until=<checks-pass|approved|merged>      Stop condition

Examples:
  /pr-watch 1085
  /pr-watch 1085 --notify-on=checks
  /pr-watch 1085 --until=checks-pass --interval=15s
`);
    process.exit(0);
  }

  console.log("This skill must be run within Claude Code.");
  console.log("Usage: Ask Claude to run '/pr-watch 1085'");
  process.exit(1);
}