/**
 * Jira Integration for automatic ticket transitions
 */
import { execSync } from "child_process";

export interface JiraTicket {
  key: string;
  url: string;
}

export interface JiraActionRequest {
  action: string;
  ticketKey: string;
  targetStatus: string;
  prUrl: string;
  comment: string;
}

export class JiraIntegration {
  private readonly jiraUrl = "https://leanix.atlassian.net";
  private readonly cloudId = "19c32ce6-4e51-4d0a-b67f-114ccbc77255";

  /**
   * Extract Jira ticket key from PR title or branch name
   */
  extractTicketKey(prTitle: string, branchName?: string): string | null {
    // Match patterns like TAK-1680, PROJ-123, etc.
    const pattern = /([A-Z]+-\d+)/;

    // Try branch name first (most reliable)
    if (branchName) {
      const match = branchName.match(pattern);
      if (match) return match[1];
    }

    // Try PR title
    const match = prTitle.match(pattern);
    if (match) return match[1];

    return null;
  }

  /**
   * Get branch name for current PR
   */
  async getBranchName(prNumber: number): Promise<string | null> {
    try {
      const result = execSync(`gh pr view ${prNumber} --json headRefName -q .headRefName`, {
        encoding: "utf-8",
      });
      return result.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Request Jira transition (to be handled by Claude Code via MCP)
   */
  async transitionToReview(ticketKey: string, prUrl: string): Promise<JiraActionRequest> {
    // Output a structured action request for Claude Code to process
    console.log("");
    console.log("═══════════════════════════════════════════");
    console.log("🎫 JIRA ACTION REQUIRED");
    console.log("═══════════════════════════════════════════");
    console.log(`Ticket: ${ticketKey}`);
    console.log(`Action: Transition to Review`);
    console.log(`PR URL: ${prUrl}`);
    console.log(`Status: Pending Claude Code MCP execution`);
    console.log("═══════════════════════════════════════════");
    console.log("");

    return {
      action: "jira-transition",
      ticketKey,
      targetStatus: "Review",
      prUrl,
      comment: `✅ All CI/CD checks passed!\n\nPR ready for review: ${prUrl}`,
    };
  }
}