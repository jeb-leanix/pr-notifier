/**
 * Notification system - Desktop and Terminal notifications
 */

import { execSync } from "child_process";
import { PREvent } from "./types.js";

export interface NotificationOptions {
  desktop: boolean;
  terminal: boolean;
}

export class Notifier {
  constructor(private options: NotificationOptions) {}

  /**
   * Send notification for an event
   */
  notify(event: PREvent, prNumber: number): void {
    if (this.options.desktop) {
      this.sendDesktopNotification(event, prNumber);
    }

    if (this.options.terminal) {
      this.sendTerminalBell(event);
    }
  }

  /**
   * Send macOS desktop notification
   */
  private sendDesktopNotification(event: PREvent, prNumber: number): void {
    try {
      // Use osascript to trigger macOS Notification Center
      const title = `PR #${prNumber}`;
      const message = event.message.replace(/[🔄✅❌⚠️💬🎯🔧👀🎉🚫]/g, "").trim();
      const sound = this.getSoundForSeverity(event.severity);

      const script = `display notification "${this.escapeForAppleScript(message)}" with title "${title}" sound name "${sound}"`;

      execSync(`osascript -e '${script}'`, { stdio: "ignore" });
    } catch (error) {
      // Silently fail - notifications are not critical
      console.warn("Failed to send desktop notification:", error);
    }
  }

  /**
   * Send terminal bell/beep
   */
  private sendTerminalBell(event: PREvent): void {
    // Only beep for important events
    if (event.severity === "success" || event.severity === "error") {
      process.stdout.write("\x07"); // ASCII bell character
    }
  }

  /**
   * Get system sound based on severity
   */
  private getSoundForSeverity(severity: string): string {
    switch (severity) {
      case "success":
        return "Glass"; // Success sound
      case "error":
        return "Basso"; // Error sound
      case "warning":
        return "Ping"; // Warning sound
      default:
        return "default"; // Default notification sound
    }
  }

  /**
   * Escape string for AppleScript
   */
  private escapeForAppleScript(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\\/g, "\\\\");
  }

  /**
   * Send summary notification
   */
  notifySummary(summary: string, prNumber: number): void {
    if (this.options.desktop) {
      try {
        const script = `display notification "${this.escapeForAppleScript(summary)}" with title "PR #${prNumber} Complete" sound name "Glass"`;
        execSync(`osascript -e '${script}'`, { stdio: "ignore" });
      } catch (error) {
        console.warn("Failed to send summary notification:", error);
      }
    }

    if (this.options.terminal) {
      process.stdout.write("\x07\x07"); // Double beep for completion
    }
  }

  /**
   * Send error notification (always sends, regardless of options)
   * This is for critical errors that need user attention
   */
  notifyError(title: string, message: string, prNumber: number): void {
    // Desktop notification for errors (always show if enabled)
    if (this.options.desktop) {
      try {
        const cleanMessage = message.replace(/[🔄✅❌⚠️💬🎯🔧👀🎉🚫]/g, "").trim();
        const script = `display notification "${this.escapeForAppleScript(cleanMessage)}" with title "⚠️ ${title}" sound name "Basso"`;
        execSync(`osascript -e '${script}'`, { stdio: "ignore" });
      } catch (error) {
        console.warn("Failed to send error notification:", error);
      }
    }

    // Terminal bell for errors (always if terminal is enabled)
    if (this.options.terminal) {
      process.stdout.write("\x07\x07\x07"); // Triple beep for errors
    }

    // Also log to console for debugging
    console.error(`[PR Watcher] ${title}: ${message}`);
  }
}