// === Daily Page Rendering ===

var _dailyData = null;

function initDailyPage(data) {
  _dailyData = data;
  var periodEl = document.getElementById('period');
  if (periodEl && data.period) periodEl.textContent = data.period;
  renderDailyKpi(data.kpi);
  renderProductChart(data.productBreakdown);
  renderTypeChart(data.ticketTypes);
  // Render table immediately with today's data, then enhance with 7-day avg
  renderAgentTable(data.agentActivity, null);
  load7DayAgentAvg(data);
}

async function load7DayAgentAvg(todayData) {
  var currentDate = todayData.startDate || todayData.endDate;
  if (!currentDate || !_indexCache || !_indexCache.days) return;

  // Find previous 6 days from index
  var dayIdx = _indexCache.days.indexOf(currentDate);
  if (dayIdx < 0) return;

  var prevDays = _indexCache.days.slice(dayIdx + 1, dayIdx + 7);
  if (prevDays.length === 0) return;

  // Fetch previous days' data
  var fetches = prevDays.map(function(d) {
    return fetch('data/daily/' + d + '.json', _fetchOpts)
      .then(function(r) { return r.ok ? r.json() : null; })
      .catch(function() { return null; });
  });
  var results = await Promise.all(fetches);

  // Collect all days' agent data (including today)
  var allDays = [todayData].concat(results.filter(function(r) { return r != null; }));
  var totalDays = allDays.length;

  // Sum per agent across all days
  var agentSums = {};
  allDays.forEach(function(dayData) {
    if (!dayData.agentActivity) return;
    dayData.agentActivity.forEach(function(a) {
      if (!agentSums[a.name]) agentSums[a.name] = { assigned: 0, replies: 0, days: 0 };
      agentSums[a.name].assigned += a.assigned || 0;
      agentSums[a.name].replies += a.replies || 0;
      agentSums[a.name].days++;
    });
  });

  // Build averages map
  var avgMap = {};
  Object.keys(agentSums).forEach(function(name) {
    var s = agentSums[name];
    avgMap[name] = {
      avgAssigned: Math.round(s.assigned / totalDays * 10) / 10,
      avgReplies: Math.round(s.replies / totalDays * 10) / 10
    };
  });

  // Re-render with averages
  renderAgentTable(todayData.agentActivity, avgMap, totalDays);
}

// --- KPI Cards ---
function renderDailyKpi(kpi) {
  var el = document.getElementById('kpi-cards');
  if (!el) return;
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
  if (!canvas) return;
  if (!products || products.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No product data</p>';
    return;
  }

  var isMobile = window.innerWidth < 768;
  var barHeight = isMobile ? 28 : 32;
  var chartHeight = Math.max(180, products.length * barHeight + 50);
  canvas.parentElement.style.height = chartHeight + 'px';

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: products.map(function(p) { return p.product; }),
      datasets: [{
        data: products.map(function(p) { return p.count; }),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: '#3b82f6',
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
          beginAtZero: true
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: isMobile ? 11 : 12 } }
        }
      }
    }
  });
}

// --- Ticket Type Distribution (horizontal bar) ---
function renderTypeChart(types) {
  var canvas = document.getElementById('type-chart');
  if (!canvas) return;
  if (!types || types.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No ticket type data</p>';
    return;
  }

  var isMobile = window.innerWidth < 768;
  var barHeight = isMobile ? 28 : 32;
  var chartHeight = Math.max(180, types.length * barHeight + 50);
  canvas.parentElement.style.height = chartHeight + 'px';

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: types.map(function(t) { return t.type; }),
      datasets: [{
        data: types.map(function(t) { return t.count; }),
        backgroundColor: 'rgba(6, 182, 212, 0.5)',
        borderColor: '#06b6d4',
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
          beginAtZero: true
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: isMobile ? 11 : 12 } }
        }
      }
    }
  });
}

// --- Agent Activity Table ---
function renderAgentTable(agents, avgMap, totalDays) {
  var el = document.getElementById('agent-table');
  if (!el) return;
  if (!agents || agents.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No agent activity data</p>';
    return;
  }

  var hasAvg = avgMap != null;
  var avgLabel = totalDays ? totalDays + 'd' : '7d';

  var rows = agents.map(function(a) {
    var avg = hasAvg && avgMap[a.name];
    return '<tr>' +
      '<td><strong>' + a.name + '</strong></td>' +
      '<td>' + formatNumber(a.assigned) + '</td>' +
      '<td>' + formatNumber(a.replies) + '</td>' +
      (hasAvg ? '<td>' + (avg ? avg.avgAssigned.toFixed(1) : '-') + '</td>' : '') +
      (hasAvg ? '<td>' + (avg ? avg.avgReplies.toFixed(1) : '-') + '</td>' : '') +
    '</tr>';
  }).join('');

  el.innerHTML =
    '<table>' +
    '<thead><tr>' +
      '<th>Agent</th>' +
      '<th>Assigned</th>' +
      '<th>Replied</th>' +
      (hasAvg ? '<th>Avg Assigned/' + avgLabel + '</th>' : '') +
      (hasAvg ? '<th>Avg Replied/' + avgLabel + '</th>' : '') +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>';
}
