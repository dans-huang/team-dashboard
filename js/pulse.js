// === Pulse Page Rendering ===

var _pulseData = null;

function initPulsePage(data) {
  _pulseData = data;
  var periodEl = document.getElementById('period');
  if (periodEl && data.period) periodEl.textContent = data.period;
  renderAlerts(data.alerts);
  renderKpi(data.kpi);
  renderDailyTrend(data.dailyTrend);
  renderProductBreakdown(data.productBreakdown);
  renderTicketTypes(data.ticketTypes);
  renderAiOps(data.aiOps);
  renderAiOpportunities(data.aiOpportunities);
  renderStfs(data.stfs);
  initExpandableRows();
}

// --- Ticket Type Breakdown ---
function renderTicketTypes(types) {
  var el = document.getElementById('type-table');
  if (!el) return;
  if (!types || types.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No ticket type data</p>';
    return;
  }
  var rows = types.map(function(t) {
    var pct = typeof t.pct === 'number' ? t.pct.toFixed(1) + '%' : '-';
    return '<tr>' +
      '<td><strong>' + (t.type || '-') + '</strong></td>' +
      '<td>' + formatNumber(t.count) + '</td>' +
      '<td>' + pct + '</td>' +
      '<td>' + formatDelta(t.delta) + '</td>' +
    '</tr>';
  }).join('');
  el.innerHTML =
    '<table>' +
    '<thead><tr><th>Type</th><th>Count</th><th>%</th><th>vs Prev</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>';
}

// --- AI Operations ---
function renderAiOps(ai) {
  var el = document.getElementById('ai-ops');
  if (!el) return;
  if (!ai) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No AI Ops data</p>';
    return;
  }
  var resRate = typeof ai.aiResolutionRate === 'number' ? ai.aiResolutionRate.toFixed(1) + '%' : '-';
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
  if (!el) return;
  if (!opps || opps.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No data</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Tally</th><th>Volume</th><th>AI Res Rate</th>' +
    '</tr></thead><tbody>';

  opps.forEach(function(o) {
    var rate = typeof o.aiResRate === 'number' ? o.aiResRate.toFixed(1) + '%' : '-';
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
  if (!_pulseData) return;
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!prevData) return;

  // --- Daily Trend Chart ---
  var canvas = document.getElementById('daily-trend-chart');
  if (canvas) {
    var chart = Chart.getChart(canvas);
    if (chart) {
      if (active && prevData.dailyTrend && prevData.dailyTrend.length > 0) {
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
  }

  // --- KPI Deltas ---
  var kpiEl = document.getElementById('kpi-cards');
  if (kpiEl) {
    if (active && _pulseData.kpi && prevData.kpi) {
      var cards = kpiEl.querySelectorAll('.kpi-card');
      if (cards[0] && typeof _pulseData.kpi.totalTickets === 'number' && typeof prevData.kpi.totalTickets === 'number') {
        addKpiDelta(cards[0], computeDeltaPct(_pulseData.kpi.totalTickets, prevData.kpi.totalTickets));
      }
      if (cards[2] && typeof _pulseData.kpi.refunds === 'number' && typeof prevData.kpi.refunds === 'number') {
        addKpiDelta(cards[2], computeDeltaPct(_pulseData.kpi.refunds, prevData.kpi.refunds));
      }
    } else {
      removeAllKpiDeltas('kpi-cards');
    }
  }

  // --- AI Ops Deltas ---
  var aiOpsEl = document.getElementById('ai-ops');
  if (aiOpsEl) {
    if (active && _pulseData.aiOps && prevData.aiOps) {
      var aiCards = aiOpsEl.querySelectorAll('.kpi-card');
      if (aiCards[0] && typeof _pulseData.aiOps.aiResolutionRate === 'number' && typeof prevData.aiOps.aiResolutionRate === 'number') {
        var currRate = _pulseData.aiOps.aiResolutionRate;
        var prevRate = prevData.aiOps.aiResolutionRate;
        var rateDelta = Math.round(currRate - prevRate);
        addKpiDelta(aiCards[0], rateDelta);
      }
    } else {
      removeAllKpiDeltas('ai-ops');
    }
  }
});
