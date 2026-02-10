#!/bin/bash

# PR Watch with macOS Notifications
# Usage: pr-watch-notify.sh <PR_NUMBER> [OPTIONS]
#   --interval=30s            Polling interval (default: 30s)
#   --notify-on=all           What to notify: all|checks|reviews|comments (default: all)
#   --until=condition         Stop when: merged|approved|checks-pass|closed
#   --no-desktop              Disable desktop notifications
#   --bell                    Enable terminal bell
#   --jira-ticket=TAK-XXX     Set Jira ticket to "In Review" when checks pass
#   --use-osascript           Force use of osascript instead of terminal-notifier

set -e

# Default values
PR_NUMBER=""
INTERVAL=30
NOTIFY_ON="all"
UNTIL=""
DESKTOP_NOTIFY=true
BELL=false
JIRA_TICKET=""
JIRA_CLOUD_ID="19c32ce6-4e51-4d0a-b67f-114ccbc77255"
FORCE_OSASCRIPT=false

# Check which notification method to use
if command -v terminal-notifier &> /dev/null && [[ "$FORCE_OSASCRIPT" == "false" ]]; then
    NOTIFIER="terminal-notifier"
else
    NOTIFIER="osascript"
fi

# Parse arguments
for arg in "$@"; do
    case $arg in
        --interval=*)
            INTERVAL_STR="${arg#*=}"
            INTERVAL=$(echo "$INTERVAL_STR" | sed 's/s$//')
            ;;
        --notify-on=*)
            NOTIFY_ON="${arg#*=}"
            ;;
        --until=*)
            UNTIL="${arg#*=}"
            ;;
        --no-desktop)
            DESKTOP_NOTIFY=false
            ;;
        --bell)
            BELL=true
            ;;
        --jira-ticket=*)
            JIRA_TICKET="${arg#*=}"
            ;;
        --use-osascript)
            FORCE_OSASCRIPT=true
            NOTIFIER="osascript"
            ;;
        *)
            if [[ -z "$PR_NUMBER" ]]; then
                PR_NUMBER="$arg"
            fi
            ;;
    esac
done

if [[ -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <PR_NUMBER> [OPTIONS]"
    exit 1
fi

LAST_STATE_FILE="/tmp/pr_${PR_NUMBER}_last_state.json"

# Function to send macOS notification
send_notification() {
    local title="$1"
    local message="$2"
    local sound="${3:-default}"
    local icon="${4:-}"

    if ! $DESKTOP_NOTIFY; then
        if $BELL; then
            echo -e "\a"
        fi
        return
    fi

    if [[ "$NOTIFIER" == "terminal-notifier" ]]; then
        # Use terminal-notifier with icons
        local cmd="terminal-notifier -title \"PR #$PR_NUMBER\" -subtitle \"$title\" -message \"$message\" -sound \"$sound\""

        # Add app icon if specified
        if [[ -n "$icon" ]]; then
            cmd="$cmd -appIcon \"$icon\""
        fi

        # Add action button for PR link
        cmd="$cmd -open \"https://github.com/leanix/import-export/pull/$PR_NUMBER\""

        eval "$cmd" 2>/dev/null || true
    else
        # Fallback to osascript
        osascript -e "display notification \"$message\" with title \"PR #$PR_NUMBER\" subtitle \"$title\" sound name \"$sound\"" 2>/dev/null || true
    fi

    if $BELL; then
        echo -e "\a"
    fi
}

# Function to check if notification should be sent
should_notify() {
    local event_type="$1"

    if [[ "$NOTIFY_ON" == "all" ]]; then
        return 0
    fi

    case "$event_type" in
        checks)
            [[ "$NOTIFY_ON" == "checks" ]] && return 0
            ;;
        reviews)
            [[ "$NOTIFY_ON" == "reviews" ]] && return 0
            ;;
        comments)
            [[ "$NOTIFY_ON" == "comments" ]] && return 0
            ;;
    esac

    return 1
}

# Get initial state
echo "🔍 Fetching PR #$PR_NUMBER initial state..."
gh pr view "$PR_NUMBER" --json number,title,state,isDraft,mergeable,statusCheckRollup,reviews,comments,labels,updatedAt > "$LAST_STATE_FILE"

PR_TITLE=$(jq -r '.title' "$LAST_STATE_FILE")
echo "📊 Monitoring: $PR_TITLE"
echo ""

