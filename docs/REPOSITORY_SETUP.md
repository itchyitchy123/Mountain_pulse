# Repository setup checklist

These settings live on GitHub and cannot be guaranteed by files in the repository. A maintainer should verify them before treating `main` as a protected release branch.

## Repository metadata

- Set a concise description and relevant topics such as `skiing`, `postgis`, `pwa`, and `geospatial`.
- Link the deployed demo only if it is maintained and clearly labeled as simulated.
- Select a license before accepting outside contributions. No license is currently declared, so default copyright restrictions apply.

## Branch protection

Protect `main` with:

- Pull requests required before merging
- At least one approving review
- The CI workflow required to pass
- Conversation resolution required
- Force pushes and branch deletion disabled
- Administrator bypass limited and audited

Use short-lived branches and merge only commits that have passed checks. Tag releases from protected `main` rather than from local or unreviewed commits.

## Security settings

- Enable private vulnerability reporting so the link in `SECURITY.md` works.
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection where the repository plan supports them.
- Restrict Actions to trusted publishers and pin actions to immutable commit SHAs.
- Store deployment credentials in protected environments, not repository-level plaintext variables.

## Releases

For each release:

1. Move entries from `Unreleased` into a dated semantic version in `CHANGELOG.md`.
2. Run the full CI suite and production integration tests against the release commit.
3. Review schema migrations and backup/rollback procedures.
4. Create an annotated Git tag and GitHub release.
5. Publish an immutable container image identified by version and commit SHA.
6. Attach provenance or an SBOM when image publishing is automated.
7. Record the deployment, monitoring window, and rollback decision.

## Issue management

Create the `bug` and `enhancement` labels referenced by the issue forms. Add ownership labels for ingestion, API, database, safety, and client work as the team grows. Security reports and incidents must remain outside public issue templates until disclosure is coordinated.
