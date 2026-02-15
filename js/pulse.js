// === Pulse Page Rendering ===

var _pulseData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData('pulse');
    _pulseData = data;
    document.getElementById('period').textContent = data.period;
    renderAlerts(data.alerts);
    renderKpi(data.kpi);
    renderDailyTrend(data.dailyTrend);
    renderProductBreakdown(data.productBreakdown);
    renderAiOps(data.aiOps);
    renderAiOpportunities(data.aiOpportunities);
    renderStfs(data.stfs);
    initExpandableRows();
    initCompare('pulse');
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<p style="color:var(--red)">Error loading pulse data: ' + err.message + '</p>';
  }
});

// --- AI Operations (Pulse-only) ---
function renderAiOps(ai) {
  const el = document.getElementById('ai-ops');
  el.innerHTML = [
    kpiCard('AI Resolution Rate', (ai.aiResolutionRate * 100).toFixed(1) + '%'),
    kpiCard('AI CSAT', ai.aiCsat.toFixed(1)),
    kpiCard('Human CSAT', ai.humanCsat.toFixed(1))
  ].join('');
}

// --- AI Automation Opportunities (Pulse-only) ---
function renderAiOpportunities(opps) {
  const el = document.getElementById('ai-opportunities');
  if (!opps || opps.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No data</p>';
    return;
  }
  let html = '<table><thead><tr>' +
    '<th>Tally</th><th>Volume</th><th>AI Res Rate</th>' +
    '</tr></thead><tbody>';

  opps.forEach(o => {
    html += '<tr>' +
      '<td>' + o.tally + '</td>' +
      '<td>' + formatNumber(o.count) + '</td>' +
      '<td>' + (o.aiResRate * 100).toFixed(1) + '%</td>' +
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
  if (!_pulseData || !prevData) return;

  // --- Daily Trend Chart ---
  var canvas = document.getElementById('daily-trend-chart');
  var chart = Chart.getChart(canvas);
  if (chart) {
    if (active) {
      // Only add if not already added
      if (chart.data.datasets.length < 2) {
        chart.data.datasets.push({
          label: 'Previous Week',
          data: prevData.dailyTrend.map(function(d) { return d.count; }),
          backgroundColor: '#8b949e44',
          borderColor: '#8b949e',
          borderWidth: 1,
          borderRadius: 4
        });
      }
    } else {
      chart.data.datasets = chart.data.datasets.slice(0, 1);
    }
    chart.update();
  }

  // --- KPI Deltas ---
  var kpiEl = document.getElementById('kpi-cards');
  if (active) {
    var cards = kpiEl.querySelectorAll('.kpi-card');
    // Total Tickets delta
    if (cards[0]) addKpiDelta(cards[0], computeDeltaPct(_pulseData.kpi.totalTickets, prevData.kpi.totalTickets));
    // Refunds delta
    if (cards[2]) addKpiDelta(cards[2], computeDeltaPct(_pulseData.kpi.refunds, prevData.kpi.refunds));
  } else {
    removeAllKpiDeltas('kpi-cards');
  }

  // --- AI Ops Deltas ---
  var aiOpsEl = document.getElementById('ai-ops');
  if (active && prevData.aiOps) {
    var aiCards = aiOpsEl.querySelectorAll('.kpi-card');
    // AI Resolution Rate delta (percentage points)
    if (aiCards[0]) {
      var currRate = (_pulseData.aiOps.aiResolutionRate * 100).toFixed(1);
      var prevRate = (prevData.aiOps.aiResolutionRate * 100).toFixed(1);
      var rateDelta = Math.round(currRate - prevRate);
      addKpiDelta(aiCards[0], rateDelta);
    }
  } else {
    removeAllKpiDeltas('ai-ops');
  }
});
