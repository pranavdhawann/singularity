# Two-minute demo script

1. Run `corepack pnpm demo` and open the local URL.
2. Point out the seeded **Future Demo** workspace, **Offline Demo** model, and **Privacy: Local only** status.
3. Open Imports and show `future-demo.md` completed through the real import pipeline.
4. Ask `launch readiness decision`.
5. Open the citation and show the document range, ranking reasons, model, token estimate, and redaction count.
6. Switch to a prepared OpenAI-compatible profile and ask a source-backed question containing a test email in the imported context.
7. Show the exact redacted prompt and immutable binding, then deny it. Explain that the provider receives no call.
8. Repeat and approve; show the streamed cited answer and approval event.
9. Close by stating the release boundary: local-first and functional, but not production-ready or packaged yet.
