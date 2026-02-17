// === DSAT Analysis Page ===

var _dsatData = null;

function initDsatPage(data) {
  _dsatData = data;
  var periodEl = document.getElementById('period');
  if (periodEl && data.period) periodEl.textContent = data.period;
  renderDsatHero(data);
  renderDsatKpis(data);
  renderAiPie(data);
  renderTopReasons(data.topReasons);
  renderSampleTickets(data.samples);
  initExpandableRows();
}

function renderDsatHero(data) {
  var el = document.getElementById('dsat-hero');
  if (!el) return;
  var rate, pct;
  if (typeof data.aiNegativeRateOfComments === 'number') {
    rate = data.aiNegativeRateOfComments;
    pct = rate.toFixed(1);
  } else if (typeof data.aiNegativeRate === 'number') {
    rate = data.aiNegativeRate * 100;
    pct = rate.toFixed(1);
  } else {
    rate = 0;
    pct = '0.0';
  }

  var cls = 'ok';
  if (rate > 30) cls = 'bad';
  else if (rate > 20) cls = 'warn';

  el.innerHTML =
    '<div class="big-number">' +
      '<div class="big-number-value ' + cls + '">' + pct + '%</div>' +
      '<div id="dsat-hero-delta" style="margin-top:4px;"></div>' +
      '<div class="kpi-label">AI-Related DSAT Rate (of comments)</div>' +
    '</div>';
}

function renderDsatKpis(data) {
  var el = document.getElementById('dsat-kpis');
  if (!el) return;
  el.innerHTML =
    kpiCard('Total Bad Ratings', safeFormatNumber(data.totalBadRatings)) +
    kpiCard('With Comments', safeFormatNumber(data.withComments)) +
    kpiCard('AI-Negative', safeFormatNumber(data.aiNegative));
}

function renderAiPie(data) {
  var canvas = document.getElementById('ai-pie-chart');
  if (!canvas) return;
  var aiNeg = data.aiNegative || 0;
  var withComments = data.withComments || 0;
  var otherDsat = Math.max(0, withComments - aiNeg);

  if (aiNeg === 0 && otherDsat === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No data for pie chart</p>';
    return;
  }

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['AI-Negative', 'Other DSAT'],
      datasets: [{
        data: [aiNeg, otherDsat],
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
  var canvas = document.getElementById('reasons-chart');
  if (!canvas) return;
  if (!reasons || reasons.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No top reasons data available</p>';
    return;
  }
  var ctx = canvas.getContext('2d');
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
  var el = document.getElementById('sample-table');
  if (!el) return;
  if (!samples || samples.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No sample tickets</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Ticket</th><th>Product</th><th>Comment</th>' +
    '</tr></thead><tbody>';

  samples.forEach(function(s, i) {
    var comment = s.comment || '';
    var shortComment = comment.length > 80
      ? comment.substring(0, 80) + '...'
      : comment;

    html += '<tr class="expandable" data-detail="sample-detail-' + i + '">' +
      '<td><a class="ticket-link" href="' + zenUrl(s.ticketId) + '" target="_blank">#' + s.ticketId + '</a></td>' +
      '<td>' + (s.product || '-') + '</td>' +
      '<td>' + shortComment + '</td>' +
      '</tr>';

    html += '<tr><td colspan="3">' +
      '<div class="detail-panel" id="sample-detail-' + i + '">' +
      '<p style="white-space:pre-wrap">' + comment + '</p>' +
      '</div></td></tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// === Helpers to get DSAT rate from either format ===
function getDsatRatePct(data) {
  if (typeof data.aiNegativeRateOfComments === 'number') {
    return data.aiNegativeRateOfComments;
  }
  if (typeof data.aiNegativeRate === 'number') {
    return data.aiNegativeRate * 100;
  }
  return 0;
}

// === Compare Mode Handler ===
document.addEventListener('compare-toggled', function(e) {
  if (!_dsatData) return;
  var detail = e.detail;
  var active = detail.active;
  var prevData = detail.prevData;
  if (!prevData) return;

  // --- DSAT Hero Delta ---
  var heroEl = document.getElementById('dsat-hero-delta');
  if (heroEl) {
    if (active) {
      var currPct = getDsatRatePct(_dsatData);
      var prevPct = getDsatRatePct(prevData);
      var deltaNum = parseFloat((currPct - prevPct).toFixed(1));
      var cls = deltaNum > 0 ? 'down' : (deltaNum < 0 ? 'up' : 'neutral');
      var arrow = deltaNum > 0 ? '\u2191' : (deltaNum < 0 ? '\u2193' : '\u2192');
      heroEl.innerHTML = '<span class="kpi-delta ' + cls + '" style="font-size:18px;">' +
        arrow + ' ' + Math.abs(deltaNum).toFixed(1) + 'pp</span>';
    } else {
      heroEl.innerHTML = '';
    }
  }

  // --- DSAT KPI Deltas ---
  var dsatKpiEl = document.getElementById('dsat-kpis');
  if (dsatKpiEl) {
    if (active) {
      var cards = dsatKpiEl.querySelectorAll('.kpi-card');
      if (cards[0] && typeof _dsatData.totalBadRatings === 'number' && typeof prevData.totalBadRatings === 'number') {
        addKpiDelta(cards[0], computeDeltaPct(_dsatData.totalBadRatings, prevData.totalBadRatings));
      }
      if (cards[1] && typeof _dsatData.withComments === 'number' && typeof prevData.withComments === 'number') {
        addKpiDelta(cards[1], computeDeltaPct(_dsatData.withComments, prevData.withComments));
      }
      if (cards[2] && typeof _dsatData.aiNegative === 'number' && typeof prevData.aiNegative === 'number') {
        addKpiDelta(cards[2], computeDeltaPct(_dsatData.aiNegative, prevData.aiNegative));
      }
    } else {
      removeAllKpiDeltas('dsat-kpis');
    }
  }

  // --- Top Reasons Chart: overlay prev week ---
  var reasonsCanvas = document.getElementById('reasons-chart');
  if (reasonsCanvas) {
    var reasonsChart = Chart.getChart(reasonsCanvas);
    if (reasonsChart) {
      if (active && prevData.topReasons && prevData.topReasons.length > 0) {
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
  }
});
