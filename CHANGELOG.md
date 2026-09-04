# Changelog

All notable changes to MountainPulse are documented here. The project follows [Semantic Versioning](https://semver.org/) and the structure recommended by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository contribution, security, and operations documentation.
- Repository metadata and a checklist for branch protection, security features, and releases.
- Structured GitHub issue and pull request templates.
- Weekly npm dependency updates through Dependabot.

## [1.0.0] - 2026-09-03

### Added

- Responsive installable ski-resort intelligence demo for five Colorado resorts.
- Explainable pulse scoring, powder estimates, parking estimates, route ranking, safety constraints, and route-outcome feedback.
- Normalized observation platform with explicit source provenance, quality, expiry, and health.
- Production HTTPS feed adapter with response size, timeout, content type, and schema validation.
- PostgreSQL/PostGIS schema and migration runner for observations, topology, community reports, movement aggregates, and route outcomes.
- Durable production repositories, cross-instance report cooldowns, and privacy-thresholded publication.
- Signed anonymous installation credentials and stable keyed identity hashing.
- Production configuration validation, CORS restrictions, security headers, request limits, liveness, readiness, and graceful shutdown.
- Non-root production container and GitHub Actions checks.

### Security

- Production mode fails closed when its database, feed, CORS origin, or cryptographic secrets are missing.
- Raw coordinates are rejected by the movement API, and device identifiers are hashed before persistence.

### Known limitations

- Official resort and transportation feeds are not included.
- Production routing is disabled pending licensed topology and field validation.
- Human moderation, distributed abuse prevention, and production observability remain deployment work.
