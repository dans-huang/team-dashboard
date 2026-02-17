#!/usr/bin/env python3
"""
Daily Dashboard Data Generator

Produces data/daily/{WEEK}.json with:
  1. Yesterday's ticket volume, product breakdown, ticket type breakdown
  2. Per-agent activity over the past 7 days (assigned + commented tickets)

Usage:
    python3 generate-daily-data.py --json                    # stdout JSON (yesterday)
    python3 generate-daily-data.py --json --date 2026-02-15  # specific date
"""

import sys
import os
import json
import argparse
from datetime import datetime, timedelta

# Add report_engine path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..',
                                'skills', 'daily-ticket-report', 'scripts'))
# Add zendesk client path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..',
                                'scripts', 'automation'))

import report_engine as engine
from zendesk_api_client import ZendeskClient


def load_agents():
    """Load agent ID→name mapping from config/zendesk-agents.json."""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..',
                               'config', 'zendesk-agents.json')
    with open(config_path) as f:
        data = json.load(f)
    return data.get('agents', {})


def fetch_agent_activity(client, agents, start_date, end_date):
    """Fetch 7-day assigned + commented ticket counts per agent.

    Args:
        client: ZendeskClient instance
        agents: dict of agent_id (str) → name
        start_date: str YYYY-MM-DD (7 days ago)
        end_date: str YYYY-MM-DD (target date)

    Returns:
        list of dicts sorted by assigned desc
    """
    days = (datetime.strptime(end_date, '%Y-%m-%d') -
            datetime.strptime(start_date, '%Y-%m-%d')).days + 1
    results = []

    for agent_id, name in agents.items():
        # Skip non-agent accounts
        if name in ('Administrator', 'Merch Team'):
            continue

        try:
            assigned = client.search_count(
                f"type:ticket assignee:{agent_id} "
                f"created>={start_date} created<={end_date}"
            )
            replies = client.search_count(
                f"type:ticket commenter:{agent_id} "
                f"created>={start_date} created<={end_date}"
            )
        except Exception as e:
            print(f"  Warning: failed to fetch data for {name}: {e}",
                  file=sys.stderr)
            assigned = 0
            replies = 0

        results.append({
            'name': name,
            'assigned': assigned,
            'replies': replies,
            'avgAssignedPerDay': round(assigned / days, 1),
            'avgRepliesPerDay': round(replies / days, 1),
        })

    # Sort by assigned descending
    results.sort(key=lambda x: x['assigned'], reverse=True)
    return results


def main():
    parser = argparse.ArgumentParser(description='Generate daily dashboard data')
    parser.add_argument('--json', action='store_true', help='Output JSON to stdout')
    parser.add_argument('--date', type=str, default=None,
                        help='Target date YYYY-MM-DD (default: yesterday)')
    args = parser.parse_args()

    # Redirect print to stderr in json mode
    if args.json:
        import builtins
        _builtin_print = builtins.print
        def print(*a, **kw):
            kw.setdefault('file', sys.stderr)
            _builtin_print(*a, **kw)

    # Determine target date
    if args.date:
        target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
    else:
        target_date = datetime.now().date() - timedelta(days=1)

    # Agent activity window: 7 days ending on target_date
    activity_start = target_date - timedelta(days=6)

    day_label = target_date.strftime('%a')
    print(f"=== Daily Dashboard Data: {target_date} ({day_label}) ===")
    print(f"  Agent activity window: {activity_start} ~ {target_date}")

    # --- Part 1: Ticket data from Google Sheets ---
    print("  Fetching ticket data...")
    token = engine.get_access_token()
    rows, header_idx = engine.fetch_ticket_data(token)

    if not rows:
        print("  No ticket data found.")
        if args.json:
            fallback = {
                'period': f"{target_date} ({day_label})",
                'startDate': str(target_date),
                'endDate': str(target_date),
                'kpi': {'totalTickets': 0, 'topProduct': None, 'refunds': 0, 'productCount': 0},
                'productBreakdown': [],
                'ticketTypes': [],
                'agentActivity': [],
            }
            sys.stdout.write(json.dumps(fallback, indent=2) + '\n')
        return

    # Filter to target date only
    day_rows = engine.filter_rows_by_date_range(
        rows, header_idx, target_date, target_date)
    print(f"  {len(day_rows)} tickets on {target_date}")

    # Analyze
    analysis = engine.analyze_period(day_rows, header_idx)
    total = analysis['total']

    # Compress products and types
    compressed = engine.compress_products(analysis['by_product'], top_n=10)
    compressed_types = engine.compress_issue_types(analysis['by_issue_type'], top_n=8)

    # Top product
    top_product = None
    if analysis['by_product']:
        top_product = max(analysis['by_product'],
                          key=analysis['by_product'].get).upper().replace('_', ' ')

    # --- Part 2: Agent activity from Zendesk ---
    print("  Fetching agent activity (7d)...")
    agents = load_agents()
    client = ZendeskClient()
    agent_activity = fetch_agent_activity(
        client, agents,
        str(activity_start), str(target_date)
    )
    print(f"  {len(agent_activity)} agents processed")

    # --- Build JSON output ---
    output = {
        'period': f"{target_date} ({day_label})",
        'startDate': str(target_date),
        'endDate': str(target_date),
        'kpi': {
            'totalTickets': total,
            'topProduct': top_product,
            'refunds': analysis.get('refund_count', 0),
            'productCount': len(analysis.get('by_product', {})),
        },
        'productBreakdown': [],
        'ticketTypes': [],
        'agentActivity': agent_activity,
    }

    # Product breakdown
    for product, count in compressed['visible']:
        pct = round(count / max(total, 1) * 100, 1)
        output['productBreakdown'].append({
            'product': product.upper().replace('_', ' '),
            'count': count,
            'pct': pct,
        })
    if compressed.get('other'):
        other = compressed['other']
        output['productBreakdown'].append({
            'product': f"Other ({other['product_count']} products)",
            'count': other['count'],
            'pct': round(other['count'] / max(total, 1) * 100, 1),
        })

    # Ticket types
    for itype, count in compressed_types['visible']:
        pct = round(count / max(total, 1) * 100, 1)
        output['ticketTypes'].append({
            'type': itype.replace('_', ' ').title() if itype else 'Unknown',
            'count': count,
            'pct': pct,
        })
    if compressed_types.get('other'):
        other_t = compressed_types['other']
        output['ticketTypes'].append({
            'type': f"Other ({other_t['type_count']} types)",
            'count': other_t['count'],
            'pct': round(other_t['count'] / max(total, 1) * 100, 1),
        })

    if args.json:
        sys.stdout.write(json.dumps(output, indent=2, default=str) + '\n')
    else:
        print(f"\n  Total Tickets: {total}")
        print(f"  Top Product: {top_product}")
        print(f"  Refunds: {analysis.get('refund_count', 0)}")
        print(f"\n  Agent Activity (7d):")
        for a in agent_activity[:10]:
            print(f"    {a['name']:<15} assigned={a['assigned']}  replies={a['replies']}")

    print("=== Done ===")


if __name__ == '__main__':
    main()
