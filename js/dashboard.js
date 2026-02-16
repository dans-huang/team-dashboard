// === URL Params ===
function getWeekParam() {
  return new URLSearchParams(location.search).get('week') || 'latest';
}

function setWeekParam(week) {
  const url = new URL(location.href);
  url.searchParams.set('week', week);
  location.href = url.toString();
}

// === Data Loading ===
let _indexCache = null;

async function loadIndex() {
  if (_indexCache) return _indexCache;
  const resp = await fetch('data/index.json');
  _indexCache = await resp.json();
  return _indexCache;
}

async function loadData(report) {
  const idx = await loadIndex();
  const weekParam = getWeekParam();
  const week = weekParam === 'latest' ? idx.latest : weekParam;
  const resp = await fetch(`data/${report}/${week}.json`);
  if (!resp.ok) throw new Error(`No data for ${report}/${week}`);
  return resp.json();
}

async function loadWeekData(report, week) {
  const resp = await fetch(`data/${report}/${week}.json`);
  if (!resp.ok) return null;
  return resp.json();
}

// === Nav Setup ===
function initNav() {
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-tabs a').forEach(a => {
    if (a.getAttribute('href') === currentPage) a.classList.add('active');
  });

  loadIndex().then(idx => {
    const select = document.getElementById('week-select');
    if (!select) return;
    const currentWeek = getWeekParam();
    idx.weeks.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      if (w === idx.latest && currentWeek === 'latest') opt.selected = true;
      if (w === currentWeek) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => setWeekParam(select.value));
  });
}

// === Chart.js Defaults ===
function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#8b949e';
  Chart.defaults.borderColor = '#30363d';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  Chart.defaults.font.size = 12;
}

// === Expandable Rows ===
function initExpandableRows() {
  document.querySelectorAll('.expandable').forEach(row => {
    row.addEventListener('click', () => {
      const targetId = row.dataset.detail;
      const panel = document.getElementById(targetId);
      if (!panel) return;
      row.classList.toggle('open');
      panel.classList.toggle('open');
    });
  });
}

// === Formatting Helpers ===
function formatDelta(value) {
  if (value == null || typeof value !== 'number') return '<span class="kpi-delta neutral">-</span>';
  if (value > 0) return '<span class="kpi-delta up">\u2191' + value + '%</span>';
  if (value < 0) return '<span class="kpi-delta down">\u2193' + Math.abs(value) + '%</span>';
  return '<span class="kpi-delta neutral">\u2192 0%</span>';
}

function formatNumber(n) {
  if (n == null || typeof n !== 'number') return '-';
  return n.toLocaleString();
}

function zenUrl(ticketId) {
  return 'https://positivegrid.zendesk.com/agent/tickets/' + ticketId;
}

function jiraUrl(key) {
  return 'https://positivegrid.atlassian.net/browse/' + key;
}

// === Shared Renderers (used by pulse.js + tickets.js) ===

