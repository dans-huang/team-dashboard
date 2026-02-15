// === DSAT Analysis Page ===

var _dsatData = null;

function renderDsatHero(data) {
  var pct = (data.aiNegativeRate * 100).toFixed(1);
  var cls = 'ok';
  if (data.aiNegativeRate > 0.3) cls = 'bad';
  else if (data.aiNegativeRate > 0.2) cls = 'warn';

  document.getElementById('dsat-hero').innerHTML =
    '<div class="big-number">' +
      '<div class="big-number-value ' + cls + '">' + pct + '%</div>' +
      '<div id="dsat-hero-delta" style="margin-top:4px;"></div>' +
      '<div class="kpi-label">AI-Related DSAT Rate (of comments)</div>' +
    '</div>';
}

function renderDsatKpis(data) {
  document.getElementById('dsat-kpis').innerHTML =
    kpiCard('Total Bad Ratings', formatNumber(data.totalBadRatings)) +
    kpiCard('With Comments', formatNumber(data.withComments)) +
    kpiCard('AI-Negative', formatNumber(data.aiNegative));
}

function renderAiPie(data) {
  var ctx = document.getElementById('ai-pie-chart').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['AI-Negative', 'Other DSAT'],
      datasets: [{
        data: [data.aiNegative, data.withComments - data.aiNegative],
        backgroundColor: ['#ef4444', '#30363d'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderTopReasons(reasons) {
  var ctx = document.getElementById('reasons-chart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reasons.map(function(r) { return r.reason; }),
      datasets: [{
        data: reasons.map(function(r) { return r.count; }),
        backgroundColor: '#f9731688',
        borderColor: '#f97316',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#30363d' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderSampleTickets(samples) {
  var html = '<table><thead><tr>' +
    '<th>Ticket</th><th>Product</th><th>Comment</th>' +
    '</tr></thead><tbody>';

  samples.forEach(function(s, i) {
    var shortComment = s.comment.length > 80
      ? s.comment.substring(0, 80) + '...'
      : s.comment;

    html += '<tr class="expandable" data-detail="sample-detail-' + i + '">' +
      '<td><a class="ticket-link" href="' + zenUrl(s.ticketId) + '" target="_blank">#' + s.ticketId + '</a></td>' +
      '<td>' + s.product + '</td>' +
      '<td>' + shortComment + '</td>' +
      '</tr>';

    html += '<tr><td colspan="3">' +
      '<div class="detail-panel" id="sample-detail-' + i + '">' +
      '<p style="white-space:pre-wrap">' + s.comment + '</p>' +
      '</div></td></tr>';
  });

  html += '</tbody></table>';
  document.getElementById('sample-table').innerHTML = html;
}

// === Main ===
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadData('dsat');
    _dsatData = data;
    document.getElementById('period').textContent = data.period;
    renderDsatHero(data);
    renderDsatKpis(data);
    renderAiPie(data);
    renderTopReasons(data.topReasons);
    renderSampleTickets(data.samples);
    initExpandableRows();
    initCompare('dsat');
  } catch (err) {
    document.getElementById('content').innerHTML =
      '<p style="color:var(--red)">Error loading DSAT data: ' + err.message + '</p>';
  }
});

// === Compare Mode Handler ===
document.addEventListener('compare-toggled', function(e) {
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!_dsatData || !prevData) return;

  // --- DSAT Hero Delta ---
  var heroEl = document.getElementById('dsat-hero-delta');
  if (heroEl) {
    if (active) {
      var currPct = (_dsatData.aiNegativeRate * 100).toFixed(1);
      var prevPct = (prevData.aiNegativeRate * 100).toFixed(1);
      var deltaNum = parseFloat((currPct - prevPct).toFixed(1));
      // For DSAT rate, lower is better — so positive delta is bad (up=red), negative is good (down=green)
      var cls = deltaNum > 0 ? 'down' : (deltaNum < 0 ? 'up' : 'neutral');
      var arrow = deltaNum > 0 ? '\u2191' : (deltaNum < 0 ? '\u2193' : '\u2192');
      heroEl.innerHTML = '<span class="kpi-delta ' + cls + '" style="font-size:18px;">' +
        arrow + ' ' + Math.abs(deltaNum).toFixed(1) + ' pp vs prev week</span>';
    } else {
      heroEl.innerHTML = '';
    }
  }

  // --- DSAT KPI Deltas ---
  var dsatKpiEl = document.getElementById('dsat-kpis');
  if (active) {
    var cards = dsatKpiEl.querySelectorAll('.kpi-card');
    // Total Bad Ratings delta
    if (cards[0]) addKpiDelta(cards[0], computeDeltaPct(_dsatData.totalBadRatings, prevData.totalBadRatings));
    // With Comments delta
    if (cards[1]) addKpiDelta(cards[1], computeDeltaPct(_dsatData.withComments, prevData.withComments));
    // AI-Negative delta
    if (cards[2]) addKpiDelta(cards[2], computeDeltaPct(_dsatData.aiNegative, prevData.aiNegative));
  } else {
    removeAllKpiDeltas('dsat-kpis');
  }

  // --- Top Reasons Chart: overlay prev week ---
  var reasonsCanvas = document.getElementById('reasons-chart');
  var reasonsChart = Chart.getChart(reasonsCanvas);
  if (reasonsChart) {
    if (active && prevData.topReasons) {
      if (reasonsChart.data.datasets.length < 2) {
        reasonsChart.data.datasets.push({
          label: 'Previous Week',
          data: prevData.topReasons.map(function(r) { return r.count; }),
          backgroundColor: '#8b949e44',
          borderColor: '#8b949e',
          borderWidth: 1,
          borderRadius: 4
        });
      }
    } else {
      reasonsChart.data.datasets = reasonsChart.data.datasets.slice(0, 1);
    }
    reasonsChart.update();
  }
});
