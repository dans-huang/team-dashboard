#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$(dirname "$SCRIPT_DIR")"
# Default: look for claude workspace two levels up from dashboard
CLAUDE_DIR="${CLAUDE_DIR:-$(dirname "$(dirname "$DASHBOARD_DIR")")}"
WEEK="${1:-$(date -u +%G-W%V)}"

# Compute Monday (start) and Sunday (end) from ISO week
# e.g. 2026-W07 → 2026-02-09 ~ 2026-02-15
WEEK_START=$(python3 -c "
from datetime import datetime, timedelta
year, week = '$WEEK'.split('-W')
# ISO week: Monday of week 1 is the Monday of the week containing Jan 4
jan4 = datetime(int(year), 1, 4)
mon_w1 = jan4 - timedelta(days=jan4.weekday())
monday = mon_w1 + timedelta(weeks=int(week)-1)
print(monday.strftime('%Y-%m-%d'))
")
WEEK_END=$(python3 -c "
from datetime import datetime, timedelta
d = datetime.strptime('$WEEK_START', '%Y-%m-%d')
print((d + timedelta(days=6)).strftime('%Y-%m-%d'))
")

# Source Zendesk credentials if available (DSAT script needs ZENDESK_TOKEN)
ZD_ENV="$CLAUDE_DIR/scripts/automation/.env.zendesk"
if [ -f "$ZD_ENV" ]; then
  # shellcheck disable=SC1090
  source "$ZD_ENV"
  # .env.zendesk uses ZENDESK_API_TOKEN; DSAT script expects ZENDESK_TOKEN
  export ZENDESK_TOKEN="${ZENDESK_TOKEN:-$ZENDESK_API_TOKEN}"
fi

# Refresh Google OAuth token (expires every hour)
REFRESH_SCRIPT="$CLAUDE_DIR/scripts/automation/refresh-google-oauth.py"
if [ -f "$REFRESH_SCRIPT" ]; then
  echo "→ Refreshing Google OAuth token..."
  python3 "$REFRESH_SCRIPT" 2>/dev/null && echo "  ✓ Token refreshed" || echo "  ⚠ Token refresh failed — continuing with existing token"
  echo ""
fi

echo "=== Team Dashboard Data Generator ==="
echo "Week: $WEEK ($WEEK_START ~ $WEEK_END)"
echo "Dashboard: $DASHBOARD_DIR"
echo "Claude workspace: $CLAUDE_DIR"
echo ""

mkdir -p "$DASHBOARD_DIR/data"/{pulse,qa,tickets,dsat,daily}

# Helper: run a script, validate JSON output, skip on empty/invalid
generate() {
  local label="$1" output="$2"; shift 2
  echo "→ $label..."
  local tmp
  tmp=$(mktemp)
  if "$@" > "$tmp" 2>/dev/null; then
    if [ -s "$tmp" ] && python3 -m json.tool "$tmp" > /dev/null 2>&1; then
      mv "$tmp" "$output"
      echo "  ✓ Saved to $(basename "$(dirname "$output")")/$(basename "$output")"
    else
      echo "  ⚠ Script produced empty or invalid JSON — skipped"
      rm -f "$tmp"
    fi
  else
    echo "  ✗ Script failed — skipped"
    rm -f "$tmp"
  fi
}

generate "Weekly Pulse" "$DASHBOARD_DIR/data/pulse/$WEEK.json" \
  python3 "$CLAUDE_DIR/skills/weekly-pulse/scripts/generate-pulse.py" --json --start "$WEEK_START" --end "$WEEK_END"

generate "QA Pulse" "$DASHBOARD_DIR/data/qa/$WEEK.json" \
  python3 "$CLAUDE_DIR/skills/bug-catch-rate/scripts/qa-pulse-report.py" --json --dry-run --end "$WEEK_END"

generate "Weekly Tickets" "$DASHBOARD_DIR/data/tickets/$WEEK.json" \
  python3 "$CLAUDE_DIR/skills/daily-ticket-report/scripts/generate-weekly-report.py" --json --start "$WEEK_START" --end "$WEEK_END"

generate "DSAT" "$DASHBOARD_DIR/data/dsat/$WEEK.json" \
  python3 "$CLAUDE_DIR/scripts/analysis/fetch-all-dsat-v3.py" --json --end "$WEEK_END"

generate "Daily" "$DASHBOARD_DIR/data/daily/$WEEK_START.json" \
  python3 "$DASHBOARD_DIR/scripts/generate-daily-data.py" --json --date "$WEEK_START"

echo ""
echo "→ Updating index..."
python3 "$SCRIPT_DIR/update-index.py"

echo ""
echo "✅ Done! Dashboard data for $WEEK generated."
echo "   Files in: $DASHBOARD_DIR/data/"
