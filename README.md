# PaaS Test App (Node.js)

A minimal Node.js web app with no external dependencies. It renders as a
polished "product analytics" demo dashboard — stat tiles, a trend chart, and a
bar chart — so it reads as a real app to non-technical viewers during demos,
while still reporting live deployment info (hostname, port, node version, env
vars) for verifying that a PaaS deployment is working correctly.

The traffic numbers and charts are sample data, deterministically generated
from the hostname and date (so they look stable within a day, and differ
across instances/days) — there's nothing to measure in a smoke-test app. The
"Deployment details" section at the bottom is real and reflects the live
environment.

## Running locally

```bash
npm start
# or
node server.js
```

By default it listens on port `3000` (or `$PORT` if set) at `http://localhost:3000`.

There's also a `/health` endpoint that returns `{"status":"ok"}` for platform health checks.

## Environment variables

Set any of these when deploying to see them reflected on the dashboard and in
the "Deployment details" table. None are required — if unset, the app falls
back to defaults and shows "(not set)" in the table.

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | Port the server listens on | `8080` |
| `APP_NAME` | Product name shown in the header | `Acme Cloud` |
| `APP_MESSAGE` | Tagline shown under the product name | `Production deploy — us-central1` |
| `APP_COLOR` | Accent color used for the header, charts, and trend line | `#e0562f` |
| `APP_ENVIRONMENT` | Shown in the "Environment" stat tile | `staging` |
| `APP_VERSION` | Version string, shown in Deployment details | `1.4.2` |
| `BUILD_ID` | CI/CD build identifier, shown in Deployment details | `run-4521` |
| `RELEASE_ID` | Release/deployment identifier, shown in Deployment details | `rel-20260925-01` |
| `REGION` | Region/datacenter identifier | `us-east-1` |

Example:

```bash
APP_NAME="Acme Cloud" \
APP_MESSAGE="Production deploy — us-central1" \
APP_COLOR="#a020f0" \
APP_ENVIRONMENT="production" \
APP_VERSION="2.0.0" \
BUILD_ID="ci-9981" \
RELEASE_ID="rel-2026-09-25" \
REGION="us-central1" \
PORT=8080 \
node server.js
```

Set variables show their value in green in the "Deployment details" table;
unset ones show "(not set)" in gray — a quick visual check that your PaaS is
passing environment variables through correctly, without the raw debug table
being the first thing a non-technical viewer sees.
