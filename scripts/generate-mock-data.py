#!/usr/bin/env python3
"""Generate 2 months of realistic mock dashboard data for development/testing."""
import json
import random
import re
import sys
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

DATA_DIR = Path(__file__).parent.parent / 'data'

PRODUCTS = [
    'SPARK', 'SPARK 2', 'SPARK MINI', 'SPARK LIVE', 'SPARK GO',
    'SPARK CAB', 'SPARK NEO', 'SPARK LINK', 'SPARK EDGE', 'BIAS X'
]
PRODUCT_WEIGHTS = [18, 22, 12, 8, 10, 4, 5, 3, 3, 6]

TICKET_TYPES = [
    'Troubleshooting', 'Request For Refund/Replacement', 'Order Related',
    'Product Spec', 'Product Registration', 'Manage My Account',
    'Edit Address   Contact Information', 'Delete/Migrate Account'
]
TYPE_WEIGHTS = [50, 14, 10, 7, 5, 5, 3, 3]

TALLY_TEMPLATES = [
    'Troubleshooting  Software   App  Unlisted Issue Report',
    'Troubleshooting  Power / Battery  Not Powering On',
    'Troubleshooting  Bluetooth / Wireless  Cannot Connect To My Device  App',
    'Troubleshooting  Hardware  Physical Controls / Parts',
    'Troubleshooting  Sound  Hum Noise',
    'Purchase Inquiry  Order   Shipping  Track For Order Status And Eta',
    'Post-Sales  Return   Refund Request  Refund Request',
    'Product Inquiry  Specs  Specs  Shown ',
    'Website  Product Registration  Cannot Register Successfully',
    'Warranty  Warranty  Warranty Service Followup',
    'Troubleshooting  Bluetooth / Wireless  No Bluetooth Connection  Audio   App',
    'Troubleshooting  Hardware  Usb Cannot Be Detected',
    'Post-Sales  Service Parts Request  Others',
]

AGENTS = [
    ('Devin (AI)', 180, 350),
    ('Michael', 60, 70),
    ('Chris Hsu', 45, 50),
    ('Heyling', 35, 40),
    ('Eleanor', 20, 22),
    ('Ryan', 18, 28),
    ('Ernie', 4, 10),
    ('Dans', 3, 1),
]

STFS_ISSUES = [
    ('STFS-414', 'Spark - USB Compatibility issue with macOS 26', 'Hardware'),
    ('STFS-338', 'Spark NEO - TX Doesn\'t Automatically Connect to the RX', 'Hardware'),
    ('STFS-421', 'BIAS X 1.0.0 - Plugin Crash Issue (Cubase/Logic Pro/Studio One)', 'BIAS Desktop'),
    ('STFS-270', 'Spark 2 - Can\'t change tone/preset on Spark 2 via the Spark app', ''),
    ('STFS-211', 'Spark app - Experience Jimi Hendrix™ tag has disappeared. (iOS Only)', ''),
    ('STFS-358', 'Spark app - Groove Looper Will be Out of Sync Gradually (Spark 2)', 'Spark'),
    ('STFS-226', 'Spark app - Preset Restore Issue (Cross Platform/Dropbox)', ''),
    ('STFS-442', 'Spark app 4.5.1 – Frozen After Connecting to Spark Amp via In-App Features (iOS Only)', 'Spark'),
    ('STFS-477', 'Spark App 4.5.1 - Dropbox Fail Error (Android Only)', ''),
    ('STFS-220', 'Spark app - Hardware Preset Saving Issue (Android)', ''),
]

QA_PRODUCTS = ['Spark', 'BIAS X', 'Reactor']

DSAT_SAMPLES = [
    "I don't like wasting time with AI responses!!",
    "The AI response only vaguely answered my question.",
    "You only answered my question using AI. And not a real person.",
    "The AI didn't respond to my questions and simply reused my words.",
    "Friendly AI bot, but wasting my time.",
    "I received what sounded like an AI response that did not resolve the problem.",
    "The Support from your AI was fine. The Problem wasn't solved so I'm Not satisfied.",
    "Your AI is terrible and did not even acknowledge what I had asked it.",
    "Impressive responses considering it is AI generated but these issues should have been easier.",
    "Started well with an AI bot then went downhill after that.",
]


