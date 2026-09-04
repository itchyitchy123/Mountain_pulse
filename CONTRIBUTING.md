# Contributing to MountainPulse

Thanks for helping improve MountainPulse. Changes should preserve the product's central safety rule: uncertain or stale data must never be presented as verified live guidance.

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- npm 11
- PostgreSQL 15 with PostGIS for production persistence work

## Local workflow

1. Create a focused branch from the latest `main`.
2. Install exactly what is recorded in the lockfile with `npm ci`.
3. Run the demo with `npm start` and open `http://127.0.0.1:4173`.
4. Add or update tests for every behavior change.
5. Run `npm run ci` before submitting the change.

For database changes, use a new numbered migration. Never modify a migration that may already have been applied. Test both a clean migration and an upgrade from the previous release.

## Pull requests

- Keep each pull request scoped to one outcome.
- Explain user-visible behavior, safety implications, data provenance, and rollback steps.
- Include screenshots for interface changes and sample requests/responses for API changes.
- Update `CHANGELOG.md` under `Unreleased` for notable changes.
- Do not commit credentials, provider payloads, precise user locations, production exports, or licensed trail data.
- Use imperative commit subjects, such as `Add stale-source alerting`.

## Data and safety changes

New data adapters must emit the normalized observation contract documented in `PRODUCTION_ROADMAP.md`. They must include a stable source ID, observation time, TTL, quality prior, resort ID, and provenance. Invalid input must not replace the last known-good observation.

Changes affecting closures, hazards, ability constraints, or route eligibility require tests for stale, missing, contradictory, and malformed inputs. Preference scoring must not override a safety block.

## Reporting security issues

Do not disclose vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
