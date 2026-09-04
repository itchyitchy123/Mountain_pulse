# MountainPulse

[![CI](https://github.com/itchyitchy123/Mountain_pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/itchyitchy123/Mountain_pulse/actions/workflows/ci.yml)

A responsive prototype for real-time ski resort intelligence with a zero-dependency browser client and a Node.js API. The default experience uses clearly labeled simulated data; the repository does not claim that official resort integrations are present.

> [!IMPORTANT]
> MountainPulse is not a source of official closure, patrol, avalanche, or emergency information. Production routing remains disabled until licensed topology and field safety validation are complete.

## Project status

The demo is runnable and the production runtime boundary is implemented: normalized HTTPS ingestion, PostgreSQL/PostGIS persistence, signed anonymous installation credentials, freshness-gated readiness, and fail-closed configuration. Official feeds, licensed topology, operational moderation, and field validation are still launch blockers.

- [Implementation status](PLAN_STATUS.md)
- [Production integration roadmap](PRODUCTION_ROADMAP.md)
- [Operations runbook](docs/OPERATIONS.md)
- [Repository setup checklist](docs/REPOSITORY_SETUP.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Run locally

```bash
npm ci
npm start
```

Then open `http://localhost:4173`.

The supported runtime is Node.js 24 LTS. `GET /healthz` provides a process liveness probe and `GET /readyz` confirms that the initial scenario snapshot was ingested. Set `HOST=0.0.0.0` when running behind a container or reverse proxy; the local default remains `127.0.0.1`.

For a locked-down container deployment:

```bash
docker build -t mountainpulse .
docker run --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  -p 4173:4173 mountainpulse
```

## Production runtime

Production mode fails closed: it requires PostgreSQL, an HTTPS normalized observation feed, an explicit CORS origin, and separate installation-signing and identity-hashing secrets. Copy `.env.example` into your secret/configuration system, apply the schema with `npm run migrate`, and start with `APP_MODE=production`. Limit the initial rollout with `RESORT_IDS=copper`; readiness remains unavailable until every required snapshot for each enabled resort is fresh.

The normalized feed must return `application/json` containing either an observation array or `{ "observations": [...] }`. Each observation uses the adapter contract in [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md). Production writes are persisted to PostgreSQL and require an anonymous signed installation credential issued by `POST /api/v1/installations`.

The prototype includes resort switching, explained pulse scores, a mountain heat map, lift and run status, powder probability, parking estimates, personalized route recommendations, an I-70 trip outlook, and one-tap Stoke / Don't Bother reporting with all eight condition categories from the product plan. Parking reports now feed a time-decayed estimate and increase its displayed evidence confidence instead of acting as a disconnected label.

The UI now distinguishes every modeled value from a real feed. Recommendations adapt to ability, skis versus snowboard, and the skier's priority; unavailable routes are excluded, serious terrain carries warnings, and “Start lap” highlights a destination and begins a local feedback session. Reports expire after two hours and remain available in the current browser for offline use. When connected, reports and outcomes are also sent to the in-memory prototype aggregation API; public aggregates require independent reporters. Failed/offline submissions enter a bounded device-local outbox and retry when connectivity returns. Recent local reports apply a time-decayed personal overlay capped at ±8 points to Powder Probability, heat zones, and snow-priority route ordering.

Recommendations now pass through a fail-closed, constraint-aware route engine. A route is withheld when a required lift is closed, held, or absent from the available operations snapshot, or when it exceeds the selected ability. Confidence is driven by explicit source metadata and is labeled as scenario confidence while production sources are absent. Starting a route creates a local session, and Nailed/Fine/Missed feedback is retained as a device-local calibration and ranking signal.

The browser and API consume the same normalized lift/run contract in `mountain-data.js`. A separate safety engine keeps hazards out of ordinary preference scoring: verified or independently corroborated hazards block a route, while a lone device-local hazard produces a warning. Reports are deduplicated by device before aggregation, and context-matched route outcomes now adjust future local rankings. Lift Mode provides a high-contrast, reduced on-mountain view with larger controls.

The app is installable and caches the demonstration interface for offline use. Production navigation still requires licensed trail geometry, official operations/parking feeds, a calibrated movement pipeline, moderation, and field validation.

See [PLAN_STATUS.md](PLAN_STATUS.md) for the plan-by-plan implementation boundary.

## Open API prototype

The local server exposes JSON data and validated prototype ingestion routes with CORS enabled:

```text
GET /api/v1/resorts
GET /api/v1/resorts/abasin
GET /api/v1/resorts/abasin/lifts
GET /api/v1/resorts/abasin/runs
GET /api/v1/resorts/abasin/conditions
GET /api/v1/resorts/abasin/crowds
GET /api/v1/resorts/abasin/pulse
GET /api/v1/openapi.json
GET /api/v1/sources
GET /api/v1/resorts/abasin/reports
GET /healthz
GET /readyz
POST /api/v1/reports
POST /api/v1/route-outcomes
POST /api/v1/movement-batches
```

Available resort IDs are `abasin`, `loveland`, `copper`, `winter`, and `eldora`.
The unversioned plan routes (for example `/resorts/abasin/pulse`) are also available as aliases.
Every response includes `simulation: true` and separates the scenario's `observed_at` time from the HTTP `served_at` time. Set `CORS_ORIGIN` to restrict API access outside local development.

Write routes use bounded JSON bodies, strict enums, per-reporter cooldowns, independent-reporter publication thresholds, and a no-raw-coordinate movement contract. Demo storage is process-local; production mode persists reports, route outcomes, and movement samples in PostgreSQL/PostGIS.
Clients must send write requests with `Content-Type: application/json`; reports with timestamps outside the two-hour freshness window or more than five minutes in the future are rejected.

## Development

Run the same checks used by CI before opening a pull request:

```bash
npm run ci
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [docs/OPERATIONS.md](docs/OPERATIONS.md) for production configuration, migrations, rollout, and incident procedures.
