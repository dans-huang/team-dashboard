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
  var el = document.getElementById('ai-ops');
  if (!ai) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No AI Ops data</p>';
    return;
  }
  var resRate = typeof ai.aiResolutionRate === 'number' ? (ai.aiResolutionRate * 100).toFixed(1) + '%' : '-';
  var aiCsat = typeof ai.aiCsat === 'number' ? ai.aiCsat.toFixed(1) : '-';
  var humanCsat = typeof ai.humanCsat === 'number' ? ai.humanCsat.toFixed(1) : '-';

  el.innerHTML = [
    kpiCard('AI Resolution Rate', resRate),
    kpiCard('AI CSAT', aiCsat),
    kpiCard('Human CSAT', humanCsat)
  ].join('');
}

// --- AI Automation Opportunities (Pulse-only) ---
function renderAiOpportunities(opps) {
  var el = document.getElementById('ai-opportunities');
  if (!opps || opps.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No data</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Tally</th><th>Volume</th><th>AI Res Rate</th>' +
    '</tr></thead><tbody>';

  opps.forEach(function(o) {
    var rate = typeof o.aiResRate === 'number' ? (o.aiResRate * 100).toFixed(1) + '%' : '-';
    html += '<tr>' +
      '<td>' + (o.tally || '-') + '</td>' +
      '<td>' + formatNumber(o.count) + '</td>' +
      '<td>' + rate + '</td>' +
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
    if (active && prevData.dailyTrend && prevData.dailyTrend.length > 0) {
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
  if (active && _pulseData.kpi && prevData.kpi) {
    var cards = kpiEl.querySelectorAll('.kpi-card');
    // Total Tickets delta
    if (cards[0] && typeof _pulseData.kpi.totalTickets === 'number' && typeof prevData.kpi.totalTickets === 'number') {
      addKpiDelta(cards[0], computeDeltaPct(_pulseData.kpi.totalTickets, prevData.kpi.totalTickets));
    }
    // Refunds delta
    if (cards[2] && typeof _pulseData.kpi.refunds === 'number' && typeof prevData.kpi.refunds === 'number') {
      addKpiDelta(cards[2], computeDeltaPct(_pulseData.kpi.refunds, prevData.kpi.refunds));
    }
  } else {
    removeAllKpiDeltas('kpi-cards');
  }

  // --- AI Ops Deltas ---
  var aiOpsEl = document.getElementById('ai-ops');
  if (active && _pulseData.aiOps && prevData.aiOps) {
    var aiCards = aiOpsEl.querySelectorAll('.kpi-card');
    // AI Resolution Rate delta (percentage points)
    if (aiCards[0] && typeof _pulseData.aiOps.aiResolutionRate === 'number' && typeof prevData.aiOps.aiResolutionRate === 'number') {
      var currRate = (_pulseData.aiOps.aiResolutionRate * 100).toFixed(1);
      var prevRate = (prevData.aiOps.aiResolutionRate * 100).toFixed(1);
      var rateDelta = Math.round(currRate - prevRate);
      addKpiDelta(aiCards[0], rateDelta);
    }
  } else {
    removeAllKpiDeltas('ai-ops');
  }
});
