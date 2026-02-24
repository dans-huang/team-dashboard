// === View Configuration ===
var VIEWS = {
  daily: {
    reports: [
      { id: 'support', label: 'Support', dataDir: 'daily' }
    ],
    periodType: 'day',
    compare: false
  },
  weekly: {
    reports: [
      { id: 'support', label: 'Support', dataDir: 'pulse' },
      { id: 'qa',      label: 'QA',      dataDir: 'qa' },
      { id: 'dsat',    label: 'DSAT',     dataDir: 'dsat' }
    ],
    periodType: 'week',
    compare: true
  },
  monthly: {
    reports: [
      { id: 'support', label: 'Support', dataDir: 'pulse', aggregate: true },
      { id: 'qa',      label: 'QA',      dataDir: 'qa',    aggregate: true },
      { id: 'voc',     label: 'VOC',     dataDir: null,    placeholder: true }
    ],
    periodType: 'month',
    compare: false
  }
};

// === Content Templates ===
var TEMPLATES = {
  'weekly-support':
    '<div id="alerts" class="section"></div>' +
    '<div class="section"><div class="kpi-grid" id="kpi-cards"></div></div>' +
    '<div class="section"><h2 class="section-title">Daily Trend</h2>' +
      '<div class="chart-container"><canvas id="daily-trend-chart"></canvas></div></div>' +
    '<div class="section"><h2 class="section-title">Product Breakdown</h2>' +
      '<div class="table-wrap" id="product-table"></div></div>' +
    '<div class="section"><h2 class="section-title">Ticket Type Breakdown</h2>' +
      '<div class="table-wrap" id="type-table"></div></div>' +
    '<div class="section"><h2 class="section-title">AI Operations</h2>' +
      '<div class="kpi-grid" id="ai-ops"></div></div>' +
    '<div class="section"><h2 class="section-title">AI Automation Opportunities</h2>' +
      '<div class="table-wrap" id="ai-opportunities"></div></div>' +
    '<div class="section"><h2 class="section-title">Active Known Issues (STFS)</h2>' +
      '<div class="table-wrap" id="stfs-table"></div></div>',

  'weekly-qa':
    '<div class="section" id="bcr-hero"></div>' +
    '<div class="section"><h2 class="section-title">BCR by Product</h2>' +
      '<div class="table-wrap" id="bcr-product-table"></div></div>' +
    '<div class="section"><h2 class="section-title">BCR Weekly Trend</h2>' +
      '<div class="chart-container"><canvas id="bcr-trend-chart"></canvas></div></div>' +
    '<div class="section"><h2 class="section-title">Test Execution Summary</h2>' +
      '<div class="kpi-grid" id="test-exec"></div></div>' +
    '<div class="section"><h2 class="section-title">Regression Pass Rate</h2>' +
      '<div class="table-wrap" id="regression-table"></div></div>' +
    '<div class="section"><h2 class="section-title">Latest Function Test</h2>' +
      '<div id="function-test"></div></div>' +
    '<div class="section"><h2 class="section-title">Recent Bugs</h2>' +
      '<div class="table-wrap" id="recent-bugs"></div></div>',

  'weekly-dsat':
    '<div class="section" id="dsat-hero"></div>' +
    '<div class="section"><h2 class="section-title">AI Negativity Breakdown</h2>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
        '<div class="chart-container" style="height:250px"><canvas id="ai-pie-chart"></canvas></div>' +
        '<div class="kpi-grid" style="grid-template-columns:1fr" id="dsat-kpis"></div>' +
      '</div></div>' +
    '<div class="section"><h2 class="section-title">Top DSAT Reasons</h2>' +
      '<div class="chart-container"><canvas id="reasons-chart"></canvas></div></div>' +
    '<div class="section"><h2 class="section-title">Sample Tickets</h2>' +
      '<div class="table-wrap" id="sample-table"></div></div>',

  'daily-support':
    '<div class="section"><div class="kpi-grid" id="kpi-cards"></div></div>' +
    '<div class="section"><h2 class="section-title">Product Distribution</h2>' +
      '<div class="chart-container" style="height:auto;min-height:200px"><canvas id="product-chart"></canvas></div></div>' +
    '<div class="section"><h2 class="section-title">Ticket Type Distribution</h2>' +
      '<div class="chart-container" style="height:auto;min-height:200px"><canvas id="type-chart"></canvas></div></div>' +
    '<div class="section"><h2 class="section-title">Agent Activity (7 Days)</h2>' +
      '<div class="table-wrap" id="agent-table"></div></div>',

  'monthly-voc':
    '<div class="section placeholder-section">' +
      '<div style="text-align:center;padding:64px 24px;">' +
        '<div style="font-size:48px;margin-bottom:16px;">&#128203;</div>' +
        '<h2 style="margin-bottom:8px;">VOC Report</h2>' +
        '<p style="color:var(--text-secondary)">VOC report is generated manually. ' +
          'This placeholder will be connected when automation is available.</p>' +
      '</div></div>'
};

