# <Your App> — development guide (template)

This repository is an **open app** built on top of the
[MemberJunction](https://github.com/MemberJunction/MJ) platform. TODO(template):
replace the placeholders in this file when you rename the app.

**MemberJunction's own `CLAUDE.md` is the authoritative guide — read it first.** The
`@`-imports below inline it into context; only the path matching this repo's topology
resolves, the others are inert. Prefer either over
[GitHub](https://github.com/MemberJunction/MJ/blob/next/CLAUDE.md) — the local copy is
version-matched to the MJ this repo actually runs against.

@../mj/CLAUDE.md
@../../../CLAUDE.md

*(`../mj/` = a sibling MJ checkout — both the MJ 6.x parent workspace `mj dev workspace`
generates and mjdev's instance layout, where this repo is a flat sibling of `mj/`.
`../../../` = legacy nested 5.x, `<instance>/mj/packages/dev-apps/<app>/`.)*

⚠️ **Both paths are literal, so the sibling case depends on the directory name: clone MJ
as `mj`.** `git clone https://github.com/MemberJunction/MJ` produces `MJ/`, which resolves
on a case-insensitive filesystem (macOS) and **silently does not** on Linux/CI — the guide
just never loads, with nothing to notice. Either clone it as `mj`
(`git clone …/MJ.git mj`) or add your own path as a third `@`-import line above.

MJ's guide is MJ-repo-centric — "the repo root" always means *MJ's* root. How **this** app
plugs into MJ's extension points is documented here, and the seam that matters most is the
one MJ's guide never mentions: how a resource component reaches Explorer's app switcher
([`docs/template-docs/explorer-visibility.md`](docs/template-docs/explorer-visibility.md)).

It is developed **linked to a MemberJunction checkout** — the two clones are joined into
one pnpm workspace by `mj dev workspace`; see
[`docs/template-docs/linking-to-mj.md`](docs/template-docs/linking-to-mj.md).

**Package manager: pnpm** (`corepack pnpm --version`, ≥ 10) — matching MJ 6.x,
which is a pnpm monorepo. `pnpm-lock.yaml` is the lockfile of record;
`package-lock.json` is gitignored so a stray `npm install` cannot leave a second
one behind. Two pnpm/npm differences that fail *silently*: selecting one package
is `pnpm --filter <pkg> run build` (npm's `--workspace` flag makes pnpm run the
script at the repo ROOT instead), and `pnpm run x -- --flag` passes `--` through
as a literal argument (drop the `--`).

## Repository structure

```
mj-app.json            - MJ Open App manifest (the source of truth for the app)
mj.config.cjs          - CodeGen config: output paths, schema scope, SQL capture
pnpm-workspace.yaml    - pnpm workspace + resolution settings (see .npmrc)
migrations/            - Skyway migrations for the app schema (starts empty)
metadata/              - mj-sync metadata (dev-time; seeds ship as migrations)
packages/
  Entities/            - @mj-sample-app/entities   (CodeGen entity subclasses + SampleAppEngineBase)
  CoreEntitiesServer/  - @mj-sample-app/core-entities-server (server-side entity overrides)
  Actions/             - @mj-sample-app/actions    (MJ Actions)
  Server/              - @mj-sample-app/server     (server bootstrap -> MJAPI)
  Angular/             - @mj-sample-app/ng         (client bootstrap -> MJExplorer)
docs/                  - how this repo works (branching, publishing, codegen, linking)
docs/claude/           - the MemberJunction development guide (topic-split, with TOC)
AGENTS.md              - universal agent guide mirroring critical rules & performance standards
```

## 📖 The MJ rulebook, distilled → [`docs/claude/`](docs/claude/README.md)

**[docs/claude/](docs/claude/README.md)** is an app-repo-focused distillation of MJ's
`CLAUDE.md`, split into topics with a TOC, each ending in links to MJ's own deep-dive
guides on GitHub. It exists for the case the `@`-imports above cannot cover — a bare clone
with no MJ checkout beside it (CI, a fresh machine, a reviewer reading on GitHub) — and
because it is scoped to what an *app* author needs rather than what an MJ-core contributor
needs.

**MJ's copy stays authoritative.** Where the two disagree, MJ wins; when a checkout is
present the `@`-import above has already put MJ's real guide in context. Read the relevant
topic before working in its area:

| Topic | Doc |
|---|---|
| Critical rules (non-negotiable) | [docs/claude/01-critical-rules.md](docs/claude/01-critical-rules.md) |
| Git & branches | [docs/claude/02-git-and-branches.md](docs/claude/02-git-and-branches.md) |
| Entities & data access | [docs/claude/03-entities-and-data.md](docs/claude/03-entities-and-data.md) |
| Performance | [docs/claude/04-performance.md](docs/claude/04-performance.md) |
| CodeGen & migrations | [docs/claude/05-codegen-and-migrations.md](docs/claude/05-codegen-and-migrations.md) |
| Angular | [docs/claude/06-angular.md](docs/claude/06-angular.md) |
| Code style | [docs/claude/07-code-style.md](docs/claude/07-code-style.md) |
| Metadata & mj-sync | [docs/claude/08-metadata-and-sync.md](docs/claude/08-metadata-and-sync.md) |
| Testing | [docs/claude/09-testing.md](docs/claude/09-testing.md) |

The authoring rules MJ and every BizApps repo share (plain migration DDL, CHECK values
written for people, a `primaryKey` on every metadata record) are in MJ's
[Schema and Code Authoring Guide](https://github.com/MemberJunction/MJ/blob/next/guides/SCHEMA_AND_CODE_AUTHORING_GUIDE.md), each with its reason.

## The rules that matter most in THIS repo

1. **No commits without explicit approval** — never run `git commit` unless
   the user asked for that commit; commit only what is staged.
2. **Never edit `src/generated/`** in any package — CodeGen overwrites it.
   After schema/metadata changes run codegen and **commit the regenerated code
   together with its migration** (`docs/template-docs/codegen-and-metadata-migrations.md`).
3. **Never edit an applied migration** — add a new `V*` file. Additive-only
   within a published major version.
4. **Branch rules** — feature branches cut from `next`, tracking
   `origin/<same-name>` only; PRs target `next`; a PR adding a migration must
   include a changeset (≥ minor). See `docs/template-docs/branching.md`.
5. **Single-copy invariant** — `@memberjunction/*` are peerDependencies; never
   hard-depend on them, and never run an install *inside* a member of a linked
   workspace (installs happen at the workspace parent). A second physical copy of
   `@memberjunction/global`/`core` splits MJ's class-factory registry and your
   entities/resolvers silently stop appearing
   (`docs/template-docs/versioning-and-peer-deps.md`).
6. **When linked to MJ**: the *registration* edits in the MJ repo
   (`mj.config.cjs` `dynamicPackages`, MJAPI/MJExplorer `package.json`, the
   Explorer bootstrap import) are local-only — never commit them to MJ. The
   *linking* files are generated at the workspace parent, outside both repos, and
   are never committed anywhere.

## Performance & Caching Standard (5 Non-Negotiable Rules)

Full concrete TypeScript examples live in [`docs/claude/04-performance.md`](docs/claude/04-performance.md) and the starter engine in [`packages/Entities/src/app-engine-base.ts`](packages/Entities/src/app-engine-base.ts):

1. **`BaseEngine` (`BaseSingleton`) for Bounded Reference/Taxonomy Metadata:** Cache small lookup/config tables (types, statuses, roles, categories) via `BaseEnginePropertyConfig` with `AutoRefresh: true` and O(1) lookup maps reset in `AdditionalLoading()` — never re-query them via `RunView` per widget mount.
2. **Multi-Provider & Impersonation Safety:** Override `ProviderToUse` to follow the active provider passed to `Config()` / `Metadata.Provider`; auto-evict user caches whenever `userId` changes; set `CacheLocal: false` on any RLS-filtered entity; gate optional/staff-only queries on `EntityInfo.GetUserPermisions(user)?.CanRead`.
3. **Mandatory `rv.RunViews([...])` Single-Request Batching:** Never fire `Promise.all([new RunView().RunView(...), ...])` (N separate HTTP requests) or multi-hop `ParentID` loops when `RootParentID` exists. Use `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` with `ResultType: 'simple'` + narrow `Fields`.
4. **`ConversationEngine`-Style Bounded Container Caching:** Never cache unbounded transactional tables globally or cache arbitrary `ExtraFilter` SQL list views. Cache only bounded container windows/subtrees (e.g., per-`SpaceID`, per-`ConversationID`, per-`RootParentID`) with `BaseEntity` event invalidation + explicit `Invalidate*()` + persona-switch eviction.
5. **RLS-Safe Two-Step Entity Reads:** Never write raw SQL subqueries against RLS-filtered base views (`vw*`) inside `ExtraFilter`; read the RLS-protected entity via `RunView` first, then pass `ID IN (...)`.

## MJ Docs (MJ: Artifacts) vs. MJ: Comments vs. Quick Notes Rubric

Canonical guide (upstream `MemberJunction/MJ` repository, path `MJ/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md`): [MJ Docs, Comments & Notes Guide](https://github.com/MemberJunction/MJ/blob/next/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md).

### 4-Way Estate-Wide Rubric

1. **Category A — Direct MJ Docs (`MJ: Artifacts`):** Long-form deliverables, versioned briefs/minutes/reports, AI-coauthored documents, Slide Decks, and Live-Block readouts (`>200` words, needing `v1 -> v2` diffs, Yjs CRDT collaborative editing, guest share links, or cross-format synthesis).
2. **Category B — Hybrid (Fast Note + Linked/Promotable MJ Doc):** Frictionless `<2s` inline capture (e.g., call notes, meeting scratchpads, activity timelines) backed by a nullable `ArtifactID` FK or `RecordArtifact` link and 1-click promotion to a versioned MJ Doc.
3. **MJ: Comments (`IS-A MJ: Conversations`):** Threaded discussions anchored to `Record`, `Field`, `Section`, `Group`, `DocBlock`, `SlideRegion`, or `SheetRange` with `@mentions` and `IsResolved`. **Never store short discussion comments as `MJ: Artifacts`.**
4. **Category C — Lightweight Relational Columns:** Micro-text (`<100` words), audit/rejection/override reasons, GL line memos, high-volume transactional notes, structured form answers, and immutable SHA-256 compliance evidence ledgers.

### Schema & Permission Delegation Rules

- **1:1 vs. 0..N attachment:** Use a direct nullable `ArtifactID` FK (plus optional `ApprovedArtifactVersionID`) for `1:1` primary documents; use polymorphic `MJ: Record Artifacts` (`__mj.RecordArtifact`) for `0..N` attached docs.
- **Host-entity permission delegation:** Set `Artifact.DelegateEntityID` + `DelegateRecordID` for host-entity permission delegation via `IArtifactPermissionDelegate`.
- **Polymorphic FK metadata:** Always set `EntityField.EntityIDFieldName` for polymorphic FK pairs.

### Additive-Only Migration Playbook (`PUBLISH_NO_BREAK_POLICY.md`)

Follow the upstream `MemberJunction/MJ` [`PUBLISH_NO_BREAK_POLICY.md`](https://github.com/MemberJunction/MJ/blob/next/PUBLISH_NO_BREAK_POLICY.md) 4-step **Expand -> Bridge -> Deprecate -> EraBump** playbook (additive-only: never drop, rename, or narrow columns within a platform era):

1. **Expand:** Add nullable `ArtifactID` (and optional `ApprovedArtifactVersionID`) FK or `__mj.RecordArtifact` linkage alongside existing relational note columns.
2. **Bridge:** Support dual-read, incremental backfill, or 1-click promotion while preserving full backward compatibility for existing consumers.
3. **Deprecate:** Mark legacy note columns deprecated in metadata and docs once callers migrate; keep existing columns intact and readable.
4. **EraBump:** Remove deprecated columns only on a coordinated platform era boundary.

### Explicit Anti-Goals

- **Never** store short threaded discussion comments or `<100`-word micro-text/audit reasons as `MJ: Artifacts`.
- **Never** drop, rename, or narrow existing note columns within a platform era.
- **Never** bypass `IArtifactPermissionDelegate` (omitting `Artifact.DelegateEntityID` + `DelegateRecordID` where host-entity permissions govern access) or omit `EntityField.EntityIDFieldName` on polymorphic FK pairs.

## Build & dev commands

```sh
# this repo (works standalone AND as a workspace member):
pnpm install                  # at the WORKSPACE PARENT when linked; here when standalone
pnpm run build:packages       # build this app's packages
pnpm run mj:migrate           # apply this app's migrations (needs a DB + .env)
pnpm run mj:codegen           # regenerate entities/resolvers/forms after a schema change

# one package only (from the workspace root):
pnpm --filter @mj-sample-app/ng run build

# deterministic migration <-> CodeGen alignment check:
node ./.github/scripts/check-migration-codegen-alignment.mjs --self-test
node ./.github/scripts/check-migration-codegen-alignment.mjs --base origin/next
```

The full development workflow (where to add code, capturing codegen
migrations, releasing) is in the README's "Development workflow" table.
Metadata is the exception: a PR adds JSON only, and the `Metadata_Sync`
migration is generated once per release (below).

## Metadata ships as release migrations

`mj app install` and upgrades run migrations only. There is no metadata phase, by design. A record that exists only as JSON under `metadata/` reaches no host until a release ships it inside a migration.

- **PRs carry metadata JSON only.** Never hand-write or generate a `*__Metadata_Sync.sql` in a feature PR.
- **The build engineer** generates one differential `Metadata_Sync` migration per release, from a fresh database.
- **Rows missing after a fresh install** usually mean a release shipped without its metadata migration. Hand that to the build engineer rather than changing the installer.

The model, and the Open App steps that differ from core (`--schema`, the `${mjSchema}` substitution): [Release Metadata Migrations Guide](https://github.com/MemberJunction/MJ/blob/next/guides/RELEASE_METADATA_MIGRATIONS_GUIDE.md).
