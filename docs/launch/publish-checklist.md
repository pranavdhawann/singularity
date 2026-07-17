# Publish checklist (owner-performed)

All posting is done by the repository owner. Agents prepare; humans publish.

## Preconditions — all must be true before posting anywhere

- [ ] v0.2.0 release is live on the Releases page.
- [ ] README shows the inline demo GIF on github.com (check on mobile too).
- [ ] Fresh-clone verification: `git clone` → `corepack pnpm install --frozen-lockfile` → `corepack pnpm demo` works on a machine that has never built the repo.
- [ ] Docker path verified: `docker build` + `docker run` + ask `launch readiness decision` in the browser.
- [ ] You have 3+ free hours after posting to answer comments.

## Posting order

1. **r/LocalLLaMA** (best-fit audience) — use `reddit.md`. Post Tue–Thu, morning US time. Flair: "Resources".
2. **Show HN** — use `hacker-news.md` title verbatim (keep "Show HN:" prefix). Post Tue–Thu, 8–10am ET. Do not repost within a week; one later repost is acceptable per HN norms if it gets no traction.
3. **X/Twitter thread** — use `social.md`; lead with the GIF as native media.
4. **lobste.rs** — tag `ai`, `privacy`; only if you have an account in good standing.
5. **Ollama Discord #showcase** and **r/selfhosted** — 2–3 days later, so feedback from (1)–(2) is already folded in.

## Engagement rules

- Reply to every substantive comment within the first 3 hours.
- Never ask for stars, up-votes, or follows, anywhere.
- Convert every reported install failure into a GitHub issue the same day and link it in-thread.
- If a thread flops, don't argue or repost immediately — fold the feedback into the README and retry the channel in 2+ weeks.

## Follow-up content (week 2+)

- [ ] Technical deep-dive post: "Hash-bound prompt approval: making an AI assistant's egress auditable" — the permission gate is the novel engineering; pitch to HN/lobste.rs as a blog post, not a Show HN.
