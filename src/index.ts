#!/usr/bin/env node

/**
 * PR Notifier Skill for Claude
 *
 * Monitors GitHub PRs for CI/CD checks, reviews, and comments
 */

import { PRFetcher } from "./pr-fetcher.js";
import { EventDetector } from "./event-detector.js";
import { Notifier } from "./notifier.js";
import { SummaryReporter } from "./summary-reporter.js";
import { MultiPRWatcher } from "./multi-pr-watcher.js";
import { RetryHandler } from "./retry-handler.js";
import { PRAnalyzer } from "./pr-analyzer.js";
import { PRResolver } from "./pr-resolver.js";
import { JiraIntegration } from "./jira-integration.js";
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
  prIdentifiers: string,
  options: {
    notifyOn?: NotifyFilter;
    interval?: string;
    until?: UntilCondition;
    desktop?: boolean;
    bell?: boolean;
    noJiraTransition?: boolean;
  } = {}
): Promise<string> {
  // Parse identifiers (supports comma-separated list)
  const identifierList = prIdentifiers.split(",").map((id) => id.trim());

  // Resolve identifiers to PR numbers (handles both numbers and Jira keys)
  const resolver = new PRResolver();
  let prNumberList: number[];

  try {
    prNumberList = await resolver.resolveMultiple(identifierList);
  } catch (error) {
    return `❌ Failed to resolve PR identifier(s): ${error}`;
  }

  // Show resolution info if Jira keys were used
  const output: string[] = [];
  const hasJiraKeys = identifierList.some((id) => isNaN(parseInt(id, 10)));
  if (hasJiraKeys) {
    output.push("🔍 Resolved:");
    for (let i = 0; i < identifierList.length; i++) {
      if (identifierList[i] !== prNumberList[i].toString()) {
        output.push(`   ${identifierList[i]} → PR #${prNumberList[i]}`);
      }
    }
    output.push("");
  }

  // Multi-PR mode
  if (prNumberList.length > 1) {
    const result = await executeMultiPR(prNumberList, options);
    return output.concat(result).join("\n");
  }

  // Single PR mode
  const watchOptions: WatchOptions = {
    prNumber: prNumberList[0],
    notifyOn: options.notifyOn || "all",
    interval: parseInterval(options.interval || "30s"),
    until: options.until,
  };

  try {
    const fetcher = new PRFetcher();
    const detector = new EventDetector();
    const notifier = new Notifier({
      desktop: options.desktop ?? false,
      terminal: options.bell ?? false,
    });
    const summaryReporter = new SummaryReporter();
    const retryHandler = new RetryHandler();
    const analyzer = new PRAnalyzer();

    let previousSnapshot: PRSnapshot | null = null;
    let iteration = 0;
    const maxIterations = 200; // Prevent infinite loops (200 * 30s = 100 minutes max)
    const heartbeatInterval = 10; // Send heartbeat every N iterations
    let lastHeartbeat = Date.now();

    output.push(`🔍 Watching PR #${watchOptions.prNumber}`);
    output.push(`📊 Notify on: ${watchOptions.notifyOn}`);
    output.push(`⏱️  Polling interval: ${watchOptions.interval}s`);
    if (watchOptions.until) {
      output.push(`🎯 Until: ${watchOptions.until}`);
    }
    if (options.desktop || options.bell) {
      const notifyTypes: string[] = [];
      if (options.desktop) notifyTypes.push("desktop");
      if (options.bell) notifyTypes.push("terminal");
      output.push(`🔔 Notifications: ${notifyTypes.join(", ")}`);
    }
    output.push("");

    while (iteration < maxIterations) {
      try {
        // Fetch current state with retry logic
        const currentSnapshot = await retryHandler.execute(
          () => fetcher.fetch(watchOptions.prNumber),
          `Fetching PR #${watchOptions.prNumber}`
        );

        // Detect changes
        const events = detector.detectChanges(previousSnapshot, currentSnapshot);

        // Filter events based on notify preferences
        const filteredEvents = filterEvents(events, watchOptions.notifyOn);

        // Report events and send notifications
        for (const event of filteredEvents) {
          const formattedEvent = formatEvent(event);
          output.push(formattedEvent);
          summaryReporter.recordEvent(event);
          notifier.notify(event, watchOptions.prNumber);
        }

        // Analyze PR and provide insights (every 5 iterations)
        if (iteration % 5 === 0 && iteration > 0) {
          const insights = analyzer.analyze(currentSnapshot);
          for (const insight of insights) {
            output.push(`   ${insight.message}`);
          }
        }

        // Send heartbeat (every N iterations)
        if (iteration > 0 && iteration % heartbeatInterval === 0) {
          const now = Date.now();
          const elapsedMinutes = Math.floor((now - lastHeartbeat) / 60000);
          if (elapsedMinutes > 0) {
            output.push(`💓 Still watching PR #${watchOptions.prNumber} (${elapsedMinutes}m since last check)`);
            lastHeartbeat = now;
          }
        }

        // Check if we should stop watching
        if (watchOptions.until && shouldStopWatching(currentSnapshot, watchOptions.until)) {
          output.push("");
          output.push(`✅ Condition met: ${watchOptions.until}`);

          // Auto-transition Jira ticket if checks passed (unless disabled)
          if (watchOptions.until === "checks-pass" && !options.noJiraTransition) {
            await handleJiraTransition(currentSnapshot, watchOptions.prNumber, output);
          }

          output.push("Stopping watch.");

          // Generate summary
          const summary = summaryReporter.generateSummary(currentSnapshot);
          output.push(summary);

          // Send summary notification
          const compactSummary = summaryReporter.generateCompactSummary(currentSnapshot);
          notifier.notifySummary(compactSummary, watchOptions.prNumber);

          break;
        }

        previousSnapshot = currentSnapshot;
        iteration++;

        // If no more changes expected, break
        if (iteration > 0 && filteredEvents.length === 0 && shouldAutoStop(currentSnapshot)) {
          output.push("");
          output.push("ℹ️  No more activity detected. Stopping watch.");

          // Generate summary
          const summary = summaryReporter.generateSummary(currentSnapshot);
          output.push(summary);

          // Send summary notification
          const compactSummary = summaryReporter.generateCompactSummary(currentSnapshot);
          notifier.notifySummary(compactSummary, watchOptions.prNumber);

          break;
        }

        // Wait before next poll
        if (iteration < maxIterations) {
          await sleep(watchOptions.interval * 1000);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        output.push(`⚠️  Error: ${errorMessage}`);

        // Send critical error notification
        notifier.notifyError(
          `PR Watcher Error`,
          `Failed to monitor PR #${watchOptions.prNumber}: ${errorMessage}`,
          watchOptions.prNumber
        );

        // Check retry health
        const health = retryHandler.getHealthStatus();
        if (health === "unhealthy") {
          output.push(`⚠️  Connection unhealthy after ${retryHandler.getFailureCount()} failures. Stopping watch.`);

          // Send final error notification
          notifier.notifyError(
            `PR Watcher Stopped`,
            `Connection unhealthy after ${retryHandler.getFailureCount()} failures. PR #${watchOptions.prNumber}`,
            watchOptions.prNumber
          );

          break;
        }
      }
    }

    if (iteration >= maxIterations) {
      output.push("");
      output.push("⚠️  Max monitoring duration reached. Stopping watch.");

      if (previousSnapshot) {
        const summary = summaryReporter.generateSummary(previousSnapshot);
        output.push(summary);
      }
    }

    return output.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = `❌ Error watching PR: ${errorMessage}\n\nPlease ensure:\n- GitHub CLI (gh) is installed and authenticated\n- You have access to the repository\n- The PR number is correct`;

    // Send critical error notification for unexpected failures
    const notifier = new Notifier({
      desktop: options.desktop ?? false,
      terminal: options.bell ?? false,
    });
    notifier.notifyError(
      `PR Watcher Crashed`,
      `Unexpected error for PR #${watchOptions.prNumber}: ${errorMessage}`,
      watchOptions.prNumber
    );

    return errorDetails;
  }
}

/**
 * Handle Jira ticket transition when checks pass
 */
async function handleJiraTransition(snapshot: PRSnapshot, prNumber: number, output: string[]): Promise<any> {
  try {
    const jira = new JiraIntegration();

    // Get branch name
    const branchName = await jira.getBranchName(prNumber);

    // Extract Jira ticket key
    const ticketKey = jira.extractTicketKey(snapshot.title, branchName || undefined);

    if (!ticketKey) {
      output.push("ℹ️  No Jira ticket found in PR title or branch name");
      return null;
    }

    // Get PR URL
    const prUrl = `https://github.com/leanix/import-export/pull/${prNumber}`;

    // Request Jira transition (returns action object for Claude Code to handle)
    const actionRequest = await jira.transitionToReview(ticketKey, prUrl);

    output.push(`✅ Jira action requested: ${ticketKey} → Review`);

    return actionRequest;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.push(`⚠️  Jira transition failed: ${errorMessage}`);
    return null;
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
 * Execute multi-PR watch
 */
async function executeMultiPR(
  prNumbers: number[],
  options: {
    notifyOn?: NotifyFilter;
    interval?: string;
    desktop?: boolean;
    bell?: boolean;
    noJiraTransition?: boolean;
  }
): Promise<string> {
  const output: string[] = [];
  const watcher = new MultiPRWatcher();
  const notifier = new Notifier({
    desktop: options.desktop ?? false,
    terminal: options.bell ?? false,
  });
  const retryHandler = new RetryHandler();
  const interval = parseInterval(options.interval || "30s");
  const notifyOn = options.notifyOn || "all";

  output.push(`🔍 Watching ${prNumbers.length} PRs: #${prNumbers.join(", #")}`);
  output.push(`📊 Notify on: ${notifyOn}`);
  output.push(`⏱️  Polling interval: ${interval}s`);
  if (options.desktop || options.bell) {
    const notifyTypes: string[] = [];
    if (options.desktop) notifyTypes.push("desktop");
    if (options.bell) notifyTypes.push("terminal");
    output.push(`🔔 Notifications: ${notifyTypes.join(", ")}`);
  }
  output.push("");

  watcher.initialize(prNumbers);

  let iteration = 0;
  const maxIterations = 200;

  while (iteration < maxIterations) {
    try {
      // Fetch all PRs with retry
      const allEvents = await retryHandler.execute(
        () => watcher.fetchAll(),
        "Fetching all PRs"
      );

      // Report events for each PR
      for (const [prNumber, events] of allEvents.entries()) {
        const filteredEvents = filterEvents(events, notifyOn);
        for (const event of filteredEvents) {
          const formattedEvent = `PR #${prNumber}: ${event.message}`;
          output.push(formatEvent({ ...event, message: formattedEvent }));
          notifier.notify(event, prNumber);
        }
      }

      // Check if all PRs are complete
      if (watcher.areAllComplete()) {
        output.push("");
        output.push("✅ All PRs complete!");
        output.push(watcher.getSummary());
        notifier.notifySummary("All PRs complete!", prNumbers[0]);
        break;
      }

      iteration++;

      // Wait before next poll
      if (iteration < maxIterations) {
        await sleep(interval * 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.push(`⚠️  Error: ${errorMessage}`);

      // Send error notification for multi-PR watch
      notifier.notifyError(
        `Multi-PR Watcher Error`,
        `Failed to monitor PRs: ${errorMessage}`,
        prNumbers[0]
      );

      const health = retryHandler.getHealthStatus();
      if (health === "unhealthy") {
        output.push(`⚠️  Connection unhealthy. Stopping watch.`);

        // Send final error notification
        notifier.notifyError(
          `Multi-PR Watcher Stopped`,
          `Connection unhealthy. Monitoring stopped.`,
          prNumbers[0]
        );

        break;
      }
    }
  }

  if (iteration >= maxIterations) {
    output.push("");
    output.push("⚠️  Max monitoring duration reached.");
    output.push(watcher.getSummary());
  }

  return output.join("\n");
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
  /pr-watch <PR-NUMBER|JIRA-KEY[,...]> [options]

Arguments:
  <PR-NUMBER|JIRA-KEY>  PR number (1085) or Jira ticket (TAK-1674)
                        Supports comma-separated list for multiple PRs

Options:
  --notify-on=<all|checks|reviews|comments>  Filter notifications (default: all)
  --interval=<30s|1m|etc>                    Polling interval (default: 30s)
  --until=<checks-pass|approved|merged>      Stop condition
  --desktop                                  Enable macOS desktop notifications
  --bell                                     Enable terminal bell/beep
  --no-jira-transition                       Disable automatic Jira ticket transition

Examples:
  /pr-watch TAK-1674
  /pr-watch 1085 --notify-on=checks --desktop
  /pr-watch TAK-1674 --until=checks-pass --interval=15s --bell
  /pr-watch 1085,TAK-1256,1087 --notify-on=checks --desktop
  /pr-watch TAK-1674 --until=checks-pass --no-jira-transition
`);
    process.exit(0);
  }

  console.log("This skill must be run within Claude Code.");
  console.log("Usage: Ask Claude to run '/pr-watch 1085'");
  process.exit(1);
}