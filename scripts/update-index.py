#!/usr/bin/env python3
"""Update data/index.json with available weeks and months from data/ subdirectories."""
import json
import re
from datetime import date, timedelta
from pathlib import Path


def iso_week_to_month(week_str: str) -> str:
    """Convert ISO week string (e.g., '2026-W07') to month string (e.g., '2026-02')."""
    match = re.match(r'(\d{4})-W(\d{2})', week_str)
    if not match:
        return ''
    year, week = int(match.group(1)), int(match.group(2))
    # Find Monday of the ISO week
    jan4 = date(year, 1, 4)
    monday_w1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
    monday = monday_w1 + timedelta(weeks=week - 1)
    return monday.strftime('%Y-%m')


def validate_week(data_dir: Path, week: str) -> bool:
    """A week is valid if pulse or tickets data exists with meaningful content (>100 bytes)."""
    for subdir in ['pulse', 'tickets']:
        f = data_dir / subdir / f'{week}.json'
        if f.exists() and f.stat().st_size > 100:
            return True
    return False


def main():
    data_dir = Path(__file__).parent.parent / 'data'
    weeks = set()
    for subdir in ['pulse', 'qa', 'tickets', 'dsat', 'daily']:
        dir_path = data_dir / subdir
        if not dir_path.exists():
            continue
        for f in dir_path.glob('*.json'):
            match = re.match(r'(\d{4}-W\d{2})\.json', f.name)
            if match:
                weeks.add(match.group(1))

    # Filter to only weeks with valid data
    weeks = {w for w in weeks if validate_week(data_dir, w)}

    sorted_weeks = sorted(weeks, reverse=True)

    # Derive months from weeks
    month_set = set()
    for w in sorted_weeks:
        m = iso_week_to_month(w)
        if m:
            month_set.add(m)
    sorted_months = sorted(month_set, reverse=True)

    index = {
        'weeks': sorted_weeks,
        'latest': sorted_weeks[0] if sorted_weeks else None,
        'months': sorted_months,
        'latestMonth': sorted_months[0] if sorted_months else None,
    }
    index_path = data_dir / 'index.json'
    index_path.write_text(json.dumps(index, indent=2) + '\n')
    print(f'Updated {index_path}: {len(sorted_weeks)} weeks, {len(sorted_months)} months')


if __name__ == '__main__':
    main()
