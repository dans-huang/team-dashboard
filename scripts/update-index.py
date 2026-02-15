#!/usr/bin/env python3
"""Update data/index.json with available weeks from data/ subdirectories."""
import json
import re
from pathlib import Path


def main():
    data_dir = Path(__file__).parent.parent / 'data'
    weeks = set()
    for subdir in ['pulse', 'qa', 'tickets', 'dsat']:
        dir_path = data_dir / subdir
        if not dir_path.exists():
            continue
        for f in dir_path.glob('*.json'):
            match = re.match(r'(\d{4}-W\d{2})\.json', f.name)
            if match:
                weeks.add(match.group(1))

    sorted_weeks = sorted(weeks, reverse=True)
    index = {
        'weeks': sorted_weeks,
        'latest': sorted_weeks[0] if sorted_weeks else None,
    }
    index_path = data_dir / 'index.json'
    index_path.write_text(json.dumps(index, indent=2) + '\n')
    print(f'Updated {index_path}: {len(sorted_weeks)} weeks')


if __name__ == '__main__':
    main()
