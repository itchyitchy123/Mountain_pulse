# Security policy

## Supported versions

MountainPulse is pre-production. Security fixes are applied to the latest commit on `main`; older commits and local forks are not supported.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Please do not open a public issue for suspected vulnerabilities or include live credentials, precise user locations, provider secrets, or production data in a report.

Include, when possible:

- The affected endpoint, component, and commit
- Reproduction steps or a minimal proof of concept
- Expected and actual behavior
- Potential impact and suggested mitigations

You should receive an acknowledgement within three business days. We will validate the report, coordinate remediation and disclosure, and credit reporters who want attribution.

## Security boundaries

The default runtime is a simulation and is not an official safety source. Production operators are responsible for TLS termination, secrets management, database isolation, backups, monitoring, provider access controls, moderation, and abuse prevention. Never use MountainPulse as a substitute for resort patrol, posted closures, avalanche forecasts, or emergency services.