def iso_week_monday(year: int, week: int) -> date:
    jan4 = date(year, 1, 4)
    monday_w1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
    return monday_w1 + timedelta(weeks=week - 1)


def week_label(year: int, week: int) -> str:
    return f'{year}-W{week:02d}'


def rand_vary(base: int, pct: float = 0.25) -> int:
    lo = int(base * (1 - pct))
    hi = int(base * (1 + pct))
    return max(1, random.randint(lo, hi))


def generate_pulse(year: int, week: int, prev_total: int | None) -> dict:
    monday = iso_week_monday(year, week)
    sunday = monday + timedelta(days=6)
    total = rand_vary(350, 0.2)

    # Product breakdown
    raw_counts = [max(1, rand_vary(w, 0.3)) for w in PRODUCT_WEIGHTS]
    scale = total / sum(raw_counts)
    products = []
    for i, p in enumerate(PRODUCTS):
        count = max(1, round(raw_counts[i] * scale))
        delta = random.uniform(-15, 15) if prev_total else 0
        tallies = random.sample(TALLY_TEMPLATES, k=min(3, len(TALLY_TEMPLATES)))
        top_issues = []
        remaining = count
        for t in tallies:
            c = max(1, rand_vary(remaining // 3, 0.5)) if remaining > 1 else remaining
            c = min(c, remaining)
            top_issues.append({
                'tally': t,
                'count': c,
                'tickets': [{'id': str(random.randint(570000, 580000))} for _ in range(min(c, 5))]
            })
            remaining -= c
            if remaining <= 0:
                break
        products.append({
            'product': p,
            'count': count,
            'pct': round(count / total * 100, 1),
            'delta': round(delta, 1),
            'direction': 'up' if delta > 0 else ('down' if delta < 0 else 'same'),
            'topIssues': top_issues
        })
    products.sort(key=lambda x: x['count'], reverse=True)

    # Ticket types
    type_raw = [max(1, rand_vary(w, 0.3)) for w in TYPE_WEIGHTS]
    type_scale = total / sum(type_raw)
    types = []
    for i, t in enumerate(TICKET_TYPES):
        count = max(1, round(type_raw[i] * type_scale))
        types.append({
            'type': t,
            'count': count,
            'pct': round(count / total * 100, 1),
            'delta': round(random.uniform(-20, 20), 1),
            'direction': random.choice(['up', 'down', 'same'])
        })
    types.sort(key=lambda x: x['count'], reverse=True)

    # Daily trend
    days_abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    daily_trend = []
    remaining = total
    for d in range(7):
        day_date = monday + timedelta(days=d)
        if d < 6:
            day_count = rand_vary(total // 7, 0.4)
            day_count = min(day_count, remaining)
        else:
            day_count = remaining
        daily_trend.append({
            'date': day_date.isoformat(),
            'day': days_abbr[d],
            'count': max(0, day_count)
        })
        remaining -= day_count

    # AI ops
    ai_res_rate = round(random.uniform(28, 42), 1)
    all_closed = rand_vary(45, 0.2)
    devin_closed = round(all_closed * ai_res_rate / 100)
    ai_good = random.randint(1, 5)
    ai_bad = random.randint(0, 2)
    human_good = random.randint(5, 15)
    human_bad = random.randint(0, 3)

    # STFS with slight ticket count variation
    stfs = []
    for key, summary, product in STFS_ISSUES:
        stfs.append({
            'key': key,
            'summary': summary,
            'status': random.choice(['To Do', 'In Review']),
            'product': product,
            'ticketCount': rand_vary(30, 0.5),
            'dsatCount': random.randint(0, 3)
        })
    stfs.sort(key=lambda x: x['ticketCount'], reverse=True)

    refunds = rand_vary(12, 0.3)

    return {
        'period': f'Week of {monday.strftime("%m/%d")} - {sunday.strftime("%m/%d")}',
        'startDate': monday.isoformat(),
        'endDate': sunday.isoformat(),
        'alerts': [
            {
                'severity': random.choice(['high', 'medium']),
                'message': f'{random.choice(PRODUCTS)} / {random.choice(TALLY_TEMPLATES)}: {random.randint(1,3)} → {random.randint(4,8)}',
                'type': 'tally_surge'
            }
        ] if random.random() > 0.4 else [],
        'kpi': {
            'totalTickets': total,
            'topProduct': products[0]['product'],
            'dailyAvg': round(total / 7, 1),
            'refunds': refunds,
            'productCount': len([p for p in products if p['count'] > 0])
        },
        'dailyTrend': daily_trend,
        'productBreakdown': products,
        'ticketTypes': types,
        'aiOps': {
            'aiResolutionRate': ai_res_rate,
            'devinClosed': devin_closed,
            'allClosed': all_closed,
            'aiCsat': round(ai_good / max(1, ai_good + ai_bad) * 100, 1),
            'aiGood': ai_good,
            'aiBad': ai_bad,
            'humanCsat': round(human_good / max(1, human_good + human_bad) * 100, 1),
            'humanGood': human_good,
            'humanBad': human_bad,
            'handoffRate': round(100 - ai_res_rate, 1)
        },
        'aiOpportunities': [
            {
                'tally': random.choice(TALLY_TEMPLATES),
                'count': rand_vary(8, 0.4),
                'aiCount': random.randint(1, 3),
                'aiResRate': round(random.uniform(10, 40), 1)
            }
            for _ in range(random.randint(1, 3))
        ],
        'stfs': stfs
    }


def generate_qa(year: int, week: int) -> dict:
    monday = iso_week_monday(year, week)
    qa_bugs_total = random.randint(5, 30)
    customer_bugs_total = random.randint(0, 8)
    total_bugs = qa_bugs_total + customer_bugs_total
    overall_bcr = round(qa_bugs_total / max(1, total_bugs) * 100, 1)

    bcr_by_product = []
    for p in QA_PRODUCTS:
        qb = random.randint(1, qa_bugs_total // 2 + 1)
        cb = random.randint(0, max(1, customer_bugs_total // 2))
        t = qb + cb
        bcr_by_product.append({
            'product': p,
            'qaBugs': qb,
            'customerBugs': cb,
            'total': t,
            'rate': round(qb / max(1, t) * 100, 1)
        })

    # Weekly trend entry for this week
    bcr_trend = [{
        'week': week_label(year, week),
        'qaBugs': qa_bugs_total,
        'customerBugs': customer_bugs_total,
        'total': total_bugs,
        'weekRate': overall_bcr
    }]

    # Test execution
    test_exec = {}
    for p in QA_PRODUCTS:
        total_cases = rand_vary(400, 0.5)
        passed = int(total_cases * random.uniform(0.80, 0.98))
        failed = int(total_cases * random.uniform(0.01, 0.08))
        blocked = random.randint(0, 15)
        skipped = total_cases - passed - failed - blocked
        test_exec[p] = {
            'completedRuns': random.randint(3, 8),
            'totalRuns': random.randint(5, 10),
            'totalCases': total_cases,
            'totalPassed': passed,
            'totalFailed': failed,
            'totalBlocked': blocked,
            'totalSkipped': max(0, skipped),
            'passRate': round(passed / max(1, total_cases) * 100, 1),
            'avgVelocity': round(random.uniform(15, 45), 1),
            'blockedRate': round(blocked / max(1, total_cases) * 100, 1)
        }

    # Recent bugs
    qa_bug_list = []
    for i in range(min(5, qa_bugs_total)):
        proj = random.choice(['FWP', 'BX', 'RA'])
        qa_bug_list.append({
            'key': f'{proj}-{random.randint(600, 800)}',
            'summary': f'[{random.choice(QA_PRODUCTS)}] Test issue #{random.randint(1,99)}',
            'project': proj
        })

    customer_bug_list = []
    for i in range(min(5, customer_bugs_total)):
        customer_bug_list.append({
            'key': f'STFS-{random.randint(400, 500)}',
            'summary': f'{random.choice(PRODUCTS)} - Customer reported issue #{random.randint(1,99)}',
            'product': random.choice(QA_PRODUCTS)
        })

    return {
        'period': f'{(monday - timedelta(days=90)).isoformat()} ~ {monday.isoformat()}',
        'daysCount': 90,
        'reportDate': monday.isoformat(),
        'bcr': {
            'overall': overall_bcr,
            'status': 'on_track' if overall_bcr >= 80 else 'at_risk',
            'target': 80,
            'qaCount': qa_bugs_total,
            'customerCount': customer_bugs_total
        },
        'bcrByProduct': bcr_by_product,
        'bcrWeeklyTrend': bcr_trend,
        'testExecution': test_exec,
        'regressionTrend': {p: [] for p in QA_PRODUCTS},
        'latestFunctionTest': [],
        'effortSignals': [],
        'recentBugs': {
            'qa': qa_bug_list,
            'customer': customer_bug_list
        }
    }


def generate_dsat(year: int, week: int) -> dict:
    monday = iso_week_monday(year, week)
    total_bad = rand_vary(40, 0.3)
    with_comments = int(total_bad * random.uniform(0.75, 0.90))
    ai_negative = int(with_comments * random.uniform(0.45, 0.65))

    samples = []
    for _ in range(min(20, total_bad)):
        samples.append({
            'ticketId': random.randint(10000000000000, 99999999999999),
            'comment': random.choice(DSAT_SAMPLES),
            'createdAt': (monday + timedelta(days=random.randint(0, 6),
                                             hours=random.randint(0, 23))).isoformat() + 'Z',
            'url': f'https://positivegrid.zendesk.com/api/v2/satisfaction_ratings/{random.randint(40000000000000, 49999999999999)}.json'
        })

    all_comments = []
    for s in samples:
        all_comments.append({
            'ticketId': s['ticketId'],
            'comment': s['comment'],
            'createdAt': s['createdAt'],
            'isAiNegative': random.random() > 0.4
        })

    return {
        'period': f'{(monday - timedelta(days=90)).isoformat()} ~ {monday.isoformat()}',
        'daysCount': 90,
        'totalBadRatings': total_bad,
        'withComments': with_comments,
        'aiNegative': ai_negative,
        'aiNegativeRateOfComments': round(ai_negative / max(1, with_comments) * 100, 2),
        'aiNegativeRateOfAll': round(ai_negative / max(1, total_bad) * 100, 2),
        'samples': samples,
        'allComments': all_comments
    }


def generate_daily(year: int, week: int) -> dict:
    monday = iso_week_monday(year, week)
    # Always use Monday to match the dropdown label derived from ISO week
    report_date = monday
    days_abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    day_offset = 0
    total = rand_vary(55, 0.25)

    product_breakdown = []
    raw = [max(1, rand_vary(w, 0.3)) for w in PRODUCT_WEIGHTS]
    scale = total / sum(raw)
    for i, p in enumerate(PRODUCTS):
        count = max(0, round(raw[i] * scale))
        if count > 0:
            product_breakdown.append({
                'product': p,
                'count': count,
                'pct': round(count / total * 100, 1)
            })
    product_breakdown.sort(key=lambda x: x['count'], reverse=True)

    type_raw = [max(1, rand_vary(w, 0.3)) for w in TYPE_WEIGHTS]
    type_scale = total / sum(type_raw)
    ticket_types = []
    for i, t in enumerate(TICKET_TYPES):
        count = max(0, round(type_raw[i] * type_scale))
        if count > 0:
            ticket_types.append({
                'type': t,
                'count': count,
                'pct': round(count / total * 100, 1)
            })
    ticket_types.sort(key=lambda x: x['count'], reverse=True)

    agents = []
    for name, base_assigned, base_replies in AGENTS:
        assigned = rand_vary(base_assigned, 0.3)
        replies = rand_vary(base_replies, 0.3)
        agents.append({
            'name': name,
            'assigned': assigned,
            'replies': replies,
            'avgAssignedPerDay': round(assigned / 7, 1),
            'avgRepliesPerDay': round(replies / 7, 1)
        })

    return {
        'period': f'{report_date.isoformat()} ({days_abbr[day_offset]})',
        'startDate': report_date.isoformat(),
        'endDate': report_date.isoformat(),
        'kpi': {
            'totalTickets': total,
            'topProduct': product_breakdown[0]['product'] if product_breakdown else '-',
            'refunds': rand_vary(6, 0.4),
            'productCount': len(product_breakdown)
        },
        'productBreakdown': product_breakdown,
        'ticketTypes': ticket_types,
        'agentActivity': agents
    }


def generate_tickets(year: int, week: int, pulse_data: dict) -> dict:
    """Tickets data mirrors pulse but with slightly different structure."""
    monday = iso_week_monday(year, week)
    sunday = monday + timedelta(days=6)

    stfs = []
    for key, summary, product in random.sample(STFS_ISSUES, k=min(8, len(STFS_ISSUES))):
        stfs.append({
            'key': key,
            'summary': summary,
            'status': random.choice(['To Do', 'In Review']),
            'product': product,
            'ticketCount': rand_vary(10, 0.5),
            'followUp': random.random() > 0.5
        })
    stfs.sort(key=lambda x: x['ticketCount'], reverse=True)

    return {
        'period': f'Week of {monday.strftime("%m/%d")} - {sunday.strftime("%m/%d")}',
        'reportType': 'weekly',
        'startDate': monday.isoformat(),
        'endDate': sunday.isoformat(),
        'alerts': pulse_data.get('alerts', []),
        'kpi': pulse_data['kpi'],
        'dailyTrend': pulse_data['dailyTrend'][:1],  # just first day
        'productBreakdown': pulse_data['productBreakdown'],
        'ticketTypes': pulse_data['ticketTypes'],
        'stfs': stfs
    }


def generate_single_week(year: int, week: int):
    """Generate mock data for a single week."""
    for subdir in ['pulse', 'qa', 'dsat', 'daily', 'tickets']:
        (DATA_DIR / subdir).mkdir(parents=True, exist_ok=True)

    wl = week_label(year, week)
    monday = iso_week_monday(year, week)
    print(f'Generating {wl} ({monday.isoformat()})...')

    pulse = generate_pulse(year, week, 350)
    qa = generate_qa(year, week)
    dsat = generate_dsat(year, week)
    daily = generate_daily(year, week)
    tickets = generate_tickets(year, week, pulse)

    for subdir, data in [('pulse', pulse), ('qa', qa), ('dsat', dsat),
                         ('daily', daily), ('tickets', tickets)]:
        path = DATA_DIR / subdir / f'{wl}.json'
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

    print(f'Done. Generated {wl}.')


def main():
    # Support single week argument: python generate-mock-data.py 2026-W09
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        match = re.match(r'(\d{4})-W(\d{2})', arg)
        if match:
            generate_single_week(int(match.group(1)), int(match.group(2)))
            return
        print(f'Invalid week format: {arg}. Expected: YYYY-WNN')
        sys.exit(1)

    # Default: generate 2025-W51 through 2026-W05
    weeks_to_generate = [
        (2025, 51), (2025, 52),
        (2026, 1), (2026, 2), (2026, 3), (2026, 4), (2026, 5)
    ]

    for subdir in ['pulse', 'qa', 'dsat', 'daily', 'tickets']:
        (DATA_DIR / subdir).mkdir(parents=True, exist_ok=True)

    prev_total = None
    for year, week in weeks_to_generate:
        wl = week_label(year, week)
        monday = iso_week_monday(year, week)
        print(f'Generating {wl} ({monday.isoformat()})...')

        pulse = generate_pulse(year, week, prev_total)
        prev_total = pulse['kpi']['totalTickets']

        qa = generate_qa(year, week)
        dsat = generate_dsat(year, week)
        daily = generate_daily(year, week)
        tickets = generate_tickets(year, week, pulse)

        for subdir, data in [('pulse', pulse), ('qa', qa), ('dsat', dsat),
                             ('daily', daily), ('tickets', tickets)]:
            path = DATA_DIR / subdir / f'{wl}.json'
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

    print(f'Done. Generated {len(weeks_to_generate)} weeks of data.')


if __name__ == '__main__':
    main()
