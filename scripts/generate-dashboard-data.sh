#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$(dirname "$SCRIPT_DIR")"
# Default: look for claude workspace two levels up from dashboard
CLAUDE_DIR="${CLAUDE_DIR:-$(dirname "$(dirname "$DASHBOARD_DIR")")}"
WEEK="${1:-$(date -u +%G-W%V)}"

echo "=== Team Dashboard Data Generator ==="
echo "Week: $WEEK"
echo "Dashboard: $DASHBOARD_DIR"
echo "Claude workspace: $CLAUDE_DIR"
echo ""

mkdir -p "$DASHBOARD_DIR/data"/{pulse,qa,tickets,dsat}

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
  python3 "$CLAUDE_DIR/skills/weekly-pulse/scripts/generate-pulse.py" --json --last-week

generate "QA Pulse" "$DASHBOARD_DIR/data/qa/$WEEK.json" \
  python3 "$CLAUDE_DIR/skills/bug-catch-rate/scripts/qa-pulse-report.py" --json --dry-run

generate "Weekly Tickets" "$DASHBOARD_DIR/data/tickets/$WEEK.json" \
  python3 "$CLAUDE_DIR/skills/daily-ticket-report/scripts/generate-weekly-report.py" --json --last-week

generate "DSAT" "$DASHBOARD_DIR/data/dsat/$WEEK.json" \
  python3 "$CLAUDE_DIR/scripts/analysis/fetch-all-dsat-v3.py" --json

echo ""
echo "→ Updating index..."
python3 "$SCRIPT_DIR/update-index.py"

echo ""
echo "✅ Done! Dashboard data for $WEEK generated."
echo "   Files in: $DASHBOARD_DIR/data/"