# Send initial notification
echo "Using notification method: $NOTIFIER"
send_notification "Monitoring Started 👀" "$PR_TITLE" "Submarine"

# Check initial state for already completed checks
INITIAL_CHECKS=$(jq -r '.statusCheckRollup | length' "$LAST_STATE_FILE" 2>/dev/null || echo "0")
if [[ "$INITIAL_CHECKS" -gt 0 ]]; then
    ALL_PASSED_INITIAL=true
    PASSED_INITIAL=0

    for i in $(seq 0 $((INITIAL_CHECKS - 1))); do
        CHECK_STATUS=$(jq -r ".statusCheckRollup[$i].status" "$LAST_STATE_FILE")
        CHECK_CONCLUSION=$(jq -r ".statusCheckRollup[$i].conclusion" "$LAST_STATE_FILE")

        if [[ "$CHECK_STATUS" == "COMPLETED" ]] && [[ "$CHECK_CONCLUSION" == "SUCCESS" ]]; then
            PASSED_INITIAL=$((PASSED_INITIAL + 1))
        else
            ALL_PASSED_INITIAL=false
        fi
    done

    if $ALL_PASSED_INITIAL && [[ "$PASSED_INITIAL" -eq "$INITIAL_CHECKS" ]]; then
        echo "✨ All checks already passed! ($PASSED_INITIAL/$INITIAL_CHECKS)"
        send_notification "All Checks Passed! ✨" "$PASSED_INITIAL/$INITIAL_CHECKS checks succeeded" "Glass" "https://github.githubassets.com/favicons/favicon-success.svg"

        # Transition Jira ticket to "In Review" if specified
        if [[ -n "$JIRA_TICKET" ]]; then
            echo "🎫 Setting Jira ticket $JIRA_TICKET to 'In Review'..."
            TRANSITION_RESULT=$(gh api \
                "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$JIRA_TICKET/transitions" \
                -X POST \
                -H "Content-Type: application/json" \
                -f transition[id]=71 2>&1)

            if [[ $? -eq 0 ]]; then
                echo "✅ Jira ticket $JIRA_TICKET moved to 'In Review'"
                send_notification "Jira Updated 🎫" "$JIRA_TICKET moved to In Review" "Hero" "https://leanix.atlassian.net/favicon.ico"
            else
                echo "⚠️  Failed to update Jira ticket: $TRANSITION_RESULT"
                send_notification "Jira Update Failed ⚠️" "Could not move $JIRA_TICKET" "Basso"
            fi
        fi

        if [[ "$UNTIL" == "checks-pass" ]]; then
            echo ""
            echo "🏁 Monitoring stopped for PR #$PR_NUMBER"
            echo "   Reason: checks-pass (initial state)"
            send_notification "Monitoring Stopped 🏁" "Reason: checks-pass (initial)" "Tink" "https://github.githubassets.com/favicons/favicon.svg"
            if $BELL; then
                echo -e "\a\a"
            fi
            rm -f "$LAST_STATE_FILE" /tmp/pr_${PR_NUMBER}_current_state.json
            exit 0
        fi
    fi
fi

MONITORING=true
STOP_REASON=""