function renderAlerts(alerts) {
  const el = document.getElementById('alerts');
  if (!alerts || alerts.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.innerHTML = '<div class="alert-banner">' +
    alerts.map(function(a) {
      // Handle both formats:
      //   Legacy: { product, type, message }
      //   Production: { severity, message } (no product)
      var prefix = a.product
        ? '<strong>' + a.product + '</strong>: '
        : (a.severity ? '<strong>[' + a.severity.toUpperCase() + ']</strong> ' : '');
      return '<div class="alert-item">\u26a0\ufe0f ' + prefix + (a.message || '') + '</div>';
    }).join('') +
    '</div>';
}

function renderKpi(kpi) {
  const el = document.getElementById('kpi-cards');
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

function kpiCard(label, value) {
  return '<div class="kpi-card">' +
    '<div class="kpi-value">' + value + '</div>' +
    '<div class="kpi-label">' + label + '</div>' +
    '</div>';
}

function renderDailyTrend(trend) {
  var canvas = document.getElementById('daily-trend-chart');
  if (!trend || trend.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No daily trend data</p>';
    return;
  }
  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(d => d.day),
      datasets: [{
        data: trend.map(d => d.count),
        backgroundColor: '#7c3aed88',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#30363d' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderProductBreakdown(products) {
  const el = document.getElementById('product-table');
  if (!products || products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No product breakdown data</p>';
    return;
  }
  let html = '<table><thead><tr>' +
    '<th>Product</th><th>Tickets</th><th>%</th><th>vs Prev</th>' +
    '</tr></thead><tbody>';

  products.forEach((p, i) => {
    html += '<tr class="expandable" data-detail="product-detail-' + i + '">' +
      '<td>' + p.product + '</td>' +
      '<td>' + formatNumber(p.count) + '</td>' +
      '<td>' + (typeof p.pct === 'number' ? p.pct.toFixed(1) + '%' : '-') + '</td>' +
      '<td>' + formatDelta(p.delta) + '</td>' +
      '</tr>';

    // Detail panel row
    html += '<tr><td colspan="4">' +
      '<div class="detail-panel" id="product-detail-' + i + '">';

    if (p.topIssues && p.topIssues.length > 0) {
      html += '<ul>';
      p.topIssues.forEach(issue => {
        var ticketLinks = '';
        if (issue.tickets && issue.tickets.length > 0) {
          ticketLinks = ' — ' + issue.tickets.map(t =>
            '<a class="ticket-link" href="' + zenUrl(t.id) + '" target="_blank">#' + t.id + '</a>'
          ).join(', ');
        }
        html += '<li><strong>' + (issue.tally || '-') + '</strong> (' + formatNumber(issue.count) + ')' + ticketLinks + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<p style="color:var(--text-secondary)">No top issues recorded</p>';
    }

    html += '</div></td></tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

function renderStfs(stfs) {
  const el = document.getElementById('stfs-table');
  if (!stfs || stfs.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No active STFS issues</p>';
    return;
  }
  let html = '<table><thead><tr>' +
    '<th>Issue</th><th>Summary</th><th>Tickets</th><th>DSAT</th>' +
    '</tr></thead><tbody>';

  stfs.forEach(s => {
    html += '<tr>' +
      '<td><a class="ticket-link" href="' + jiraUrl(s.key) + '" target="_blank">' + s.key + '</a></td>' +
      '<td>' + s.summary + '</td>' +
      '<td>' + s.ticketCount + '</td>' +
      '<td>' + (s.dsatCount != null ? s.dsatCount : '-') + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// === Compare Mode ===
let compareMode = false;
let prevWeekData = null;
let _currentReport = null;

function initCompare(report) {
  _currentReport = report;
  const btn = document.getElementById('compare-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    compareMode = !compareMode;
    btn.classList.toggle('active', compareMode);
    btn.textContent = compareMode ? 'Compare \u25C2' : 'Compare \u25B8';

    if (compareMode && !prevWeekData) {
      const idx = await loadIndex();
      const weekParam = getWeekParam();
      const currentWeek = weekParam === 'latest' ? idx.latest : weekParam;
      const currentIdx = idx.weeks.indexOf(currentWeek);
      if (currentIdx >= 0 && currentIdx < idx.weeks.length - 1) {
        const prevWeek = idx.weeks[currentIdx + 1];
        prevWeekData = await loadWeekData(report, prevWeek);
      }
    }

    document.dispatchEvent(new CustomEvent('compare-toggled', {
      detail: { active: compareMode, prevData: prevWeekData }
    }));
  });
}

// === Compare Helpers (shared across pages) ===

function addKpiDelta(card, deltaValue) {
  // Remove any existing delta
  var existing = card.querySelector('.kpi-delta');
  if (existing) existing.remove();
  card.insertAdjacentHTML('beforeend', formatDelta(deltaValue));
}

function removeAllKpiDeltas(containerId) {
  document.querySelectorAll('#' + containerId + ' .kpi-delta').forEach(function(el) {
    el.remove();
  });
}

function computeDeltaPct(current, previous) {
  if (!previous || previous === 0) return 0;
  return Math.round((current - previous) / previous * 100);
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  applyChartDefaults();
});
