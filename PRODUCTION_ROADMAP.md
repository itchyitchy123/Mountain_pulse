# MountainPulse production integration guide

The repository runs without external services, but now uses the same boundaries intended for production: adapters produce normalized observations, the data platform tracks source health and expiry, and consumers never need provider-specific payloads.

## Runtime progression

1. Keep `ScenarioAdapter` enabled for development and tests.
2. Provision PostgreSQL with PostGIS and apply `db/migrations/001_core.sql`.
3. Replace the in-memory `DataPlatform` collections with repositories implementing the same methods.
4. Add one adapter per official source. Store raw payloads in immutable object storage before normalization.
5. Run adapters as independent workers with idempotent source event IDs, retry backoff, and source-health alerts.
6. Build API snapshots only from non-expired observations. A stale or missing operations observation must withhold affected routes.

## Adapter acceptance contract

Every adapter must provide a stable source ID, mode, observed time, TTL, quality prior, resort ID, resource name, and normalized data. Validation failure must not overwrite the last good observation. Record attempt and success times separately.

Suggested first integrations are official resort lift/run status, NWS grid/station weather, and CDOT real-time travel information. Credentials and provider terms remain deployment configuration, never source code.

## Community trust and privacy

- Hash and rotate installation identifiers at the service boundary.
- Verify that condition reports are plausibly near the named topology edge without retaining precise public coordinates.
- Publish aggregates only after the configured independent-reporter threshold.
- Give official closures precedence over community reports.
- Keep hazards separate from preference scoring and require corroboration or official verification for a hard block.
- Accept only edge/time/duration movement samples. Do not accept complete GPS tracks through the movement endpoint.
- Apply short retention to pending device sets and publish only aggregate counts and duration percentiles.

## Field rollout gates

Start with one licensed resort graph. Before public routing, measure source freshness, topology coverage, wait-time error, recommendation acceptance, outcome calibration, route regret, battery use, and every instance where a known closure or hazard was not withheld. New ranking models should run in shadow mode behind the deterministic safety engine.