// Monthly reuses weekly templates
TEMPLATES['monthly-support'] = TEMPLATES['weekly-support'];
TEMPLATES['monthly-qa'] = TEMPLATES['weekly-qa'];

// === SPA State ===
var currentView = 'weekly';
var currentReport = 'support';
var compareMode = false;
var prevWeekData = null;
var _currentReport = null;

// === Data Loading ===
var _indexCache = null;

async function loadIndex() {
  if (_indexCache) return _indexCache;
  var resp = await fetch('data/index.json');
  _indexCache = await resp.json();
  // Derive months from weeks if not present
  if (!_indexCache.months) {
    var monthSet = {};
    _indexCache.weeks.forEach(function(w) {
      var m = isoWeekToMonth(w);
      if (m) monthSet[m] = true;
    });
    _indexCache.months = Object.keys(monthSet).sort().reverse();
    _indexCache.latestMonth = _indexCache.months[0] || null;
  }
  return _indexCache;
}

async function loadWeekData(report, week) {
  var resp = await fetch('data/' + report + '/' + week + '.json');
  if (!resp.ok) return null;
  return resp.json();
}

async function loadReportData(dataDir) {
  var idx = await loadIndex();
  var select = document.getElementById('period-select');
  var week = (select && select.value) ? select.value : idx.latest;
  var resp = await fetch('data/' + dataDir + '/' + week + '.json');
  if (!resp.ok) {
    // Try falling back to the next available week
    var weekIdx = idx.weeks.indexOf(week);
    for (var fi = weekIdx + 1; fi < idx.weeks.length; fi++) {
      var fallbackResp = await fetch('data/' + dataDir + '/' + idx.weeks[fi] + '.json');
      if (fallbackResp.ok) return fallbackResp.json();
    }
    throw new Error('No data for ' + dataDir + '/' + week);
  }
  return resp.json();
}

async function loadMonthlyData(dataDir, idx) {
  var select = document.getElementById('period-select');
  var month = (select && select.value) ? select.value : idx.latestMonth;
  var weeks = idx.weeks.filter(function(w) { return isoWeekToMonth(w) === month; });
  var promises = weeks.map(function(w) { return loadWeekData(dataDir, w); });
  var results = await Promise.all(promises);
  var weeklyData = results.filter(function(d) { return d != null; });
  if (weeklyData.length === 0) throw new Error('No data for month ' + month);
  if (dataDir === 'pulse') return aggregatePulseData(weeklyData, month);
  if (dataDir === 'qa') return aggregateQaData(weeklyData, month);
  return weeklyData[weeklyData.length - 1];
}

// === ISO Week to Month ===
function isoWeekToMonth(weekStr) {
  var parts = weekStr.split('-W');
  if (parts.length !== 2) return null;
  var year = parseInt(parts[0]);
  var week = parseInt(parts[1]);
  // Find Monday of ISO week
  var jan4 = new Date(year, 0, 4);
  var dayOfWeek = jan4.getDay() || 7;
  var mondayW1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  var monday = new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
  var m = monday.getMonth() + 1;
  return year + '-' + (m < 10 ? '0' + m : m);
}

