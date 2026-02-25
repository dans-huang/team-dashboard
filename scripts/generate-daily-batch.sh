#!/usr/bin/env bash
set -euo pipefail

# Generate daily data for a range of dates
# Usage: ./generate-daily-batch.sh 2026-02-01 2026-02-25

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$(dirname "$SCRIPT_DIR")"
CLAUDE_DIR="${CLAUDE_DIR:-$(dirname "$(dirname "$DASHBOARD_DIR")")}"

START_DATE="${1:?Usage: $0 START_DATE END_DATE}"
END_DATE="${2:?Usage: $0 START_DATE END_DATE}"

# Source Zendesk credentials
ZD_ENV="$CLAUDE_DIR/scripts/automation/.env.zendesk"
if [ -f "$ZD_ENV" ]; then
  source "$ZD_ENV"
  export ZENDESK_TOKEN="${ZENDESK_TOKEN:-$ZENDESK_API_TOKEN}"
fi

mkdir -p "$DASHBOARD_DIR/data/daily"

echo "=== Batch Daily Data Generation ==="
echo "Range: $START_DATE ~ $END_DATE"
echo ""

current="$START_DATE"
success=0
fail=0

while [[ "$current" < "$END_DATE" || "$current" == "$END_DATE" ]]; do
  output="$DASHBOARD_DIR/data/daily/$current.json"

  if [ -f "$output" ] && [ "$(wc -c < "$output")" -gt 100 ]; then
    echo "  ✓ $current — already exists, skipping"
    success=$((success + 1))
    current=$(python3 -c "from datetime import datetime, timedelta; print((datetime.strptime('$current','%Y-%m-%d')+timedelta(days=1)).strftime('%Y-%m-%d'))")
    continue
  fi

  echo "  → $current..."
  tmp=$(mktemp)
  if python3 "$DASHBOARD_DIR/scripts/generate-daily-data.py" --json --date "$current" > "$tmp" 2>/dev/null; then
    if [ -s "$tmp" ] && python3 -m json.tool "$tmp" > /dev/null 2>&1; then
      mv "$tmp" "$output"
      echo "    ✓ saved ($current)"
      success=$((success + 1))
    else
      echo "    ⚠ empty/invalid JSON — skipped"
      rm -f "$tmp"
      fail=$((fail + 1))
    fi
  else
    echo "    ✗ script failed — skipped"
    rm -f "$tmp"
    fail=$((fail + 1))
  fi

  current=$(python3 -c "from datetime import datetime, timedelta; print((datetime.strptime('$current','%Y-%m-%d')+timedelta(days=1)).strftime('%Y-%m-%d'))")
done

echo ""
echo "=== Done: $success succeeded, $fail failed ==="

# Update index
echo "→ Updating index..."
python3 "$SCRIPT_DIR/update-index.py"
