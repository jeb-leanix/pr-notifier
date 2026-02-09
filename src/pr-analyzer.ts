/**
 * PR Analyzer - detects unusual patterns and provides insights
 */

import { PRSnapshot, CheckRun } from "./types.js";

export interface AnalysisInsight {
  type: "warning" | "info" | "tip";
  message: string;
}

export class PRAnalyzer {
  private checkHistory: Map<string, number[]> = new Map(); // Check name -> durations
  private readonly SLOW_CHECK_THRESHOLD = 10 * 60 * 1000; // 10 minutes
  private readonly VERY_SLOW_THRESHOLD = 20 * 60 * 1000; // 20 minutes

  /**
   * Analyze PR and provide insights
   */
  analyze(snapshot: PRSnapshot): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];

    // Analyze check durations
    insights.push(...this.analyzeCheckDurations(snapshot));

    // Analyze review status
    insights.push(...this.analyzeReviewStatus(snapshot));

    // Analyze merge readiness
    insights.push(...this.analyzeMergeReadiness(snapshot));

    return insights;
  }

  /**
   * Record check duration for historical analysis
   */
  recordCheckDuration(checkName: string, duration: number): void {
    if (!this.checkHistory.has(checkName)) {
      this.checkHistory.set(checkName, []);
    }
    this.checkHistory.get(checkName)!.push(duration);

    // Keep only last 10 runs
    const history = this.checkHistory.get(checkName)!;
    if (history.length > 10) {
      history.shift();
    }
  }

  private analyzeCheckDurations(snapshot: PRSnapshot): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];
    const now = Date.now();

    for (const check of snapshot.checks) {
      if (check.status !== "pending" || !check.startedAt) continue;

      const duration = now - new Date(check.startedAt).getTime();

      // Very slow check
      if (duration > this.VERY_SLOW_THRESHOLD) {
        insights.push({
          type: "warning",
          message: `⚠️  ${check.name} is taking unusually long (${this.formatDuration(duration)}). This might indicate an issue.`,
        });
      }
      // Slow check
      else if (duration > this.SLOW_CHECK_THRESHOLD) {
        insights.push({
          type: "info",
          message: `ℹ️  ${check.name} is running for ${this.formatDuration(duration)}`,
        });
      }

      // Compare with historical average
      const historical = this.checkHistory.get(check.name);
      if (historical && historical.length >= 3) {
        const avgDuration = historical.reduce((a, b) => a + b, 0) / historical.length;
        if (duration > avgDuration * 1.5) {
          insights.push({
            type: "warning",
            message: `⚠️  ${check.name} is 50% slower than usual (avg: ${this.formatDuration(avgDuration)})`,
          });
        }
      }
    }

    return insights;
  }

  private analyzeReviewStatus(snapshot: PRSnapshot): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];

    const approvals = snapshot.reviews.filter((r) => r.state === "APPROVED").length;
    const changesRequested = snapshot.reviews.filter((r) => r.state === "CHANGES_REQUESTED").length;
    const reviewers = snapshot.reviewers.length;

    // All checks passed but no reviews
    const allChecksPassed = snapshot.checks.every(
      (c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral"
    );

    if (allChecksPassed && reviewers > 0 && approvals === 0) {
      insights.push({
        type: "tip",
        message: `💡 All checks passed! Ready for review by ${reviewers} reviewer(s).`,
      });
    }

    // Has approvals but checks failing
    if (approvals > 0 && !allChecksPassed) {
      insights.push({
        type: "info",
        message: `ℹ️  PR is approved but checks are still running/failing`,
      });
    }

    // Changes requested
    if (changesRequested > 0) {
      insights.push({
        type: "info",
        message: `🔧 ${changesRequested} reviewer(s) requested changes`,
      });
    }

    return insights;
  }

  private analyzeMergeReadiness(snapshot: PRSnapshot): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];

    const allChecksPassed = snapshot.checks.every(
      (c) => c.conclusion === "success" || c.conclusion === "skipped" || c.conclusion === "neutral"
    );
    const hasApproval = snapshot.reviews.some((r) => r.state === "APPROVED");
    const hasConflicts = snapshot.mergeable === "CONFLICTING";

    // Ready to merge
    if (allChecksPassed && hasApproval && !hasConflicts && !snapshot.isDraft) {
      insights.push({
        type: "info",
        message: `✅ PR is ready to merge! All checks passed and approved.`,
      });
    }

    // Merge conflicts
    if (hasConflicts) {
      insights.push({
        type: "warning",
        message: `⚠️  Merge conflicts detected. Rebase or merge main branch.`,
      });
    }

    // Still draft
    if (snapshot.isDraft && allChecksPassed) {
      insights.push({
        type: "tip",
        message: `💡 All checks passed. Consider marking PR as ready for review.`,
      });
    }

    return insights;
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }
}