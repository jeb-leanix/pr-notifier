/**
 * Fetches PR data from GitHub using gh CLI
 */

import { execSync } from "child_process";
import { PRSnapshot, CheckRun, Review, Comment, CheckStatus, ReviewState } from "./types.js";

export class PRFetcher {
  /**
   * Fetch current PR state from GitHub
   */
  async fetch(prNumber: number): Promise<PRSnapshot> {
    try {
      // Fetch PR details
      const prData = JSON.parse(
        execSync(`gh pr view ${prNumber} --json number,title,state,isDraft,mergeable,reviewRequests`, {
          encoding: "utf-8",
        })
      );

      // Fetch check runs
      const checksData = JSON.parse(
        execSync(`gh pr view ${prNumber} --json statusCheckRollup`, {
          encoding: "utf-8",
        })
      );

      // Fetch reviews
      const reviewsData = JSON.parse(
        execSync(`gh api repos/{owner}/{repo}/pulls/${prNumber}/reviews`, {
          encoding: "utf-8",
        })
      );

      // Fetch comments
      const commentsData = JSON.parse(
        execSync(`gh api repos/{owner}/{repo}/issues/${prNumber}/comments`, {
          encoding: "utf-8",
        })
      );

      return {
        number: prData.number,
        title: prData.title,
        state: prData.state,
        isDraft: prData.isDraft,
        mergeable: prData.mergeable,
        checks: this.parseChecks(checksData.statusCheckRollup),
        reviews: this.parseReviews(reviewsData),
        comments: this.parseComments(commentsData),
        reviewers: prData.reviewRequests?.map((r: any) => r.login) || [],
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch PR ${prNumber}: ${error}`);
    }
  }

  private parseChecks(rollup: any[]): CheckRun[] {
    if (!rollup) return [];

    return rollup
      .filter((item) => item.__typename === "CheckRun" || item.__typename === "StatusContext")
      .map((check) => ({
        name: check.name || check.context,
        status: (check.status || check.state)?.toLowerCase() as CheckStatus,
        conclusion: check.conclusion?.toLowerCase() as CheckStatus | null,
        startedAt: check.startedAt,
        completedAt: check.completedAt,
        detailsUrl: check.detailsUrl || check.targetUrl,
      }));
  }

  private parseReviews(reviews: any[]): Review[] {
    if (!reviews) return [];

    return reviews.map((review) => ({
      id: review.id.toString(),
      author: review.user?.login || "unknown",
      state: review.state as ReviewState,
      submittedAt: review.submitted_at,
      body: review.body,
    }));
  }

  private parseComments(comments: any[]): Comment[] {
    if (!comments) return [];

    return comments.map((comment) => ({
      id: comment.id.toString(),
      author: comment.user?.login || "unknown",
      body: comment.body,
      createdAt: comment.created_at,
      url: comment.html_url,
    }));
  }
}