# Security Policy

## Supported versions

Singularity is an early local-first project. Security fixes are applied to the latest release line and `main`; older pre-release snapshots are not supported.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/pranavdhawann/singularity/security/advisories/new). Do not open a public issue for suspected secret exposure, prompt leakage, authorization bypass, unsafe file handling, dependency compromise, or external-call approval bypass.

Include affected versions, reproduction steps, impact, and a minimal proof of concept. Remove real keys, personal exports, raw prompts, and private database content. You should receive acknowledgement within five business days; investigation and remediation timing depends on severity and maintainer availability.

## Current security boundary

- The SQLite database is stored locally and is not encrypted at rest.
- The local HTTP API uses a session token and browser-origin checks, but the local OS account remains the trust boundary.
- Imported content is treated as data for retrieval, not trusted instructions, but file parsing is not sandboxed.
- External prompts are rendered and redacted locally, then require a bound approve/deny decision.
- Provider records store a secret environment-variable name, never the value. When a value is saved to the local secret store (`.future/secrets.json`) it is encrypted at rest with AES-256-GCM, keyed from `FUTURE_SECRET_KEY` or an auto-generated `0600` sidecar key. This protects a copied or synced file; it does not defend against an attacker with full local filesystem access (an OS keychain is the intended successor).

Never use production credentials or irreplaceable sensitive data while evaluating this early release.

Release testing of the external-provider boundary must follow the
[synthetic-data privacy checklist](docs/10-build-runbook.md#manual-external-provider-privacy-boundary).
It covers exact redacted prompt previews, deny-without-call behavior, approval,
citations, safe provider failures, and database/timeline leakage checks without
requiring a paid provider.
