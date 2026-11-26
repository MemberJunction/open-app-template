# <Your App> — Agent Development Guide (`AGENTS.md`)

This repository is a **MemberJunction Open App** template. All coding agents (Claude Code, Codex, Cursor, Antigravity, Gemini CLI) MUST follow both [`CLAUDE.md`](CLAUDE.md) and the topic-split rulebook under [`docs/claude/`](docs/claude/README.md). When this repo is checked out beside MemberJunction (`../mj/CLAUDE.md`), MJ's `CLAUDE.md` is authoritative.

## Non-Negotiable Rules

Full details: [`docs/claude/01-critical-rules.md`](docs/claude/01-critical-rules.md).

1. **No `any` or lazy `unknown`** — never use `: any`, `as any`, `<any>`, or `unknown` as a shortcut.
2. **No `.Get()` / `.Set()` on typed entities** — always use strongly-typed generated entity properties. Derive value-list unions via `SomeEntity['FieldName']`, never hand-copy them.
3. **Use `BaseSingleton` for all singletons** — extend `BaseEngine<T>` or `BaseSingleton<T>` from `@memberjunction/global` (never a manual `static _instance`).
4. **No cross-package re-exports** — import types/classes from the package that defines them.
5. **No dynamic `import()`** unless narrowly justified (lazy routes, optional peers, measured bundle deferral, untangleable cycle, runtime plugin discovery).
6. **Persist user preferences via `UserInfoEngine.Instance`** — never `localStorage` or `sessionStorage`.
7. **Modern Angular** — `@if`/`@for`/`@switch`, `inject()`, semantic `--mj-*` tokens only (no hardcoded hex), `<mj-loading>`, call `NotifyLoadComplete()` in every `BaseResourceComponent`.
8. **Never edit `src/generated/` or applied migrations** — CodeGen owns `src/generated/`; migrations are immutable once shipped, additive-only within a published major version. Metadata ships as JSON in `metadata/` during PRs (never hand-written `*__Metadata_Sync.sql`).
9. **Single-copy invariant & safe git** — `@memberjunction/*` are `peerDependencies`; never run `pnpm install` inside a member of a linked workspace; never run destructive git commands or commit/push directly to `next`/`main`; always merge PRs with merge commits (never squash).

## Canonical 5-Rule Performance & Caching Standard

Full guide + TypeScript examples: [`docs/claude/04-performance.md`](docs/claude/04-performance.md) and starter engine [`packages/Entities/src/app-engine-base.ts`](packages/Entities/src/app-engine-base.ts).

1. **`BaseEngine` (`BaseSingleton`) for Bounded Reference/Taxonomy Metadata:** Cache lookup/config tables (types, statuses, roles, categories) via `BaseEnginePropertyConfig` (`AutoRefresh: true`) with O(1) lookup maps reset in `AdditionalLoading()` — never re-query them via `RunView` per widget mount.
2. **Multi-Provider & Impersonation Safety:** Override `ProviderToUse` to follow the active provider passed to `Config()` / `Metadata.Provider`; auto-evict user caches on `userId` change; set `CacheLocal: false` on any RLS-filtered entity; gate optional queries on `EntityInfo.GetUserPermisions(user)?.CanRead`.
3. **Mandatory `rv.RunViews([...])` Single-Request Batching:** Never fire `Promise.all([new RunView().RunView(...), ...])` (N separate HTTP requests) or multi-hop `ParentID` loops when `RootParentID` exists. Use `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` with `ResultType: 'simple'` + narrow `Fields`.
4. **`ConversationEngine`-Style Bounded Container Caching:** Never cache unbounded transactional tables globally or cache arbitrary `ExtraFilter` SQL list views. Cache only bounded container windows/subtrees (e.g., per-`SpaceID`, per-`ConversationID`, per-`RootParentID`) with `BaseEntity` event invalidation + explicit `Invalidate*()` + persona-switch eviction.
5. **RLS-Safe Two-Step Entity Reads:** Never write raw SQL subqueries against RLS-filtered base views (`vw*`) inside `ExtraFilter`; read the RLS-protected entity via `RunView` first, then pass `ID IN (...)`.

## Topic Rulebook (`docs/claude/`)

| Topic | Doc |
|---|---|
| Critical rules | [`docs/claude/01-critical-rules.md`](docs/claude/01-critical-rules.md) |
| Git & branches | [`docs/claude/02-git-and-branches.md`](docs/claude/02-git-and-branches.md) |
| Entities & data access | [`docs/claude/03-entities-and-data.md`](docs/claude/03-entities-and-data.md) |
| Performance & caching | [`docs/claude/04-performance.md`](docs/claude/04-performance.md) |
| CodeGen & migrations | [`docs/claude/05-codegen-and-migrations.md`](docs/claude/05-codegen-and-migrations.md) |
| Angular | [`docs/claude/06-angular.md`](docs/claude/06-angular.md) |
| Code style | [`docs/claude/07-code-style.md`](docs/claude/07-code-style.md) |
| Metadata & mj-sync | [`docs/claude/08-metadata-and-sync.md`](docs/claude/08-metadata-and-sync.md) |
| Testing | [`docs/claude/09-testing.md`](docs/claude/09-testing.md) |

## Build & Verification Commands

```sh
pnpm run build:packages                         # Build all app packages
pnpm run test                                   # Run package unit tests
node --test .github/scripts/__tests__/*.spec.mjs # Run CI guard specs
```
