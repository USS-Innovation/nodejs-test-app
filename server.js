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

function renderPage() {
  const color = process.env.APP_COLOR || '#2d6cdf';
  const name = process.env.APP_NAME || 'PaaS Test App';
  const message = process.env.APP_MESSAGE || 'No APP_MESSAGE set — this is the default message.';

  const rows = ENV_VARS.map((key) => {
    const value = process.env[key];
    const isSet = value !== undefined && value !== '';
    return `
      <tr>
        <td class="key">${escapeHtml(key)}</td>
        <td class="value ${isSet ? 'set' : 'unset'}">${isSet ? escapeHtml(value) : '(not set)'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f5f7;
      color: #1a1a1a;
      margin: 0;
      padding: 2rem;
    }
    .card {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .banner {
      background: ${escapeHtml(color)};
      color: #fff;
      padding: 1.5rem 2rem;
    }
    .banner h1 {
      margin: 0 0 0.25rem 0;
      font-size: 1.5rem;
    }
    .banner p {
      margin: 0;
      opacity: 0.9;
    }
    .content {
      padding: 1.5rem 2rem 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    th, td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #eee;
      font-size: 0.9rem;
    }
    th {
      color: #666;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    .key {
      font-family: "SF Mono", Consolas, monospace;
      color: #444;
    }
    .value.set {
      color: #1a7d3a;
      font-weight: 600;
    }
    .value.unset {
      color: #999;
      font-style: italic;
    }
    .meta {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #777;
    }
    .meta div {
      margin-bottom: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      <h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
    <div class="content">
      <h2>Environment Variables</h2>
      <table>
        <thead>
          <tr><th>Variable</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="meta">
        <div><strong>Hostname:</strong> ${escapeHtml(os.hostname())}</div>
        <div><strong>Platform:</strong> ${escapeHtml(process.platform)} / node ${escapeHtml(process.version)}</div>
        <div><strong>Listening on port:</strong> ${escapeHtml(PORT)}</div>
        <div><strong>Server time:</strong> ${escapeHtml(new Date().toISOString())}</div>
      </div>
    </div>
  </div>
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
