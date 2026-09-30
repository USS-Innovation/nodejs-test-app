# PaaS Test App (Node.js)

A minimal Node.js web app with no external dependencies. It serves a single
HTML page showing basic server info and the value of any configured
environment variables — useful for verifying that a PaaS deployment is
correctly injecting env vars, exposing a port, etc.

## Running locally

```bash
npm start
# or
node server.js
```

By default it listens on port `3000` (or `$PORT` if set) at `http://localhost:3000`.

There's also a `/health` endpoint that returns `{"status":"ok"}` for platform health checks.

## Environment variables

Set any of these when deploying to see them reflected on the page. None are
required — if unset, the app falls back to defaults and shows "(not set)" in
the table.

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | Port the server listens on | `8080` |
| `APP_NAME` | Title/heading shown on the page | `My Test Deploy` |
| `APP_MESSAGE` | Subtitle message shown under the title | `Deployed via GitOps pipeline` |
| `APP_COLOR` | Hex color for the banner background | `#e0562f` |
| `APP_ENVIRONMENT` | Label for which environment this is | `staging` |
| `APP_VERSION` | Version string to display | `1.4.2` |
| `BUILD_ID` | CI/CD build identifier | `run-4521` |
| `RELEASE_ID` | Release/deployment identifier | `rel-20260925-01` |
| `REGION` | Region/datacenter identifier | `us-east-1` |

Example:

```bash
APP_NAME="Prod Canary" \
APP_MESSAGE="Testing canary rollout" \
APP_COLOR="#a020f0" \
APP_ENVIRONMENT="production" \
APP_VERSION="2.0.0" \
BUILD_ID="ci-9981" \
RELEASE_ID="rel-2026-09-25" \
REGION="us-central1" \
PORT=8080 \
node server.js
```

Visit the page and each set variable will show its value in green; unset
ones will show "(not set)" in gray — a quick visual check that your PaaS
is passing environment variables through correctly.
