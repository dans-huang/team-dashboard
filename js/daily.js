// === Daily Page Rendering ===

var _dailyData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData('daily');
    _dailyData = data;
    document.getElementById('period').textContent = data.period;
    renderDailyKpi(data.kpi);
    renderProductChart(data.productBreakdown);
    renderTypeChart(data.ticketTypes);
    renderAgentTable(data.agentActivity);
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<p style="color:var(--red)">Error loading daily data: ' + err.message + '</p>';
  }
});

// --- KPI Cards ---
function renderDailyKpi(kpi) {
  var el = document.getElementById('kpi-cards');
  if (!kpi) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No KPI data</p>';
    return;
  }
  el.innerHTML = [
    kpiCard('Total Tickets', formatNumber(kpi.totalTickets)),
    kpiCard('#1 Product', kpi.topProduct || '-'),
    kpiCard('Refund Requests', formatNumber(kpi.refunds)),
    kpiCard('Products', kpi.productCount != null ? kpi.productCount : '-')
  ].join('');
}

// --- Product Distribution (horizontal bar) ---
function renderProductChart(products) {
  var canvas = document.getElementById('product-chart');
  if (!products || products.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No product data</p>';
    return;
  }

  // Set height based on number of items
  var barHeight = 32;
  var chartHeight = Math.max(200, products.length * barHeight + 60);
  canvas.parentElement.style.height = chartHeight + 'px';

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: products.map(function(p) { return p.product; }),
      datasets: [{
        data: products.map(function(p) { return p.count; }),
        backgroundColor: '#7c3aed88',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var item = products[ctx.dataIndex];
              return item.count + ' tickets (' + item.pct + '%)';
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#30363d' }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 12 } }
        }
      }
    }
  });
}

// --- Ticket Type Distribution (horizontal bar) ---
function renderTypeChart(types) {
  var canvas = document.getElementById('type-chart');
  if (!types || types.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No ticket type data</p>';
    return;
  }

  var barHeight = 32;
  var chartHeight = Math.max(200, types.length * barHeight + 60);
  canvas.parentElement.style.height = chartHeight + 'px';

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: types.map(function(t) { return t.type; }),
      datasets: [{
        data: types.map(function(t) { return t.count; }),
        backgroundColor: '#2dd4bf88',
        borderColor: '#2dd4bf',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var item = types[ctx.dataIndex];
              return item.count + ' tickets (' + item.pct + '%)';
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#30363d' }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 12 } }
        }
      }
    }
  });
}

// --- Agent Activity Table ---
function renderAgentTable(agents) {
  var el = document.getElementById('agent-table');
  if (!agents || agents.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No agent activity data</p>';
    return;
  }

  var rows = agents.map(function(a) {
    return '<tr>' +
      '<td><strong>' + a.name + '</strong></td>' +
      '<td>' + formatNumber(a.assigned) + '</td>' +
      '<td>' + formatNumber(a.replies) + '</td>' +
      '<td>' + a.avgAssignedPerDay + '</td>' +
      '<td>' + a.avgRepliesPerDay + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML =
    '<table>' +
    '<thead><tr>' +
      '<th>Agent</th>' +
      '<th>Assigned (7d)</th>' +
      '<th>Replied (7d)</th>' +
      '<th>Avg Assigned/Day</th>' +
      '<th>Avg Replies/Day</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>';
}
