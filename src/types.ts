/**
 * Type definitions for PR Notifier
 */

export type CheckStatus = "pending" | "success" | "failure" | "neutral" | "cancelled" | "skipped";
export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
export type PRState = "OPEN" | "CLOSED" | "MERGED";

export interface CheckRun {
  name: string;
  status: CheckStatus;
  conclusion: CheckStatus | null;
  startedAt?: string;
  completedAt?: string;
  detailsUrl?: string;
}

export interface Review {
  id: string;
  author: string;
  state: ReviewState;
  submittedAt: string;
  body?: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface PRSnapshot {
  number: number;
  title: string;
  state: PRState;
  isDraft: boolean;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  checks: CheckRun[];
  reviews: Review[];
  comments: Comment[];
  reviewers: string[];
  timestamp: Date;
}

export interface PREvent {
  type: "check" | "review" | "comment" | "status" | "conflict";
  message: string;
  severity: "info" | "success" | "warning" | "error";
  timestamp: Date;
  details?: any;
}

export type NotifyFilter = "all" | "checks" | "reviews" | "comments";
export type UntilCondition = "checks-pass" | "approved" | "merged" | "closed";

export interface WatchOptions {
  prNumber: number;
  notifyOn: NotifyFilter;
  interval: number; // seconds
  until?: UntilCondition;
}