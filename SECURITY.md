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

- Data is stored in local SQLite and is not encrypted at rest.
- The local HTTP API uses a session token and browser-origin checks, but the local OS account remains the trust boundary.
- Imported content is treated as data for retrieval, not trusted instructions, but file parsing is not sandboxed.
- External prompts are rendered and redacted locally, then require a bound approve/deny decision.
- Secret environment-variable names may be stored; secret values are resolved at call time and should not be persisted.

Never use production credentials or irreplaceable sensitive data while evaluating this early release.
