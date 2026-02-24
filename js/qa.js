// === QA Pulse Page Rendering ===

var _qaData = null;

function initQaPage(data) {
  _qaData = data;
  var periodEl = document.getElementById('period');
  if (periodEl && data.period) periodEl.textContent = data.period;
  renderBcrHero(data.bcr);
  renderBcrByProduct(data.bcrByProduct);
  renderBcrTrend(data.bcrWeeklyTrend);
  renderTestExecution(data.testExecution);
  renderRegressionTrend(data.regressionTrend);
  renderFunctionTest(data.latestFunctionTest);
  renderRecentBugs(data.recentBugs);
}

// --- 1. BCR Hero ---
function renderBcrHero(bcr) {
  var el = document.getElementById('bcr-hero');
  if (!el) return;
  if (!bcr) {
    el.innerHTML = '<p style="color:var(--text-secondary)">No BCR data</p>';
    return;
  }
  var overall = typeof bcr.overall === 'number' ? bcr.overall : 0;
  var target = typeof bcr.target === 'number' ? bcr.target : 80;
  var onTrack = overall >= target;
  var valueClass = onTrack ? 'ok' : 'bad';
  var badgeClass = onTrack ? 'badge-green' : 'badge-red';
  var statusText = onTrack ? 'On Track' : 'Below Target';

  el.innerHTML = '<div class="big-number">' +
    '<div class="big-number-value ' + valueClass + '">' + overall.toFixed(1) + '%</div>' +
    '<div id="bcr-hero-delta" style="margin-top:4px;"></div>' +
    '<div style="margin-top:8px;font-size:16px;">' +
      'Bug Catch Rate — <span class="badge ' + badgeClass + '">' + statusText + '</span>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">' +
      'Target: ' + target + '%' +
    '</div>' +
    '</div>';
}

