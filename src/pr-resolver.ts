/**
 * PR Resolver - resolves Jira ticket keys to PR numbers
 */

import { execSync } from "child_process";

export interface PRResolution {
  prNumber: number;
  title: string;
  branch: string;
  matchedIn: "branch" | "title" | "body";
}

export class PRResolver {
  /**
   * Resolve a PR identifier (number or Jira key) to PR number
   */
  async resolve(identifier: string): Promise<number> {
    // If it's already a number, return it
    const asNumber = parseInt(identifier, 10);
    if (!isNaN(asNumber)) {
      return asNumber;
    }

    // Try to resolve as Jira ticket key
    const resolution = await this.resolveTicketKey(identifier);
    if (!resolution) {
      throw new Error(`Could not find PR for ticket ${identifier}`);
    }

    return resolution.prNumber;
  }

  /**
   * Resolve multiple identifiers
   */
  async resolveMultiple(identifiers: string[]): Promise<number[]> {
    const resolved: number[] = [];

    for (const identifier of identifiers) {
      try {
        const prNumber = await this.resolve(identifier);
        resolved.push(prNumber);
      } catch (error) {
        throw new Error(`Failed to resolve ${identifier}: ${error}`);
      }
    }

    return resolved;
  }

  /**
   * Resolve Jira ticket key to PR number
   */
  private async resolveTicketKey(ticketKey: string): Promise<PRResolution | null> {
    try {
      // Search for PRs that contain the ticket key
      // Check: branch name, title, and body
      const searchResults = execSync(
        `gh pr list --limit 50 --json number,title,headRefName,body --state all`,
        { encoding: "utf-8" }
      );

      const prs = JSON.parse(searchResults);

      // Normalize ticket key for comparison (case-insensitive)
      const normalizedKey = ticketKey.toUpperCase();

      // Try to find in branch name first (most reliable)
      for (const pr of prs) {
        if (pr.headRefName?.toUpperCase().includes(normalizedKey)) {
          return {
            prNumber: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            matchedIn: "branch",
          };
        }
      }

      // Try title
      for (const pr of prs) {
        if (pr.title?.toUpperCase().includes(normalizedKey)) {
          return {
            prNumber: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            matchedIn: "title",
          };
        }
      }

      // Try body
      for (const pr of prs) {
        if (pr.body?.toUpperCase().includes(normalizedKey)) {
          return {
            prNumber: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            matchedIn: "body",
          };
        }
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to search for PRs: ${error}`);
    }
  }

  /**
   * Get all PRs for a ticket key (in case there are multiple)
   */
  async findAllForTicket(ticketKey: string): Promise<PRResolution[]> {
    try {
      const searchResults = execSync(
        `gh pr list --limit 50 --json number,title,headRefName,body --state all`,
        { encoding: "utf-8" }
      );

      const prs = JSON.parse(searchResults);
      const normalizedKey = ticketKey.toUpperCase();
      const matches: PRResolution[] = [];

      for (const pr of prs) {
        let matchedIn: "branch" | "title" | "body" | null = null;

        if (pr.headRefName?.toUpperCase().includes(normalizedKey)) {
          matchedIn = "branch";
        } else if (pr.title?.toUpperCase().includes(normalizedKey)) {
          matchedIn = "title";
        } else if (pr.body?.toUpperCase().includes(normalizedKey)) {
          matchedIn = "body";
        }

        if (matchedIn) {
          matches.push({
            prNumber: pr.number,
            title: pr.title,
            branch: pr.headRefName,
            matchedIn,
          });
        }
      }

      return matches;
    } catch (error) {
      throw new Error(`Failed to search for PRs: ${error}`);
    }
  }
}