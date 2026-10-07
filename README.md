# MemberJunction Open App Template

A **blank-start template** for building
[MemberJunction](https://github.com/MemberJunction/MJ) Open Apps. Clone it,
rename a handful of identifiers, and start adding your schema, code, and
metadata — every folder and config file is pre-wired to MJ's conventions and
carries comments explaining what goes in it. It ships **no migrations, no
generated code, and no build output** — the structure and guidance are here, the
content is yours. The one exception is deliberate: a single placeholder page, wired
all the way through to Explorer, because that wiring fails silently and is worth
proving rather than describing.

> **What an Open App is:** its manifest (`mj-app.json`) plus whatever optional
> blocks it declares — a database schema + migrations, mj-sync metadata,
> server packages loaded by MJAPI, and client packages bundled into
> MJExplorer. Everything is additive; a manifest-only app is valid.
>
> **The authoritative references live in the MJ repo** — read them alongside this template
> (prefer the copies in your own MJ checkout, which are version-matched to the MJ you run):
> - [`packages/OpenApp/README.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/README.md) — the Open App format itself: manifest, lifecycle, install/upgrade/remove, package roles
> - [`packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md) — what counts as breaking once you have published
> - [`guides/BUILDING_APPS_ON_MJ.md`](https://github.com/MemberJunction/MJ/blob/next/guides/BUILDING_APPS_ON_MJ.md) — building *on* MJ generally, beyond the Open App packaging
> - [`guides/OPEN_APP_WORKSPACE_LINKING_SPEC.md`](https://github.com/MemberJunction/MJ/blob/next/guides/OPEN_APP_WORKSPACE_LINKING_SPEC.md) — the linking model `mj dev workspace` implements
> - [`CLAUDE.md`](https://github.com/MemberJunction/MJ/blob/next/CLAUDE.md) — MJ's development rulebook, inlined into this repo's own `CLAUDE.md` via `@`-import when a checkout is beside it
> - [`guides/README.md`](https://github.com/MemberJunction/MJ/blob/next/guides/README.md) — the index of every MJ guide, when you need one this list doesn't name
>
> The annotated manifest reference is copied into this repo as
> [`mj-app.reference.jsonc`](mj-app.reference.jsonc).

## What's in the box

| Path | Purpose | Required? |
|---|---|---|
| `mj-app.json` | THE app manifest (identity, schema, migrations, packages) | **Required** |
| `mj-app.reference.jsonc` | Fully-annotated manifest reference — every block explained | reference |
| `migrations/` | Skyway migrations for your schema — **starts empty**; inert example skeleton + README inside | With a schema |
| `metadata/` | mj-sync metadata. `schema-info/` registers your schema and `applications/` is what puts your app in Explorer's switcher — **both require fill-out** (they ship as inert `.template` files; see each folder's README). Guides: `docs/template-docs/metadata.md`, `docs/template-docs/explorer-visibility.md` | Optional |
| `packages/Entities` | CodeGen entity subclasses land here (placeholder until your first codegen) | With a schema |
| `packages/CoreEntitiesServer` | Server-side entity overrides (validation, save hooks) | Optional |
| `packages/Actions` | MJ Actions — agent/workflow integration points | Optional |
| `packages/Server` | Server bootstrap — MJAPI imports it at startup and calls its `startupExport` | With server code |
| `packages/Angular` | Client bootstrap — MJExplorer bundles it; your components + generated forms. Ships **one placeholder page** wired end-to-end so the Explorer chain is provable | With UI |
| `mj.config.cjs` | CodeGen/migrate configuration for this repo | **Required** for codegen |
| `.github/workflows/` | CI: `build`, `changes` (door checks), `version` (Version Packages PR), `release-readiness` (`rr:` release gates), `publish` (npm via OIDC + back-merge). In the template itself the release jobs skip. | Recommended |
| `.changeset/` + `ci/` | Fixed versioning + release pipeline helpers | Recommended |
| `pnpm-workspace.yaml` + `.npmrc` | pnpm workspace + resolution settings (this repo is **pnpm**, like MJ 6.x) | **Required** |
| `docs/template-docs/` + `plans/complete/TEMPLATE-SPEC.md` | The deep-dive docs + the full required/optional inventory | Recommended |

Each package is deliberately minimal — a `package.json` (showing the
dependency conventions), a `tsconfig.json`, and one commented source file that
explains what belongs there. All five build out of the box:

```sh
corepack pnpm install && pnpm run build:packages    # no MJ checkout or DB needed
```

**Package manager: pnpm ≥ 10**, matching MemberJunction 6.x. `pnpm-lock.yaml` is
the lockfile of record and `package-lock.json` is gitignored, so a stray
`npm install` can't leave a conflicting one behind.

## Getting started

1. **Run the setup script** — `pnpm run init` renames every template
   identifier to your app's values (id, display name, npm scope, schema,
   entity prefix, repo URL, publisher) and activates
   `metadata/schema-info/` with a freshly generated stable UUID. Review with
   `git diff`, then `pnpm install` to regenerate the lockfile. Prefer doing it
   by hand? The manual checklist lives in
   [docs/template-docs/getting-started.md](docs/template-docs/getting-started.md)
   (`grep -r "mj-sample-app" .` finds every fill-in point).
2. **Create your repo + branches** — `next` (default, integration) and `main`
   (release): [docs/template-docs/repo-setup.md](docs/template-docs/repo-setup.md).
3. **Link to a MemberJunction checkout** — development happens against MJ:
   `mj dev workspace` joins your clone and an MJ clone into one pnpm workspace.
   The step-by-step method (and exactly when you need a database) is
   [docs/template-docs/linking-to-mj.md](docs/template-docs/linking-to-mj.md).
4. **Build your app** using the workflow below.

## Development workflow (the loop you'll live in)

Commands run from **this repo's root**, with the app linked to an MJ checkout
(see [docs/template-docs/linking-to-mj.md](docs/template-docs/linking-to-mj.md)) —
`pnpm install` itself runs at the **workspace parent** once linked.

| You want to… | Do this | Details |
|---|---|---|
| **Add a table / schema change** | Write `migrations/V<YYYYMMDDHHMM>__v<ver>_<Desc>.sql` (copy the `EXAMPLE_*.sql.example` skeleton), then run migrations + codegen (below) | [migrations/_README.md](migrations/_README.md), [docs/template-docs/codegen-and-metadata-migrations.md](docs/template-docs/codegen-and-metadata-migrations.md) |
| **Run your migrations** | `pnpm run mj:migrate` | [docs/template-docs/linking-to-mj.md](docs/template-docs/linking-to-mj.md) §3 |
| **Run CodeGen** (after every schema/metadata change) | `pnpm run mj:codegen` — generates entity classes, resolvers, and forms into `packages/*/src/generated/`; **commit the generated code with its migration** | [docs/template-docs/codegen-and-metadata-migrations.md](docs/template-docs/codegen-and-metadata-migrations.md) |
| **Capture a CodeGen migration** | Fold the SQL CodeGen emitted for YOUR objects (from `migrations/codegen/`, gitignored scratch) into a `V*` migration; never fold the `__mj_*` system plumbing — CodeGen re-applies that everywhere itself | [docs/template-docs/codegen-and-metadata-migrations.md](docs/template-docs/codegen-and-metadata-migrations.md) |
| **Add / change metadata** (apps, nav items, lookup seeds, actions) | Add an entity folder under `metadata/`, `pnpm exec mj sync push --dir=./metadata --format=json`, then capture the SQL as a `V*_Metadata_Sync.sql` migration | [docs/template-docs/metadata.md](docs/template-docs/metadata.md) |
| **Add server code** (entity overrides, engines, resolvers) | `packages/CoreEntitiesServer` / `packages/Server` — wire new modules into `Server/src/index.ts` so the bootstrap loads them | comments in those files |
| **Add an Action** | `packages/Actions` — `@RegisterClass(BaseAction, '<Your App>: <Name>')` + an action metadata record + migration | comments in `packages/Actions/src/index.ts` |
| **Add UI** (components / dashboards) | `packages/Angular` — components under `src/lib/`, exported from `public-api.ts`; nav items via the `metadata/applications/` record | [docs/template-docs/explorer-visibility.md](docs/template-docs/explorer-visibility.md) |
| **Make the app show up in Explorer** | Fill in `metadata/applications/`, match each nav item's `DriverClass` to an `@RegisterClass(BaseResourceComponent, …)` component, rebuild Explorer | [docs/template-docs/explorer-visibility.md](docs/template-docs/explorer-visibility.md) |
| **Build** | `pnpm run build:packages` (one package: `pnpm --filter @mj-sample-app/ng run build`) | — |
| **Ship a change** | Changeset (`pnpm exec changeset`, ≥ minor if it adds a migration) → PR to `next` | [docs/template-docs/branching.md](docs/template-docs/branching.md) |
| **Release / publish to npm** | Merge the Version Packages PR (opened automatically, targets `main`); the publish workflow does the rest | [docs/template-docs/publishing.md](docs/template-docs/publishing.md) |

**Managing migrations, the rules that matter:** never edit an applied
migration (add a new one); timestamps must increase; no `__mj_*` columns or FK
indexes in your SQL (CodeGen owns those); additive-only within a published
major version. Full rationale: [docs/template-docs/codegen-and-metadata-migrations.md](docs/template-docs/codegen-and-metadata-migrations.md)
and [docs/template-docs/publishing.md](docs/template-docs/publishing.md).

## Documentation index

Everything above in depth: [docs/template-docs/README.md](docs/template-docs/README.md).
The **MemberJunction development guide** — critical rules, entity/data
patterns, CodeGen + migration rules, Angular conventions, style, testing —
is [docs/claude/](docs/claude/README.md) (topic docs with a TOC, referenced
from [CLAUDE.md](CLAUDE.md)). The complete
what-belongs-in-an-app inventory (required vs optional, with the shipped
first-party apps as exemplars): [plans/complete/TEMPLATE-SPEC.md](plans/complete/TEMPLATE-SPEC.md).
