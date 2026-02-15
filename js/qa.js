// === QA Pulse Page Rendering ===

var _qaData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData('qa');
    _qaData = data;
    document.getElementById('period').textContent = data.period;
    renderBcrHero(data.bcr);
    renderBcrByProduct(data.bcrByProduct);
    renderBcrTrend(data.bcrWeeklyTrend);
    renderTestExecution(data.testExecution);
    renderRegressionTrend(data.regressionTrend);
    renderFunctionTest(data.latestFunctionTest);
    renderRecentBugs(data.recentBugs);
    initCompare('qa');
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<p style="color:var(--red)">Error loading QA data: ' + err.message + '</p>';
  }
});

// --- 1. BCR Hero ---
function renderBcrHero(bcr) {
  const el = document.getElementById('bcr-hero');
  const onTrack = bcr.overall >= bcr.target;
  const valueClass = onTrack ? 'ok' : 'bad';
  const badgeClass = onTrack ? 'badge-green' : 'badge-red';
  const statusText = onTrack ? 'On Track' : 'Below Target';

  el.innerHTML = '<div class="big-number">' +
    '<div class="big-number-value ' + valueClass + '">' + bcr.overall.toFixed(1) + '%</div>' +
    '<div id="bcr-hero-delta" style="margin-top:4px;"></div>' +
    '<div style="margin-top:8px;font-size:16px;">' +
      'Bug Catch Rate — <span class="badge ' + badgeClass + '">' + statusText + '</span>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">' +
      'Target: ' + bcr.target + '%' +
    '</div>' +
    '</div>';
}

// --- 2. BCR by Product ---
function renderBcrByProduct(products) {
  const el = document.getElementById('bcr-product-table');
  let html = '<table><thead><tr>' +
    '<th>Product</th><th>QA Bugs</th><th>Customer Bugs</th><th>BCR</th>' +
    '</tr></thead><tbody>';

  products.forEach(p => {
    const badgeClass = p.rate >= 80 ? 'badge-green' : 'badge-red';
    html += '<tr>' +
      '<td>' + p.product + '</td>' +
      '<td>' + formatNumber(p.qaBugs) + '</td>' +
      '<td>' + formatNumber(p.customerBugs) + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + p.rate.toFixed(1) + '%</span></td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// --- 3. BCR Weekly Trend (Stacked Bar Chart) ---
function renderBcrTrend(trend) {
  const ctx = document.getElementById('bcr-trend-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(d => d.week),
      datasets: [
        {
          label: 'QA Bugs',
          data: trend.map(d => d.qaBugs),
          backgroundColor: '#2dd4bf88',
          borderColor: '#2dd4bf',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Customer Bugs',
          data: trend.map(d => d.customerBugs),
          backgroundColor: '#ef444488',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: '#30363d' }
        }
      }
    }
  });
}

// --- 4. Test Execution Summary ---
function renderTestExecution(te) {
  const el = document.getElementById('test-exec');
  el.innerHTML = [
    kpiCard('Test Runs', formatNumber(te.totalRuns)),
    kpiCard('Pass Rate', (te.passRate * 100).toFixed(1) + '%'),
    kpiCard('Cases Executed', formatNumber(te.velocity)),
    kpiCard('Blocked', (te.blockedPct * 100).toFixed(1) + '%')
  ].join('');
}