while $MONITORING; do
    sleep "$INTERVAL"

    # Get current state
    CURRENT_STATE=$(gh pr view "$PR_NUMBER" --json number,title,state,isDraft,mergeable,statusCheckRollup,reviews,comments,labels,updatedAt 2>/dev/null)

    if [[ -z "$CURRENT_STATE" ]]; then
        echo "⚠️  Failed to fetch PR state, retrying..."
        continue
    fi

    # Save current state to temp file
    echo "$CURRENT_STATE" > /tmp/pr_${PR_NUMBER}_current_state.json

    # Extract values
    LAST_CHECKS=$(jq -r '.statusCheckRollup | length' "$LAST_STATE_FILE" 2>/dev/null || echo "0")
    CURRENT_CHECKS=$(echo "$CURRENT_STATE" | jq -r '.statusCheckRollup | length')

    LAST_REVIEWS=$(jq -r '.reviews | length' "$LAST_STATE_FILE" 2>/dev/null || echo "0")
    CURRENT_REVIEWS=$(echo "$CURRENT_STATE" | jq -r '.reviews | length')

    LAST_COMMENTS=$(jq -r '.comments | length' "$LAST_STATE_FILE" 2>/dev/null || echo "0")
    CURRENT_COMMENTS=$(echo "$CURRENT_STATE" | jq -r '.comments | length')

    LAST_STATE_VALUE=$(jq -r '.state' "$LAST_STATE_FILE" 2>/dev/null || echo "")
    CURRENT_STATE_VALUE=$(echo "$CURRENT_STATE" | jq -r '.state')

    # Check status checks
    if [[ "$CURRENT_CHECKS" -gt 0 ]]; then
        for i in $(seq 0 $((CURRENT_CHECKS - 1))); do
            CURRENT_CHECK_STATUS=$(echo "$CURRENT_STATE" | jq -r ".statusCheckRollup[$i].status")
            CURRENT_CHECK_CONCLUSION=$(echo "$CURRENT_STATE" | jq -r ".statusCheckRollup[$i].conclusion")
            CURRENT_CHECK_NAME=$(echo "$CURRENT_STATE" | jq -r ".statusCheckRollup[$i].name")

            LAST_CHECK_STATUS=$(jq -r ".statusCheckRollup[$i].status" "$LAST_STATE_FILE" 2>/dev/null || echo "")

            # Check for status changes
            if [[ "$LAST_CHECK_STATUS" != "$CURRENT_CHECK_STATUS" ]] && [[ -n "$CURRENT_CHECK_STATUS" ]]; then
                if [[ "$CURRENT_CHECK_STATUS" == "COMPLETED" ]]; then
                    if [[ "$CURRENT_CHECK_CONCLUSION" == "SUCCESS" ]]; then
                        echo "✅ Check completed: $CURRENT_CHECK_NAME - SUCCESS"
                        if should_notify "checks"; then
                            send_notification "Check Passed ✅" "$CURRENT_CHECK_NAME" "Glass" "https://github.githubassets.com/favicons/favicon-success.svg"
                        fi
                    elif [[ "$CURRENT_CHECK_CONCLUSION" == "FAILURE" ]]; then
                        echo "❌ Check failed: $CURRENT_CHECK_NAME - FAILURE"
                        if should_notify "checks"; then
                            send_notification "Check Failed ❌" "$CURRENT_CHECK_NAME" "Basso" "https://github.githubassets.com/favicons/favicon-failure.svg"
                        fi
                    else
                        echo "⚠️  Check completed: $CURRENT_CHECK_NAME - $CURRENT_CHECK_CONCLUSION"
                        if should_notify "checks"; then
                            send_notification "Check Completed ⚠️" "$CURRENT_CHECK_NAME - $CURRENT_CHECK_CONCLUSION" "Funk"
                        fi
                    fi
                elif [[ "$CURRENT_CHECK_STATUS" == "IN_PROGRESS" ]]; then
                    echo "🔄 Check started: $CURRENT_CHECK_NAME"
                fi
            fi
        done
    fi

    # Check for new reviews
    if [[ "$CURRENT_REVIEWS" -gt "$LAST_REVIEWS" ]]; then
        NEW_REVIEW_STATE=$(echo "$CURRENT_STATE" | jq -r '.reviews[-1].state')
        NEW_REVIEW_AUTHOR=$(echo "$CURRENT_STATE" | jq -r '.reviews[-1].author.login')
        echo "👥 New review from $NEW_REVIEW_AUTHOR: $NEW_REVIEW_STATE"

        if should_notify "reviews"; then
            case "$NEW_REVIEW_STATE" in
                APPROVED)
                    send_notification "PR Approved ✅" "Review from $NEW_REVIEW_AUTHOR" "Hero" "https://github.githubassets.com/favicons/favicon-success.svg"
                    ;;
                CHANGES_REQUESTED)
                    send_notification "Changes Requested 🔧" "Review from $NEW_REVIEW_AUTHOR" "Sosumi" "https://github.githubassets.com/favicons/favicon.svg"
                    ;;
                *)
                    send_notification "New Review 💬" "Comment from $NEW_REVIEW_AUTHOR" "Purr" "https://github.githubassets.com/favicons/favicon.svg"
                    ;;
            esac
        fi
    fi

    # Check for new comments
    if [[ "$CURRENT_COMMENTS" -gt "$LAST_COMMENTS" ]]; then
        echo "💬 New comment added to PR"
        if should_notify "comments"; then
            send_notification "New Comment 💬" "Someone commented on the PR" "Pop" "https://github.githubassets.com/favicons/favicon.svg"
        fi
    fi

    # Check PR state changes
    if [[ "$LAST_STATE_VALUE" != "$CURRENT_STATE_VALUE" ]] && [[ -n "$LAST_STATE_VALUE" ]]; then
        if [[ "$CURRENT_STATE_VALUE" == "MERGED" ]]; then
            echo "🎉 PR has been merged!"
            send_notification "PR Merged! 🎉" "$PR_TITLE" "Glass" "https://github.githubassets.com/favicons/favicon-success.svg"
            MONITORING=false
            STOP_REASON="merged"
        elif [[ "$CURRENT_STATE_VALUE" == "CLOSED" ]]; then
            echo "🔒 PR has been closed"
            send_notification "PR Closed 🔒" "$PR_TITLE" "Funk" "https://github.githubassets.com/favicons/favicon.svg"
            MONITORING=false
            STOP_REASON="closed"
        fi
    fi

    # Check if all checks passed
    if [[ "$CURRENT_CHECKS" -gt 0 ]]; then
        ALL_PASSED=true
        PASSED_COUNT=0

        for i in $(seq 0 $((CURRENT_CHECKS - 1))); do
            CHECK_STATUS=$(echo "$CURRENT_STATE" | jq -r ".statusCheckRollup[$i].status")
            CHECK_CONCLUSION=$(echo "$CURRENT_STATE" | jq -r ".statusCheckRollup[$i].conclusion")

            if [[ "$CHECK_STATUS" == "COMPLETED" ]] && [[ "$CHECK_CONCLUSION" == "SUCCESS" ]]; then
                PASSED_COUNT=$((PASSED_COUNT + 1))
            else
                ALL_PASSED=false
            fi
        done

        # Check if this is a new "all passed" state
        LAST_ALL_PASSED=$(jq -r '.statusCheckRollup | map(select(.status == "COMPLETED" and .conclusion == "SUCCESS")) | length' "$LAST_STATE_FILE" 2>/dev/null || echo "0")

        if $ALL_PASSED && [[ "$PASSED_COUNT" -eq "$CURRENT_CHECKS" ]] && [[ "$LAST_ALL_PASSED" -ne "$CURRENT_CHECKS" ]]; then
            echo "✨ All checks passed! ($PASSED_COUNT/$CURRENT_CHECKS)"
            if should_notify "checks"; then
                send_notification "All Checks Passed! ✨" "$PASSED_COUNT/$CURRENT_CHECKS checks succeeded" "Glass" "https://github.githubassets.com/favicons/favicon-success.svg"
            fi

            # Transition Jira ticket to "In Review" if specified
            if [[ -n "$JIRA_TICKET" ]]; then
                echo "🎫 Setting Jira ticket $JIRA_TICKET to 'In Review'..."
                TRANSITION_RESULT=$(gh api \
                    "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$JIRA_TICKET/transitions" \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -f transition[id]=71 2>&1)

                if [[ $? -eq 0 ]]; then
                    echo "✅ Jira ticket $JIRA_TICKET moved to 'In Review'"
                    send_notification "Jira Updated 🎫" "$JIRA_TICKET moved to In Review" "Hero" "https://leanix.atlassian.net/favicon.ico"
                else
                    echo "⚠️  Failed to update Jira ticket: $TRANSITION_RESULT"
                    send_notification "Jira Update Failed ⚠️" "Could not move $JIRA_TICKET" "Basso"
                fi
            fi

            if [[ "$UNTIL" == "checks-pass" ]]; then
                MONITORING=false
                STOP_REASON="checks-pass"
            fi
        fi
    fi

    # Check for approved condition
    if [[ "$UNTIL" == "approved" ]]; then
        APPROVED_COUNT=$(echo "$CURRENT_STATE" | jq -r '[.reviews[] | select(.state == "APPROVED")] | length')
        if [[ "$APPROVED_COUNT" -gt 0 ]]; then
            MONITORING=false
            STOP_REASON="approved"
        fi
    fi

    # Update last state
    echo "$CURRENT_STATE" > "$LAST_STATE_FILE"
done

echo ""
echo "🏁 Monitoring stopped for PR #$PR_NUMBER"
[[ -n "$STOP_REASON" ]] && echo "   Reason: $STOP_REASON"

# Final notification
send_notification "Monitoring Stopped 🏁" "Reason: ${STOP_REASON:-manual}" "Tink" "https://github.githubassets.com/favicons/favicon.svg"

if $BELL; then
    echo -e "\a\a"
fi

# Cleanup
rm -f "$LAST_STATE_FILE" /tmp/pr_${PR_NUMBER}_current_state.json