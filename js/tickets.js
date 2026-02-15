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
  const rows = types.map(t =>
    '<tr>' +
      '<td><strong>' + t.type + '</strong></td>' +
      '<td>' + t.count + '</td>' +
      '<td>' + t.pct.toFixed(1) + '%</td>' +
      '<td>' + formatDelta(t.delta) + '</td>' +
    '</tr>'
  ).join('');
  document.getElementById('type-table').innerHTML =
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
    if (active) {
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
    if (cards[0]) addKpiDelta(cards[0], computeDeltaPct(_ticketsData.kpi.totalTickets, prevData.kpi.totalTickets));
    // Refunds delta
    if (cards[2]) addKpiDelta(cards[2], computeDeltaPct(_ticketsData.kpi.refunds, prevData.kpi.refunds));
  } else {
    removeAllKpiDeltas('kpi-cards');
  }
});