// === ISO Week to Date ===
function isoWeekToDate(weekStr) {
  var parts = weekStr.split('-W');
  if (parts.length !== 2) return null;
  var year = parseInt(parts[0]);
  var week = parseInt(parts[1]);
  var jan4 = new Date(year, 0, 4);
  var dayOfWeek = jan4.getDay() || 7;
  var mondayW1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  return new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
}

function formatDateShort(d) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return months[d.getMonth()] + ' ' + d.getDate() + ' (' + days[d.getDay()] + ')';
}

// === URL Params ===
function getUrlParams() {
  var params = new URLSearchParams(location.search);
  return {
    view: params.get('view') || 'weekly',
    report: params.get('report') || null,
    week: params.get('week') || 'latest',
    month: params.get('month') || 'latest'
  };
}

function setUrlParams(view, report, periodValue) {
  var url = new URL(location.href);
  url.searchParams.set('view', view);
  if (report && VIEWS[view].reports.length > 1) {
    url.searchParams.set('report', report);
  } else {
    url.searchParams.delete('report');
  }
  if (VIEWS[view].periodType === 'month') {
    url.searchParams.set('month', periodValue);
    url.searchParams.delete('week');
  } else {
    // both 'week' and 'day' use week-labeled files
    url.searchParams.set('week', periodValue);
    url.searchParams.delete('month');
  }
  return url.toString();
}

// === Chart.js Defaults ===
function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#8f8f8f';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.04)';
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.font.size = 12;
}

// === Chart Cleanup ===
function destroyCharts() {
  document.querySelectorAll('#content canvas').forEach(function(c) {
    var chart = Chart.getChart(c);
    if (chart) chart.destroy();
  });
}

// === Expandable Rows ===
function initExpandableRows() {
  document.querySelectorAll('.expandable').forEach(function(row) {
    row.addEventListener('click', function() {
      var targetId = row.dataset.detail;
      var panel = document.getElementById(targetId);
      if (!panel) return;
      row.classList.toggle('open');
      panel.classList.toggle('open');
    });
  });
}

// === Formatting Helpers ===
function formatDelta(value) {
  if (value == null || typeof value !== 'number') return '<span class="kpi-delta neutral">-</span>';
  var v = Math.round(value);
  if (v > 0) return '<span class="kpi-delta up">\u2191' + v + '%</span>';
  if (v < 0) return '<span class="kpi-delta down">\u2193' + Math.abs(v) + '%</span>';
  return '<span class="kpi-delta neutral">\u2192 0%</span>';
}

function formatNumber(n) {
  if (n == null || typeof n !== 'number') return '-';
  return n.toLocaleString();
}

function safeFormatNumber(n) {
  if (n == null || typeof n !== 'number') return '-';
  return n.toLocaleString();
}

function safeFixed(n, digits) {
  if (n == null || typeof n !== 'number') return '-';
  return n.toFixed(digits);
}

function zenUrl(ticketId) {
  return 'https://positivegrid.zendesk.com/agent/tickets/' + ticketId;
}

function jiraUrl(key) {
  return 'https://positivegrid.atlassian.net/browse/' + key;
}

function kpiCard(label, value) {
  return '<div class="kpi-card">' +
    '<div class="kpi-value">' + value + '</div>' +
    '<div class="kpi-label">' + label + '</div>' +
    '</div>';
}

// === Shared Renderers ===

