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

echo "→ Weekly Pulse..."
python3 "$CLAUDE_DIR/skills/weekly-pulse/scripts/generate-pulse.py" --json --last-week \
  > "$DASHBOARD_DIR/data/pulse/$WEEK.json"
echo "  ✓ Saved to data/pulse/$WEEK.json"

echo "→ QA Pulse..."
python3 "$CLAUDE_DIR/skills/bug-catch-rate/scripts/qa-pulse-report.py" --json --dry-run \
  > "$DASHBOARD_DIR/data/qa/$WEEK.json"
echo "  ✓ Saved to data/qa/$WEEK.json"

echo "→ Weekly Tickets..."
python3 "$CLAUDE_DIR/skills/daily-ticket-report/scripts/generate-weekly-report.py" --json --last-week \
  > "$DASHBOARD_DIR/data/tickets/$WEEK.json"
echo "  ✓ Saved to data/tickets/$WEEK.json"

echo "→ DSAT..."
python3 "$CLAUDE_DIR/scripts/analysis/fetch-all-dsat-v3.py" --json \
  > "$DASHBOARD_DIR/data/dsat/$WEEK.json"
echo "  ✓ Saved to data/dsat/$WEEK.json"

echo ""
echo "→ Updating index..."
python3 "$SCRIPT_DIR/update-index.py"

echo ""
echo "✅ Done! Dashboard data for $WEEK generated."
echo "   Files in: $DASHBOARD_DIR/data/"
