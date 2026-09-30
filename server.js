const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Env vars this app looks for and displays. Set any/all of these when
// deploying to exercise your PaaS's environment variable handling.
const ENV_VARS = [
  'APP_NAME',
  'APP_MESSAGE',
  'APP_COLOR',
  'APP_ENVIRONMENT',
  'APP_VERSION',
  'BUILD_ID',
  'RELEASE_ID',
  'REGION',
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Deterministic "demo data" generator -----------------------------------
// The numbers below are not real metrics — there's nothing to measure in a
// PaaS smoke-test app. They're seeded from the hostname + today's date so the
// dashboard looks like a live product (stable within a day, different across
// instances/days) instead of a raw env-var dump.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomWalk(rng, points, start, min, max, step) {
  const values = [start];
  for (let i = 1; i < points; i++) {
    const next = values[i - 1] + (rng() - 0.45) * step;
    values.push(Math.max(min, Math.min(max, next)));
  }
  return values.map((v) => Math.round(v));
}

function buildDemoData() {
  const seed = hashString(os.hostname() + new Date().toISOString().slice(0, 10));
  const rng = mulberry32(seed);

  const weeklyActiveUsers = randomWalk(rng, 12, 1200, 400, 3200, 260);
  const requestsSpark = randomWalk(rng, 12, 800, 200, 2600, 220);

  const regions = ['US-East', 'US-West', 'EU-West', 'EU-Central', 'APAC'].map((name) => ({
    name,
    value: Math.round(500 + rng() * 3500),
  }));

  const activeUsers = weeklyActiveUsers[weeklyActiveUsers.length - 1];
  const activeUsersPrev = weeklyActiveUsers[weeklyActiveUsers.length - 2];
  const activeUsersDelta = activeUsersPrev ? ((activeUsers - activeUsersPrev) / activeUsersPrev) * 100 : 0;

  const requestsToday = Math.round(18000 + rng() * 24000);
  const requestsDelta = (rng() - 0.35) * 18;

  return { weeklyActiveUsers, requestsSpark, regions, activeUsers, activeUsersDelta, requestsToday, requestsDelta };
}

function formatCompact(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatDelta(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// --- Chart building blocks (inline SVG, no chart library / dependency) -----

function sparkline(values, id) {
  const w = 96;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });
  const toPath = (pts) => pts.map((p) => p.join(',')).join(' ');
  const lead = points.slice(0, -1);
  const tail = points.slice(-2);
  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" id="${id}">
      <polyline points="${toPath(lead)}" class="spark-muted" />
      <polyline points="${toPath(tail)}" class="spark-accent" />
    </svg>`;
}

function trendChart(values, labels) {
  const w = 640;
  const h = 220;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const min = 0;
  const max = Math.max(...values) * 1.15;
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padL + (i / (values.length - 1)) * innerW;
    const y = padT + innerH - ((v - min) / range) * innerH;
    return { x, y, v, label: labels[i] };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padT + innerH} L ${points[0].x.toFixed(1)} ${padT + innerH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padT + innerH * f;
      const val = Math.round(max * (1 - f));
      return `
        <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" class="grid-line" />
        <text x="${padL - 8}" y="${y.toFixed(1)}" class="axis-label" text-anchor="end" dominant-baseline="middle">${formatCompact(val)}</text>`;
    })
    .join('');

  const hitTargets = points
    .map(
      (p) => `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" class="hit-target"
        data-label="${escapeHtml(p.label)}" data-value="${p.v}" />
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" class="marker-dot" />`
    )
    .join('');

  const last = points[points.length - 1];

  return `
    <svg class="trend-chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Weekly active users trend">
      ${gridLines}
      <path d="${areaPath}" class="area-fill" />
      <path d="${linePath}" class="line-stroke" />
      ${hitTargets}
      <text x="${last.x.toFixed(1)}" y="${(last.y - 10).toFixed(1)}" class="end-label" text-anchor="end">${formatCompact(last.v)}</text>
    </svg>`;
}

function barChart(categories) {
  const w = 640;
  const h = 220;
  const padL = 16;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...categories.map((c) => c.value)) * 1.15;
  const slot = innerW / categories.length;
  const barWidth = Math.min(24, slot * 0.5);

  const bars = categories
    .map((c, i) => {
      const barH = (c.value / max) * innerH;
      const x = padL + slot * i + (slot - barWidth) / 2;
      const y = padT + innerH - barH;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(barH, 1).toFixed(1)}"
          rx="4" class="bar-mark hit-target" data-label="${escapeHtml(c.name)}" data-value="${c.value}" />
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="bar-value" text-anchor="middle">${formatCompact(c.value)}</text>
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${h - padB + 18}" class="axis-label" text-anchor="middle">${escapeHtml(c.name)}</text>`;
    })
    .join('');

  return `
    <svg class="bar-chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Requests by region">
      <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" class="baseline" />
      ${bars}
    </svg>`;
}

