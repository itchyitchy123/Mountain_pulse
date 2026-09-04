# Operations runbook

This runbook covers the production-shaped runtime currently implemented in the repository. It does not remove the launch gates in `PLAN_STATUS.md`.

## Runtime dependencies

- Node.js 24 LTS
- PostgreSQL 15 or newer with PostGIS 3.5
- An HTTPS normalized observation feed
- TLS termination in front of the Node.js process
- A secrets manager for database, feed, signing, and hashing credentials

PostGIS raster support is optional for the current schema. It is required only when raster-backed terrain, elevation, imagery, or hazard layers are introduced.

## Required configuration

Start from `.env.example`, but inject real values through the deployment platform rather than copying secrets into the image. Production startup validates `APP_MODE`, `DATABASE_URL`, `NORMALIZED_FEED_URL`, `CORS_ORIGIN`, `INSTALLATION_TOKEN_SECRET`, and `IDENTITY_HASH_SECRET`.

The installation-token and identity-hashing secrets must be different random values of at least 32 bytes. Plan rotations before launch; rotating the installation secret invalidates existing installation credentials.

## Database setup

Run migrations as a dedicated deployment identity with schema-management privileges:

```bash
DATABASE_URL=postgres://... npm run migrate
```

Run the application with a separate least-privilege identity. Back up the database before migrations and verify point-in-time recovery regularly. The migration runner uses a PostgreSQL advisory lock to prevent concurrent migration runs.

## Deployment checklist

1. Confirm `npm run ci` and the container build passed for the exact commit.
2. Review `CHANGELOG.md`, migration files, and rollback notes.
3. Back up the database and apply migrations once.
4. Deploy one instance with routing and unvalidated community influence disabled.
5. Confirm `/healthz` returns 200.
6. Confirm `/readyz` returns 200 only after every enabled resort has a fresh complete snapshot.
7. Inspect `/api/v1/sources` and structured logs for feed failures.
8. Increase traffic gradually while watching latency, errors, database saturation, and source age.

Do not route public traffic when readiness is failing. Liveness alone does not mean the data is usable.

## Monitoring and alerts

At minimum, alert on:

- Readiness failures and stale required resources
- Feed refresh failures and rising consecutive-failure counts
- HTTP 5xx rate, latency, and rejected ingestion volume
- PostgreSQL connection exhaustion, disk growth, replication lag, and backup failure
- Moderation backlog and unexpected report-publication spikes
- Process restarts and graceful-shutdown timeouts

Logs are JSON and include request IDs. Preserve request IDs through the reverse proxy, but do not add authorization headers, tokens, or request bodies to logs.

## Incident response

For stale or incorrect source data, remove the affected resort from `RESORT_IDS` or withdraw traffic until a verified snapshot is available. For suspected credential compromise, revoke the provider/database credential, rotate it in the secret manager, and redeploy. Rotate installation-signing keys only with an explicit client re-enrollment plan.

For a safety-related data incident, disable affected recommendations, preserve relevant source and audit records, notify the data provider, and complete a written review before re-enabling the feature.

## Rollback

Application rollbacks must use a previously verified immutable image. Database migrations are forward-only by default: deploy a corrective migration rather than manually reversing a schema in place. Restore from backup only under the database recovery procedure and validate PostGIS extension availability before reopening traffic.