// --- 2. BCR by Product ---
function renderBcrByProduct(products) {
  var el = document.getElementById('bcr-product-table');
  if (!el) return;
  if (!products || products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No product BCR data</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Product</th><th>QA Bugs</th><th>Customer Bugs</th><th>BCR</th>' +
    '</tr></thead><tbody>';

  products.forEach(function(p) {
    var badgeClass = p.rate >= 80 ? 'badge-green' : 'badge-red';
    html += '<tr>' +
      '<td>' + p.product + '</td>' +
      '<td>' + safeFormatNumber(p.qaBugs) + '</td>' +
      '<td>' + safeFormatNumber(p.customerBugs) + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + safeFixed(p.rate, 1) + '%</span></td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// --- 3. BCR Weekly Trend (Stacked Bar Chart) ---
function renderBcrTrend(trend) {
  var canvas = document.getElementById('bcr-trend-chart');
  if (!canvas) return;
  if (!trend || trend.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No weekly trend data</p>';
    return;
  }
  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(function(d) { return d.week; }),
      datasets: [
        {
          label: 'QA Bugs',
          data: trend.map(function(d) { return d.qaBugs; }),
          backgroundColor: 'rgba(6, 182, 212, 0.5)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Customer Bugs',
          data: trend.map(function(d) { return d.customerBugs; }),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
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
          beginAtZero: true
        }
      }
    }
  });
}

// --- 4. Test Execution Summary ---
function renderTestExecution(te) {
  var el = document.getElementById('test-exec');
  if (!el) return;
  if (!te) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No test execution data</p>';
    return;
  }

  if (typeof te.totalRuns === 'number') {
    el.innerHTML = [
      kpiCard('Test Runs', safeFormatNumber(te.totalRuns)),
      kpiCard('Pass Rate', safeFixed(te.passRate * 100, 1) + '%'),
      kpiCard('Cases Executed', safeFormatNumber(te.velocity)),
      kpiCard('Blocked', safeFixed(te.blockedPct * 100, 1) + '%')
    ].join('');
    return;
  }

  var products = Object.keys(te);
  if (products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No test execution data</p>';
    return;
  }

  var html = '<div class="table-wrap"><table><thead><tr>' +
    '<th>Product</th><th>Runs</th><th>Cases</th><th>Pass Rate</th><th>Velocity</th><th>Blocked</th>' +
    '</tr></thead><tbody>';

  products.forEach(function(name) {
    var p = te[name];
    var runsLabel = safeFormatNumber(p.completedRuns) + '/' + safeFormatNumber(p.totalRuns);
    var passRateClass = (p.passRate || 0) >= 80 ? 'badge-green' : 'badge-red';
    html += '<tr>' +
      '<td><strong>' + name + '</strong></td>' +
      '<td>' + runsLabel + '</td>' +
      '<td>' + safeFormatNumber(p.totalCases) + '</td>' +
      '<td><span class="badge ' + passRateClass + '">' + safeFixed(p.passRate, 1) + '%</span></td>' +
      '<td>' + safeFixed(p.avgVelocity, 1) + '</td>' +
      '<td>' + safeFixed(p.blockedRate, 1) + '%</td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// --- 5. Regression Pass Rate ---
function renderRegressionTrend(data) {
  var el = document.getElementById('regression-table');
  if (!el) return;
  if (!data) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No regression data</p>';
    return;
  }

  if (Array.isArray(data)) {
    renderRegressionTrendLegacy(el, data);
    return;
  }

  var products = Object.keys(data);
  if (products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No regression data</p>';
    return;
  }

  var html = '';
  products.forEach(function(name) {
    var runs = data[name];
    if (!runs || runs.length === 0) return;

    html += '<div style="margin-bottom:16px;">' +
      '<div style="font-weight:600;font-size:15px;padding:8px 0;border-bottom:1px solid var(--border);">' + name + '</div>' +
      '<table><thead><tr>' +
      '<th>Run Title</th><th>Date</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Delta</th>' +
      '</tr></thead><tbody>';

    runs.forEach(function(r) {
      var rateClass = (r.rate || 0) >= 80 ? 'badge-green' : 'badge-red';
      var deltaVal = r.delta || 0;
      var arrow, badgeClass;
      if (deltaVal > 0) {
        arrow = '\u2191';
        badgeClass = 'badge-green';
      } else if (deltaVal < 0) {
        arrow = '\u2193';
        badgeClass = 'badge-red';
      } else {
        arrow = '\u2192';
        badgeClass = 'badge-green';
      }
      var deltaText = arrow + ' ' + Math.abs(deltaVal).toFixed(1) + '%';

      html += '<tr>' +
        '<td>' + (r.title || '-') + '</td>' +
        '<td>' + (r.date || '-') + '</td>' +
        '<td>' + safeFormatNumber(r.passed) + '</td>' +
        '<td>' + safeFormatNumber(r.failed) + '</td>' +
        '<td><span class="badge ' + rateClass + '">' + safeFixed(r.rate, 1) + '%</span></td>' +
        '<td><span class="badge ' + badgeClass + '">' + deltaText + '</span></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
  });

  el.innerHTML = html || '<p style="padding:16px;color:var(--text-secondary)">No regression data</p>';
}

function renderRegressionTrendLegacy(el, products) {
  if (!products || products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No regression data</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Product</th><th>Pass Rate</th><th>Delta</th>' +
    '</tr></thead><tbody>';

  products.forEach(function(p) {
    var pct = safeFixed(p.passRate * 100, 1) + '%';
    var deltaPct = (p.delta * 100).toFixed(1);
    var arrow, badgeClass;
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
    var deltaText = arrow + ' ' + Math.abs(deltaPct) + '%';

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
  var el = document.getElementById('function-test');
  if (!el) return;
  if (!tests || tests.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No function test data</p>';
    return;
  }
  var html = '';

  tests.forEach(function(t) {
    var blocked = (t.blocked || 0) + (t.skipped || 0);
    var total = (t.passed || 0) + (t.failed || 0) + blocked + (t.untested || 0);
    if (total === 0) total = 1;
    var pPct = ((t.passed || 0) / total * 100).toFixed(1);
    var fPct = ((t.failed || 0) / total * 100).toFixed(1);
    var bPct = (blocked / total * 100).toFixed(1);
    var uPct = ((t.untested || 0) / total * 100).toFixed(1);

    var blockedLabel = t.skipped
      ? blocked + ' blocked/skipped'
      : blocked + ' blocked';

    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">' +
      '<div style="font-weight:600;margin-bottom:8px;">' + t.product + '</div>' +
      '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;">' +
        '<div style="width:' + pPct + '%;background:var(--green);" title="Passed: ' + (t.passed || 0) + '"></div>' +
        '<div style="width:' + fPct + '%;background:var(--red);" title="Failed: ' + (t.failed || 0) + '"></div>' +
        '<div style="width:' + bPct + '%;background:var(--orange);" title="Blocked: ' + blocked + '"></div>' +
        '<div style="width:' + uPct + '%;background:var(--border);" title="Untested: ' + (t.untested || 0) + '"></div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' +
        '\u2705 ' + (t.passed || 0) + ' passed \u00b7 ' +
        '\u274c ' + (t.failed || 0) + ' failed \u00b7 ' +
        '\ud83d\udea7 ' + blockedLabel + ' \u00b7 ' +
        '\u2b1c ' + (t.untested || 0) + ' untested' +
      '</div>' +
      '</div>';
  });

  el.innerHTML = html;
}

// --- 7. Recent Bugs ---
function renderRecentBugs(bugs) {
  var el = document.getElementById('recent-bugs');
  if (!el) return;
  if (!bugs) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No bug data</p>';
    return;
  }
  var html = '';

  if (bugs.qa && bugs.qa.length > 0) {
    html += '<div style="padding:12px 16px;font-weight:600;color:var(--green);border-bottom:1px solid var(--border);">' +
      'QA Catches</div>';
    html += '<table><thead><tr><th>Key</th><th>Summary</th></tr></thead><tbody>';
    bugs.qa.forEach(function(b) {
      html += '<tr>' +
        '<td><a class="ticket-link" href="' + jiraUrl(b.key) + '" target="_blank">' + b.key + '</a></td>' +
        '<td>' + b.summary + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }

  if (bugs.customer && bugs.customer.length > 0) {
    html += '<div style="padding:12px 16px;font-weight:600;color:var(--red);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">' +
      'Customer Reports (STFS)</div>';
    html += '<table><thead><tr><th>Key</th><th>Summary</th></tr></thead><tbody>';
    bugs.customer.forEach(function(b) {
      html += '<tr>' +
        '<td><a class="ticket-link" href="' + jiraUrl(b.key) + '" target="_blank">' + b.key + '</a></td>' +
        '<td>' + b.summary + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }

  if (!html) {
    html = '<p style="padding:16px;color:var(--text-secondary)">No bug data</p>';
  }

  el.innerHTML = html;
}

// === Compare Mode Handler ===
document.addEventListener('compare-toggled', function(e) {
  if (!_qaData) return;
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!prevData) return;

  // --- BCR Hero Delta ---
  var heroEl = document.getElementById('bcr-hero-delta');
  if (heroEl) {
    if (active && prevData.bcr && _qaData.bcr) {
      var bcrDelta = (_qaData.bcr.overall - prevData.bcr.overall).toFixed(1);
      var deltaNum = parseFloat(bcrDelta);
      var cls = deltaNum > 0 ? 'up' : (deltaNum < 0 ? 'down' : 'neutral');
      var arrow = deltaNum > 0 ? '\u2191' : (deltaNum < 0 ? '\u2193' : '\u2192');
      heroEl.innerHTML = '<span class="kpi-delta ' + cls + '" style="font-size:18px;">' +
        arrow + ' ' + Math.abs(deltaNum).toFixed(1) + 'pp</span>';
    } else {
      heroEl.innerHTML = '';
    }
  }

  // --- Test Execution Deltas ---
  var testExecEl = document.getElementById('test-exec');
  if (testExecEl && active && prevData.testExecution && _qaData.testExecution && typeof _qaData.testExecution.totalRuns === 'number') {
    var teCards = testExecEl.querySelectorAll('.kpi-card');
    if (teCards[0]) addKpiDelta(teCards[0], computeDeltaPct(_qaData.testExecution.totalRuns, prevData.testExecution.totalRuns));
    if (teCards[1]) {
      var currPR = (_qaData.testExecution.passRate * 100).toFixed(1);
      var prevPR = (prevData.testExecution.passRate * 100).toFixed(1);
      addKpiDelta(teCards[1], Math.round(currPR - prevPR));
    }
    if (teCards[2]) addKpiDelta(teCards[2], computeDeltaPct(_qaData.testExecution.velocity, prevData.testExecution.velocity));
  } else if (testExecEl) {
    removeAllKpiDeltas('test-exec');
  }
});