function statTile({ label, value, delta, deltaGood, sparklineSvg, statusDot, statusLabel }) {
  const deltaHtml =
    delta !== undefined
      ? `<div class="stat-delta ${deltaGood ? 'good' : 'bad'}">${escapeHtml(delta)}</div>`
      : statusLabel
      ? `<div class="stat-status"><span class="status-dot ${statusDot}"></span>${escapeHtml(statusLabel)}</div>`
      : '';
  return `
    <div class="stat-tile">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-row">
        <div class="stat-value">${escapeHtml(value)}</div>
        ${sparklineSvg || ''}
      </div>
      ${deltaHtml}
    </div>`;
}

function renderPage() {
  const accent = process.env.APP_COLOR || '#2a78d6';
  const productName = process.env.APP_NAME || 'Pulse Analytics';
  const tagline = process.env.APP_MESSAGE || 'No APP_MESSAGE set — showing default tagline.';
  const environment = process.env.APP_ENVIRONMENT;
  const region = process.env.REGION;

  const demo = buildDemoData();
  const weekLabels = demo.weeklyActiveUsers.map((_, i) => `Week ${i + 1}`);

  const envRows = ENV_VARS.map((key) => {
    const value = process.env[key];
    const isSet = value !== undefined && value !== '';
    return `
      <tr>
        <td class="key">${escapeHtml(key)}</td>
        <td class="value ${isSet ? 'set' : 'unset'}">${isSet ? escapeHtml(value) : '(not set)'}</td>
      </tr>`;
  }).join('');

  const statTiles = [
    statTile({
      label: 'Active users',
      value: formatCompact(demo.activeUsers),
      delta: formatDelta(demo.activeUsersDelta),
      deltaGood: demo.activeUsersDelta >= 0,
      sparklineSvg: sparkline(demo.weeklyActiveUsers, 'spark-users'),
    }),
    statTile({
      label: 'Requests today',
      value: formatCompact(demo.requestsToday),
      delta: formatDelta(demo.requestsDelta),
      deltaGood: demo.requestsDelta >= 0,
      sparklineSvg: sparkline(demo.requestsSpark, 'spark-requests'),
    }),
    statTile({
      label: 'Uptime',
      value: formatUptime(process.uptime()),
    }),
    statTile({
      label: 'Environment',
      value: environment || region || 'default',
      statusDot: environment ? 'good' : 'muted',
      statusLabel: environment ? 'Configured' : 'Not set',
    }),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(productName)}</title>
  <style>
    :root {
      --surface-1: #fcfcfb;
      --page-plane: #f9f9f7;
      --text-primary: #0b0b0b;
      --text-secondary: #52514e;
      --text-muted: #898781;
      --grid-line: #e1e0d9;
      --baseline: #c3c2b7;
      --border: rgba(11,11,11,0.10);
      --series-1: ${escapeHtml(accent)};
      --series-1-wash: color-mix(in srgb, ${escapeHtml(accent)} 10%, transparent);
      --status-good: #0ca30c;
      --status-muted: #898781;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --surface-1: #1a1a19;
        --page-plane: #0d0d0d;
        --text-primary: #ffffff;
        --text-secondary: #c3c2b7;
        --text-muted: #898781;
        --grid-line: #2c2c2a;
        --baseline: #383835;
        --border: rgba(255,255,255,0.10);
        --status-good: #0ca30c;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: var(--page-plane);
      color: var(--text-primary);
      margin: 0;
      padding: 2rem 1.5rem;
    }
    .wrap { max-width: 980px; margin: 0 auto; }
    header.app-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    header.app-header h1 {
      margin: 0;
      font-size: 1.6rem;
    }
    header.app-header p {
      margin: 0.15rem 0 0;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .status-dot.good { background: var(--status-good); }
    .status-dot.muted { background: var(--status-muted); }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-tile {
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
    }
    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 600;
    }
    .stat-delta {
      font-size: 0.8rem;
      font-weight: 600;
      margin-top: 0.4rem;
    }
    .stat-delta.good { color: var(--status-good); }
    .stat-delta.bad { color: #d03b3b; }
    .stat-status {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-top: 0.4rem;
    }
    .sparkline { flex-shrink: 0; }
    .spark-muted { fill: none; stroke: var(--baseline); stroke-width: 1.5; }
    .spark-accent { fill: none; stroke: var(--series-1); stroke-width: 1.5; }

    .chart-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .chart-card {
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.2rem 0.5rem;
      position: relative;
    }
    .chart-card h2 {
      font-size: 0.95rem;
      margin: 0 0 0.75rem;
    }
    .trend-chart, .bar-chart { width: 100%; height: auto; overflow: visible; }
    .grid-line { stroke: var(--grid-line); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis-label { font-size: 10px; fill: var(--text-muted); }
    .area-fill { fill: var(--series-1-wash); }
    .line-stroke { fill: none; stroke: var(--series-1); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .marker-dot { fill: var(--series-1); stroke: var(--surface-1); stroke-width: 2; }
    .hit-target { fill: transparent; cursor: pointer; }
    .bar-mark { fill: var(--series-1); }
    .bar-value { font-size: 10px; fill: var(--text-secondary); }
    .end-label { font-size: 12px; font-weight: 600; fill: var(--text-primary); }

    #chart-tooltip {
      position: fixed;
      pointer-events: none;
      background: var(--text-primary);
      color: var(--surface-1);
      font-size: 0.75rem;
      padding: 0.3rem 0.55rem;
      border-radius: 6px;
      opacity: 0;
      transform: translate(-50%, -100%);
      transition: opacity 0.1s;
      z-index: 10;
      white-space: nowrap;
    }
    #chart-tooltip.visible { opacity: 1; }

    details.deployment {
      background: var(--surface-1);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.2rem;
    }
    details.deployment summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td {
      text-align: left;
      padding: 0.45rem 0.6rem;
      border-bottom: 1px solid var(--grid-line);
      font-size: 0.85rem;
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }
    .key { font-family: "SF Mono", Consolas, monospace; color: var(--text-secondary); }
    .value.set { color: var(--status-good); font-weight: 600; }
    .value.unset { color: var(--text-muted); font-style: italic; }
    .deploy-meta { margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary); }
    .deploy-meta div { margin-bottom: 0.25rem; }

    footer.note {
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }

    @media (max-width: 720px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
      .chart-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="app-header">
      <div>
        <h1>${escapeHtml(productName)}</h1>
        <p>${escapeHtml(tagline)}</p>
      </div>
      <span class="status-pill"><span class="status-dot good"></span>All systems operational</span>
    </header>

    <div class="stat-grid">
      ${statTiles}
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <h2>Weekly active users</h2>
        ${trendChart(demo.weeklyActiveUsers, weekLabels)}
      </div>
      <div class="chart-card">
        <h2>Requests by region</h2>
        ${barChart(demo.regions)}
      </div>
    </div>

    <details class="deployment">
      <summary>Deployment details</summary>
      <div class="deploy-meta">
        <div><strong>Hostname:</strong> ${escapeHtml(os.hostname())}</div>
        <div><strong>Platform:</strong> ${escapeHtml(process.platform)} / node ${escapeHtml(process.version)}</div>
        <div><strong>Listening on port:</strong> ${escapeHtml(PORT)}</div>
        <div><strong>Server time:</strong> ${escapeHtml(new Date().toISOString())}</div>
        <div><strong>Health check:</strong> <code>/health</code></div>
      </div>
      <table>
        <thead><tr><th>Variable</th><th>Value</th></tr></thead>
        <tbody>${envRows}</tbody>
      </table>
    </details>

    <footer class="note">Traffic charts above are sample data for demo purposes. Deployment details reflect the live environment.</footer>
  </div>

  <div id="chart-tooltip"></div>
  <script>
    (function () {
      var tooltip = document.getElementById('chart-tooltip');
      function showTooltip(el, evt) {
        var label = el.getAttribute('data-label');
        var value = el.getAttribute('data-value');
        tooltip.textContent = label + ': ' + Number(value).toLocaleString();
        tooltip.style.left = evt.clientX + 'px';
        tooltip.style.top = (evt.clientY - 10) + 'px';
        tooltip.classList.add('visible');
      }
      function hideTooltip() {
        tooltip.classList.remove('visible');
      }
      document.querySelectorAll('.hit-target').forEach(function (el) {
        el.addEventListener('mousemove', function (evt) { showTooltip(el, evt); });
        el.addEventListener('mouseleave', hideTooltip);
      });
    })();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderPage());
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});