function renderAlerts(alerts) {
  var el = document.getElementById('alerts');
  if (!el) return;
  if (!alerts || alerts.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.innerHTML = '<div class="alert-banner">' +
    alerts.map(function(a) {
      var prefix = a.product
        ? '<strong>' + a.product + '</strong>: '
        : (a.severity ? '<strong>[' + a.severity.toUpperCase() + ']</strong> ' : '');
      return '<div class="alert-item">\u26a0\ufe0f ' + prefix + (a.message || '') + '</div>';
    }).join('') +
    '</div>';
}

function renderKpi(kpi) {
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

function renderDailyTrend(trend) {
  var canvas = document.getElementById('daily-trend-chart');
  if (!canvas) return;
  if (!trend || trend.length === 0) {
    canvas.parentElement.innerHTML =
      '<p style="padding:16px;color:var(--text-secondary)">No daily trend data</p>';
    return;
  }
  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(function(d) { return d.day; }),
      datasets: [{
        data: trend.map(function(d) { return d.count; }),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderProductBreakdown(products) {
  var el = document.getElementById('product-table');
  if (!el) return;
  if (!products || products.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No product breakdown data</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Product</th><th>Tickets</th><th>%</th><th>vs Prev</th>' +
    '</tr></thead><tbody>';

  products.forEach(function(p, i) {
    html += '<tr class="expandable" data-detail="product-detail-' + i + '">' +
      '<td>' + p.product + '</td>' +
      '<td>' + formatNumber(p.count) + '</td>' +
      '<td>' + (typeof p.pct === 'number' ? p.pct.toFixed(1) + '%' : '-') + '</td>' +
      '<td>' + formatDelta(p.delta) + '</td>' +
      '</tr>';

    html += '<tr><td colspan="4">' +
      '<div class="detail-panel" id="product-detail-' + i + '">';

    if (p.topIssues && p.topIssues.length > 0) {
      html += '<ul>';
      p.topIssues.forEach(function(issue) {
        var ticketLinks = '';
        if (issue.tickets && issue.tickets.length > 0) {
          ticketLinks = ' — ' + issue.tickets.map(function(t) {
            return '<a class="ticket-link" href="' + zenUrl(t.id) + '" target="_blank">#' + t.id + '</a>';
          }).join(', ');
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
  var el = document.getElementById('stfs-table');
  if (!el) return;
  if (!stfs || stfs.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-secondary)">No active STFS issues</p>';
    return;
  }
  var html = '<table><thead><tr>' +
    '<th>Issue</th><th>Summary</th><th>Tickets</th><th>DSAT</th>' +
    '</tr></thead><tbody>';

  stfs.forEach(function(s) {
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

// === Compare Helpers ===

function addKpiDelta(card, deltaValue) {
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

// === Compare Mode ===

function initCompare(dataDir) {
  _currentReport = dataDir;
  var btn = document.getElementById('compare-btn');
  if (!btn) return;

  btn.onclick = async function() {
    compareMode = !compareMode;
    btn.classList.toggle('active', compareMode);
    btn.innerHTML = compareMode ? '<kbd>C</kbd> Compare \u25C2' : '<kbd>C</kbd> Compare \u25B8';

    if (compareMode && !prevWeekData) {
      var idx = await loadIndex();
      var select = document.getElementById('period-select');
      var currentWeek = (select && select.value) ? select.value : idx.latest;
      var currentIdx = idx.weeks.indexOf(currentWeek);
      if (currentIdx >= 0 && currentIdx < idx.weeks.length - 1) {
        var prevWeek = idx.weeks[currentIdx + 1];
        prevWeekData = await loadWeekData(dataDir, prevWeek);
      }
    }

    document.dispatchEvent(new CustomEvent('compare-toggled', {
      detail: { active: compareMode, prevData: prevWeekData }
    }));
  };
}

// === Nav Setup ===

function initNav() {
  // Period tab clicks
  document.querySelectorAll('#period-tabs a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo(a.dataset.view);
    });
  });

  // Period selector change
  var select = document.getElementById('period-select');
  if (select) {
    select.addEventListener('change', function() {
      navigateTo(currentView, currentReport);
    });
  }
}

function populatePeriodSelect(idx) {
  var select = document.getElementById('period-select');
  var label = document.getElementById('period-label');
  if (!select || !label) return;

  var params = getUrlParams();
  var periodType = VIEWS[currentView].periodType;
  select.innerHTML = '';

  if (periodType === 'month') {
    label.textContent = 'Month:';
    idx.months.forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === idx.latestMonth && params.month === 'latest') opt.selected = true;
      if (m === params.month) opt.selected = true;
      select.appendChild(opt);
    });
  } else if (periodType === 'day') {
    label.textContent = 'Date:';
    idx.weeks.forEach(function(w) {
      var opt = document.createElement('option');
      opt.value = w;
      var d = isoWeekToDate(w);
      opt.textContent = d ? formatDateShort(d) : w;
      if (w === idx.latest && params.week === 'latest') opt.selected = true;
      if (w === params.week) opt.selected = true;
      select.appendChild(opt);
    });
  } else {
    label.textContent = 'Week:';
    idx.weeks.forEach(function(w) {
      var opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      if (w === idx.latest && params.week === 'latest') opt.selected = true;
      if (w === params.week) opt.selected = true;
      select.appendChild(opt);
    });
  }
}

function updateSubNav() {
  var subNav = document.getElementById('sub-nav');
  if (!subNav) return;
  var reports = VIEWS[currentView].reports;

  if (reports.length <= 1) {
    subNav.style.display = 'none';
    return;
  }

  subNav.style.display = '';
  subNav.innerHTML = reports.map(function(r, i) {
    var active = r.id === currentReport ? ' active' : '';
    return '<a data-report="' + r.id + '" class="sub-nav-item' + active + '">' +
      '<kbd>' + (i + 1) + '</kbd> ' + r.label + '</a>';
  }).join('');

  subNav.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo(currentView, a.dataset.report);
    });
  });
}

// === Router ===

var _navigating = false;

async function navigateTo(view, report, skipPush, period) {
  if (_navigating) return;
  _navigating = true;

  try {
    var viewConfig = VIEWS[view];
    if (!viewConfig) { _navigating = false; return; }

    if (!report) report = viewConfig.reports[0].id;

    var reportConfig = viewConfig.reports.find(function(r) { return r.id === report; });
    if (!reportConfig) {
      reportConfig = viewConfig.reports[0];
      report = reportConfig.id;
    }

    // Reset page data to prevent stale compare handlers
    _pulseData = null;
    _qaData = null;
    _dsatData = null;
    _dailyData = null;
    compareMode = false;
    prevWeekData = null;

    // Update state
    currentView = view;
    currentReport = report;

    // Destroy old charts
    destroyCharts();

    // Update period tabs
    document.querySelectorAll('#period-tabs a').forEach(function(a) {
      a.classList.toggle('active', a.dataset.view === view);
    });

    // Update period selector
    var idx = await loadIndex();
    populatePeriodSelect(idx);

    // If a specific period was requested (e.g. from [ ] hotkeys), override selection
    if (period) {
      var select = document.getElementById('period-select');
      if (select) {
        for (var si = 0; si < select.options.length; si++) {
          if (select.options[si].value === period) {
            select.selectedIndex = si;
            break;
          }
        }
      }
    }

    // Update URL
    if (!skipPush) {
      var select = document.getElementById('period-select');
      var periodValue = (select && select.value) ? select.value : 'latest';
      history.pushState(null, '', setUrlParams(view, report, periodValue));
    }

    // Update sub-nav
    updateSubNav();

    // Show/hide compare button
    var compareBtn = document.getElementById('compare-btn');
    if (compareBtn) {
      if (viewConfig.compare) {
        compareBtn.style.display = '';
        compareBtn.classList.remove('active');
        compareBtn.innerHTML = '<kbd>C</kbd> Compare \u25B8';
      } else {
        compareBtn.style.display = 'none';
      }
    }

    // Set content template
    var templateKey = view + '-' + report;
    var content = document.getElementById('content');

    if (reportConfig.placeholder) {
      content.innerHTML = TEMPLATES[templateKey] || '';
      _navigating = false;
      return;
    }

    content.innerHTML = TEMPLATES[templateKey] || '';

    // Load data
    var data;
    if (viewConfig.periodType === 'month' && reportConfig.aggregate) {
      data = await loadMonthlyData(reportConfig.dataDir, idx);
    } else {
      data = await loadReportData(reportConfig.dataDir);
    }

    // Call init function
    var initFn = getInitFunction(view, report);
    if (initFn) initFn(data);

    // Init compare if applicable
    if (viewConfig.compare) {
      initCompare(reportConfig.dataDir);
    }
  } catch (err) {
    var content = document.getElementById('content');
    if (content) {
      var idx = await loadIndex();
      var latestPeriod = (VIEWS[view].periodType === 'month') ? idx.latestMonth : idx.latest;
      content.innerHTML = '<div style="text-align:center;padding:48px 24px;">' +
        '<div style="font-size:48px;margin-bottom:16px;">&#128202;</div>' +
        '<h2 style="margin-bottom:8px;">No data for this period</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:16px;">' + err.message + '</p>' +
        (latestPeriod ? '<a href="#" onclick="navigateTo(\'' + view + '\',\'' + report + '\',false,\'' + latestPeriod + '\');return false;" style="color:var(--accent-light);">Jump to latest available (' + latestPeriod + ')</a>' : '') +
        '</div>';
    }
  }

  _navigating = false;
}

function getInitFunction(view, report) {
  if (report === 'support' && (view === 'weekly' || view === 'monthly')) return initPulsePage;
  if (report === 'support' && view === 'daily') return initDailyPage;
  if (report === 'qa') return initQaPage;
  if (report === 'dsat') return initDsatPage;
  return null;
}

// === Monthly Aggregation ===

function aggregatePulseData(weeklyDataArray, month) {
  var result = {
    period: month + ' (Monthly)',
    kpi: { totalTickets: 0, refunds: 0, topProduct: '-', productCount: 0 },
    dailyTrend: [],
    productBreakdown: [],
    ticketTypes: [],
    aiOps: null,
    aiOpportunities: [],
    stfs: [],
    alerts: []
  };

  var productMap = {};
  var typeMap = {};

  weeklyDataArray.forEach(function(d) {
    if (d.kpi) {
      result.kpi.totalTickets += d.kpi.totalTickets || 0;
      result.kpi.refunds += d.kpi.refunds || 0;
    }
    if (d.dailyTrend) result.dailyTrend = result.dailyTrend.concat(d.dailyTrend);
    if (d.productBreakdown) {
      d.productBreakdown.forEach(function(p) {
        if (!productMap[p.product]) productMap[p.product] = { product: p.product, count: 0 };
        productMap[p.product].count += p.count || 0;
      });
    }
    if (d.ticketTypes) {
      d.ticketTypes.forEach(function(t) {
        if (!typeMap[t.type]) typeMap[t.type] = { type: t.type, count: 0, aiCount: 0 };
        typeMap[t.type].count += t.count || 0;
        if (typeof t.aiCount === 'number') typeMap[t.type].aiCount += t.aiCount;
      });
    }
  });

  // Recalculate product breakdown
  var totalProductCount = 0;
  Object.keys(productMap).forEach(function(k) { totalProductCount += productMap[k].count; });
  result.productBreakdown = Object.keys(productMap).map(function(k) {
    var p = productMap[k];
    p.pct = totalProductCount > 0 ? (p.count / totalProductCount * 100) : 0;
    return p;
  }).sort(function(a, b) { return b.count - a.count; });

  if (result.productBreakdown.length > 0) {
    result.kpi.topProduct = result.productBreakdown[0].product;
  }
  result.kpi.productCount = result.productBreakdown.length;

  // Recalculate ticket types
  var totalTypeCount = 0;
  Object.keys(typeMap).forEach(function(k) { totalTypeCount += typeMap[k].count; });
  result.ticketTypes = Object.keys(typeMap).map(function(k) {
    var t = typeMap[k];
    t.pct = totalTypeCount > 0 ? (t.count / totalTypeCount * 100) : 0;
    t.aiResRate = (t.count > 0 && t.aiCount > 0) ? (t.aiCount / t.count * 100) : null;
    return t;
  }).sort(function(a, b) { return b.count - a.count; });

  // Take latest for non-summable fields
  var latestWeek = weeklyDataArray[weeklyDataArray.length - 1];
  if (latestWeek) {
    result.aiOps = latestWeek.aiOps || null;
    result.aiOpportunities = latestWeek.aiOpportunities || [];
    result.stfs = latestWeek.stfs || [];
  }

  return result;
}

function aggregateQaData(weeklyDataArray, month) {
  var result = {
    period: month + ' (Monthly)',
    bcr: { overall: 0, target: 80, qaCount: 0, customerCount: 0 },
    bcrByProduct: [],
    bcrWeeklyTrend: [],
    testExecution: null,
    regressionTrend: null,
    latestFunctionTest: null,
    recentBugs: { qa: [], customer: [] }
  };

  if (weeklyDataArray.length === 0) return result;

  // BCR is a rolling metric — use the latest week's snapshot as the month's BCR
  var latestWeek = weeklyDataArray[weeklyDataArray.length - 1];
  if (latestWeek && latestWeek.bcr) {
    result.bcr.overall = latestWeek.bcr.overall || 0;
    result.bcr.qaCount = latestWeek.bcr.qaCount || 0;
    result.bcr.customerCount = latestWeek.bcr.customerCount || 0;
  }
  if (latestWeek && latestWeek.bcrByProduct) {
    result.bcrByProduct = latestWeek.bcrByProduct;
  }

  // Collect per-week trend data, deduplicating by week key
  var trendMap = {};
  weeklyDataArray.forEach(function(d) {
    if (d.bcrWeeklyTrend) {
      d.bcrWeeklyTrend.forEach(function(t) {
        trendMap[t.week] = t;
      });
    }
    if (d.recentBugs) {
      if (d.recentBugs.qa) result.recentBugs.qa = result.recentBugs.qa.concat(d.recentBugs.qa);
      if (d.recentBugs.customer) result.recentBugs.customer = result.recentBugs.customer.concat(d.recentBugs.customer);
    }
  });
  result.bcrWeeklyTrend = Object.keys(trendMap).sort().map(function(k) { return trendMap[k]; });

  // Take latest for non-summable fields
  if (latestWeek) {
    result.testExecution = latestWeek.testExecution || null;
    result.regressionTrend = latestWeek.regressionTrend || null;
    result.latestFunctionTest = latestWeek.latestFunctionTest || null;
  }

  // Deduplicate and cap recent bugs by key
  var qaKeys = {};
  result.recentBugs.qa = result.recentBugs.qa.filter(function(b) {
    if (qaKeys[b.key]) return false;
    qaKeys[b.key] = true;
    return true;
  }).slice(0, 20);
  var custKeys = {};
  result.recentBugs.customer = result.recentBugs.customer.filter(function(b) {
    if (custKeys[b.key]) return false;
    custKeys[b.key] = true;
    return true;
  }).slice(0, 20);

  return result;
}

// === Hotkey Handler ===
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  var key = e.key; // preserve case for bracket detection
  var lower = key.toLowerCase();

  if (lower === 'd') navigateTo('daily');
  else if (lower === 'w') navigateTo('weekly');
  else if (lower === 'm') navigateTo('monthly');
  else if (lower >= '1' && lower <= '9') {
    var idx = parseInt(lower) - 1;
    var reports = VIEWS[currentView].reports;
    if (idx < reports.length) navigateTo(currentView, reports[idx].id);
  }
  // [ / ] — cycle through periods (older / newer)
  // { / } (shift+[ / shift+]) — jump to oldest / latest
  else if (key === '[' || key === ']' || key === '{' || key === '}') {
    var select = document.getElementById('period-select');
    if (!select || select.options.length === 0) return;
    var i = select.selectedIndex;
    if (key === '{') i = select.options.length - 1; // oldest
    else if (key === '}') i = 0; // latest
    else if (key === '[') i = Math.min(i + 1, select.options.length - 1); // older
    else i = Math.max(i - 1, 0); // newer
    if (i !== select.selectedIndex) {
      var targetPeriod = select.options[i].value;
      navigateTo(currentView, currentReport, false, targetPeriod);
    }
  }
  // C — toggle compare
  else if (lower === 'c') {
    var btn = document.getElementById('compare-btn');
    if (btn && btn.style.display !== 'none') btn.click();
  }
});

// === Popstate Handler ===
window.addEventListener('popstate', function() {
  var params = getUrlParams();
  navigateTo(params.view, params.report, true);
});

// === Init ===
document.addEventListener('DOMContentLoaded', function() {
  applyChartDefaults();
  initNav();
  // Route from URL params
  var params = getUrlParams();
  navigateTo(params.view, params.report, true);
});