// --- 5. Regression Pass Rate ---
function renderRegressionTrend(products) {
  const el = document.getElementById('regression-table');
  let html = '<table><thead><tr>' +
    '<th>Product</th><th>Pass Rate</th><th>Delta</th>' +
    '</tr></thead><tbody>';

  products.forEach(p => {
    const pct = (p.passRate * 100).toFixed(1) + '%';
    const deltaPct = (p.delta * 100).toFixed(1);
    let arrow, badgeClass;
    if (p.delta > 0) {
      arrow = '\u2191';
      badgeClass = 'badge-green';
    } else if (p.delta < 0) {
      arrow = '\u2193';
      badgeClass = 'badge-red';
    } else {
      arrow = '\u2192';
      badgeClass = 'badge-green';
    }
    const deltaText = arrow + ' ' + Math.abs(deltaPct) + '%';

    html += '<tr>' +
      '<td>' + p.product + '</td>' +
      '<td>' + pct + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + deltaText + '</span></td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// --- 6. Latest Function Test ---
function renderFunctionTest(tests) {
  const el = document.getElementById('function-test');
  let html = '';

  tests.forEach(t => {
    const total = t.passed + t.failed + t.blocked + t.untested;
    const pPct = (t.passed / total * 100).toFixed(1);
    const fPct = (t.failed / total * 100).toFixed(1);
    const bPct = (t.blocked / total * 100).toFixed(1);
    const uPct = (t.untested / total * 100).toFixed(1);

    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">' +
      '<div style="font-weight:600;margin-bottom:8px;">' + t.product + '</div>' +
      '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;">' +
        '<div style="width:' + pPct + '%;background:var(--green);" title="Passed: ' + t.passed + '"></div>' +
        '<div style="width:' + fPct + '%;background:var(--red);" title="Failed: ' + t.failed + '"></div>' +
        '<div style="width:' + bPct + '%;background:var(--orange);" title="Blocked: ' + t.blocked + '"></div>' +
        '<div style="width:' + uPct + '%;background:var(--border);" title="Untested: ' + t.untested + '"></div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' +
        '\u2705 ' + t.passed + ' passed \u00b7 ' +
        '\u274c ' + t.failed + ' failed \u00b7 ' +
        '\ud83d\udea7 ' + t.blocked + ' blocked \u00b7 ' +
        '\u2b1c ' + t.untested + ' untested' +
      '</div>' +
      '</div>';
  });

  el.innerHTML = html;
}

// --- 7. Recent Bugs ---
function renderRecentBugs(bugs) {
  const el = document.getElementById('recent-bugs');
  let html = '';

  // QA Catches
  html += '<div style="padding:12px 16px;font-weight:600;color:var(--green);border-bottom:1px solid var(--border);">' +
    'QA Catches</div>';
  html += '<table><thead><tr><th>Key</th><th>Summary</th></tr></thead><tbody>';
  bugs.qa.forEach(b => {
    html += '<tr>' +
      '<td><a class="ticket-link" href="' + jiraUrl(b.key) + '" target="_blank">' + b.key + '</a></td>' +
      '<td>' + b.summary + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  // Customer Reports
  html += '<div style="padding:12px 16px;font-weight:600;color:var(--red);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">' +
    'Customer Reports (STFS)</div>';
  html += '<table><thead><tr><th>Key</th><th>Summary</th></tr></thead><tbody>';
  bugs.customer.forEach(b => {
    html += '<tr>' +
      '<td><a class="ticket-link" href="' + jiraUrl(b.key) + '" target="_blank">' + b.key + '</a></td>' +
      '<td>' + b.summary + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  el.innerHTML = html;
}

// === Compare Mode Handler ===
document.addEventListener('compare-toggled', function(e) {
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!_qaData || !prevData) return;

  // --- BCR Hero Delta ---
  var heroEl = document.getElementById('bcr-hero-delta');
  if (heroEl) {
    if (active && prevData.bcr) {
      var bcrDelta = (_qaData.bcr.overall - prevData.bcr.overall).toFixed(1);
      var deltaNum = parseFloat(bcrDelta);
      var cls = deltaNum > 0 ? 'up' : (deltaNum < 0 ? 'down' : 'neutral');
      var arrow = deltaNum > 0 ? '\u2191' : (deltaNum < 0 ? '\u2193' : '\u2192');
      heroEl.innerHTML = '<span class="kpi-delta ' + cls + '" style="font-size:18px;">' +
        arrow + ' ' + Math.abs(deltaNum).toFixed(1) + ' pp vs prev week</span>';
    } else {
      heroEl.innerHTML = '';
    }
  }

  // --- Test Execution Deltas ---
  var testExecEl = document.getElementById('test-exec');
  if (active && prevData.testExecution) {
    var teCards = testExecEl.querySelectorAll('.kpi-card');
    // Test Runs delta
    if (teCards[0]) addKpiDelta(teCards[0], computeDeltaPct(_qaData.testExecution.totalRuns, prevData.testExecution.totalRuns));
    // Pass Rate delta (percentage points)
    if (teCards[1]) {
      var currPR = (_qaData.testExecution.passRate * 100).toFixed(1);
      var prevPR = (prevData.testExecution.passRate * 100).toFixed(1);
      addKpiDelta(teCards[1], Math.round(currPR - prevPR));
    }
    // Cases Executed delta
    if (teCards[2]) addKpiDelta(teCards[2], computeDeltaPct(_qaData.testExecution.velocity, prevData.testExecution.velocity));
  } else {
    removeAllKpiDeltas('test-exec');
  }
});
