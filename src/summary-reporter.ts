/**
 * Generates summary reports for PR monitoring sessions
 */

import { PRSnapshot, PREvent } from "./types.js";

export interface SummaryStats {
  duration: number; // milliseconds
  totalEvents: number;
  checksCompleted: number;
  checksSucceeded: number;
  checksFailed: number;
  reviewsReceived: number;
  commentsAdded: number;
  finalState: string;
  reviewers: string[];
  averageCheckTime?: number;
  longestCheck?: { name: string; duration: number };
}

export class SummaryReporter {
  private startTime: Date;
  private events: PREvent[] = [];
  private checkStartTimes: Map<string, Date> = new Map();
  private checkDurations: Map<string, number> = new Map();

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record an event
   */
  recordEvent(event: PREvent): void {
    this.events.push(event);

    // Track check timings
    if (event.type === "check" && event.details) {
      const checkName = event.details.name;

      // Check started
      if (event.message.includes("started")) {
        this.checkStartTimes.set(checkName, new Date());
      }

      // Check completed
      if (
        (event.message.includes("success") || event.message.includes("failure")) &&
        this.checkStartTimes.has(checkName)
      ) {
        const startTime = this.checkStartTimes.get(checkName)!;
        const duration = new Date().getTime() - startTime.getTime();
        this.checkDurations.set(checkName, duration);
      }
    }
  }

  /**
   * Generate summary report
   */
  generateSummary(finalSnapshot: PRSnapshot): string {
    const stats = this.calculateStats(finalSnapshot);
    const lines: string[] = [];

    lines.push("");
    lines.push("═══════════════════════════════════════════");
    lines.push(`📊 PR #${finalSnapshot.number} Summary`);
    lines.push("═══════════════════════════════════════════");
    lines.push("");

    // Duration
    lines.push(`⏱️  Duration: ${this.formatDuration(stats.duration)}`);
    lines.push(`📅 Started: ${this.startTime.toLocaleTimeString()}`);
    lines.push(`🏁 Finished: ${new Date().toLocaleTimeString()}`);
    lines.push("");

    // Checks summary
    lines.push("🔍 CI/CD Checks:");
    lines.push(`   ✅ Succeeded: ${stats.checksSucceeded}`);
    if (stats.checksFailed > 0) {
      lines.push(`   ❌ Failed: ${stats.checksFailed}`);
    }
    lines.push(`   📊 Total: ${stats.checksCompleted}`);
    if (stats.averageCheckTime) {
      lines.push(`   ⚡ Average time: ${this.formatDuration(stats.averageCheckTime)}`);
    }
    if (stats.longestCheck) {
      lines.push(`   🐢 Longest: ${stats.longestCheck.name} (${this.formatDuration(stats.longestCheck.duration)})`);
    }
    lines.push("");

    // Reviews
    if (stats.reviewsReceived > 0) {
      lines.push("👥 Reviews:");
      lines.push(`   📝 Reviews received: ${stats.reviewsReceived}`);
      if (stats.reviewers.length > 0) {
        lines.push(`   👤 Reviewers: ${stats.reviewers.join(", ")}`);
      }
      lines.push("");
    }

    // Comments
    if (stats.commentsAdded > 0) {
      lines.push(`💬 Comments: ${stats.commentsAdded} new comments`);
      lines.push("");
    }

    // Final state
    lines.push(`🎯 Final State: ${stats.finalState}`);
    lines.push(`📌 Total Events: ${stats.totalEvents}`);
    lines.push("");
    lines.push("═══════════════════════════════════════════");

    return lines.join("\n");
  }

  /**
   * Generate compact summary (for notifications)
   */
  generateCompactSummary(finalSnapshot: PRSnapshot): string {
    const stats = this.calculateStats(finalSnapshot);
    const parts: string[] = [];

    parts.push(`Duration: ${this.formatDuration(stats.duration)}`);

    if (stats.checksSucceeded > 0) {
      parts.push(`✅ ${stats.checksSucceeded} checks passed`);
    }

    if (stats.checksFailed > 0) {
      parts.push(`❌ ${stats.checksFailed} failed`);
    }

    if (stats.reviewsReceived > 0) {
      parts.push(`👥 ${stats.reviewsReceived} reviews`);
    }

    return parts.join(" • ");
  }

  private calculateStats(finalSnapshot: PRSnapshot): SummaryStats {
    const duration = new Date().getTime() - this.startTime.getTime();

    const checkEvents = this.events.filter((e) => e.type === "check");
    const reviewEvents = this.events.filter((e) => e.type === "review");
    const commentEvents = this.events.filter((e) => e.type === "comment");

    const checksSucceeded = checkEvents.filter((e) => e.message.includes("success")).length;
    const checksFailed = checkEvents.filter((e) => e.message.includes("failure")).length;

    // Calculate average check time
    let averageCheckTime: number | undefined;
    let longestCheck: { name: string; duration: number } | undefined;

    if (this.checkDurations.size > 0) {
      const durations = Array.from(this.checkDurations.values());
      averageCheckTime = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Find longest check
      let maxDuration = 0;
      let maxName = "";
      for (const [name, duration] of this.checkDurations.entries()) {
        if (duration > maxDuration) {
          maxDuration = duration;
          maxName = name;
        }
      }
      if (maxName) {
        longestCheck = { name: maxName, duration: maxDuration };
      }
    }

    return {
      duration,
      totalEvents: this.events.length,
      checksCompleted: finalSnapshot.checks.length,
      checksSucceeded,
      checksFailed,
      reviewsReceived: reviewEvents.length,
      commentsAdded: commentEvents.length,
      finalState: this.formatFinalState(finalSnapshot),
      reviewers: finalSnapshot.reviews.map((r) => r.author).filter((v, i, a) => a.indexOf(v) === i),
      averageCheckTime,
      longestCheck,
    };
  }

  private formatFinalState(snapshot: PRSnapshot): string {
    if (snapshot.state === "MERGED") return "🎉 Merged";
    if (snapshot.state === "CLOSED") return "🚫 Closed";

    const allChecksPassed = snapshot.checks.every(
      (c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral"
    );

    const hasApproval = snapshot.reviews.some((r) => r.state === "APPROVED");

    if (allChecksPassed && hasApproval) return "✅ Ready to merge";
    if (allChecksPassed) return "✅ All checks passed";
    if (hasApproval) return "👍 Approved (checks pending)";

    return "⏳ In progress";
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }

    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${seconds}s`;
  }
}