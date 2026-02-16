// === Ticket Trend Page Rendering ===

var _ticketsData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData('tickets');
    _ticketsData = data;
    document.getElementById('period').textContent = data.period;
    renderAlerts(data.alerts);
    renderKpi(data.kpi);
    renderDailyTrend(data.dailyTrend);
    renderProductBreakdown(data.productBreakdown);
    renderTicketTypes(data.ticketTypes);
    renderStfs(data.stfs);
    initExpandableRows();
    initCompare('tickets');
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<p style="color:var(--red)">Error loading ticket data: ' + err.message + '</p>';
  }
});

// --- Ticket Type Breakdown (Tickets-only) ---
function renderTicketTypes(types) {
  var el = document.getElementById('type-table');
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

// === Compare Mode Handler ===
document.addEventListener('compare-toggled', function(e) {
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!_ticketsData || !prevData) return;

  // --- Daily Trend Chart ---
  var canvas = document.getElementById('daily-trend-chart');
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

  // --- KPI Deltas ---
  var kpiEl = document.getElementById('kpi-cards');
  if (active && _ticketsData.kpi && prevData.kpi) {
    var cards = kpiEl.querySelectorAll('.kpi-card');
    // Total Tickets delta
    if (cards[0] && typeof _ticketsData.kpi.totalTickets === 'number' && typeof prevData.kpi.totalTickets === 'number') {
      addKpiDelta(cards[0], computeDeltaPct(_ticketsData.kpi.totalTickets, prevData.kpi.totalTickets));
    }
    // Refunds delta
    if (cards[2] && typeof _ticketsData.kpi.refunds === 'number' && typeof prevData.kpi.refunds === 'number') {
      addKpiDelta(cards[2], computeDeltaPct(_ticketsData.kpi.refunds, prevData.kpi.refunds));
    }
  } else {
    removeAllKpiDeltas('kpi-cards');
  }
});
