# ADR-0006: v1 platform — Vercel on `*.vercel.app`, content data in git

**Status:** Accepted (locked 2026-10-28 via PLAN.md §7.6/§8)

## Context

Two hard constraints shape hosting: zero secrets (`HANDOFF.md`), and previews + production must deploy with no tokens in the cloud. The owner already has a Vercel↔GitHub link. A custom domain requires a payment, which cannot happen unattended. Separately, v1 has no search or email features that would justify a database.

## Decision

- `apps/web` deploys to **Vercel** through the existing GitHub integration (root `apps/web`): preview deploys on every PR, production on merge — no tokens stored anywhere.
- v1 lives on **`*.vercel.app`**. A standalone domain (not under `tayden.dev`) is attached post-v1 as one PR + a DNS record.
- Content data is **JSON in git** (`editions/`, `data/raw/`): no database at launch. Add a DB only when search or email requires one.
- Keyless analytics wired at `I3` (or a documented fallback); security headers, `robots.txt`, `sitemap.xml` are part of the deploy item.

## Consequences

- The zero-secrets invariant is preserved end to end ([ADR-0001](0001-monorepo-and-git-as-cms.md), [ADR-0002](0002-no-external-llm-apis.md)).
- Edition history, cache, and orchestration state all live in one cloneable repo — disaster recovery is `git clone`.
- Moving to a custom domain later is a URL migration only; canonical URLs should tolerate the change (`/{issue}` paths are domain-independent).
