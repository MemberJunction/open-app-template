# Open App Template — specification

What a MemberJunction Open App repository contains, what each piece is for,
and whether it's required. Derived from the authoritative format reference
([MJ `packages/OpenApp/README.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/README.md) +
[`Engine/manifest.reference.jsonc`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/Engine/manifest.reference.jsonc)) and the
shipped first-party apps (`bizapps-common`, `bizapps-accounting`,
`bizapps-tasks`, `bizapps-forms`), which all converge on this shape.

Legend: **REQ** = required for any app · **REQ\*** = required when the app has
that capability · **REC** = recommended (every shipped app has it) · **OPT** =
optional.

## 1. Repository root

| Item | Level | Purpose / notes | Exemplar |
|---|---|---|---|
| `mj-app.json` | **REQ** | THE manifest. Identity fields required; every capability block (schema, migrations, metadata, packages, dependencies, hooks) is optional + additive. Version must match the GitHub release tag. | `mj-app.reference.jsonc` (annotated) |
| `package.json` | **REQ** | Workspace root: `packageManager: "pnpm@…"`, `workspaces: ["packages/*"]` (kept for the tooling that still reads it — pnpm itself reads `pnpm-workspace.yaml`), build/migrate/codegen/changeset/release scripts, and `pnpm.overrides` pinning `@memberjunction/core`+`global`. Shipped apps also list `apps/*` — this template omits the standalone harness in favor of workspace linking (docs/template-docs/linking-to-mj.md). | bizapps-common, bizapps-accounting |
| `pnpm-lock.yaml` | REC | Committed lockfile (generated on first `pnpm install`); CI validates case-sensitivity. `package-lock.json` is gitignored — pnpm is the package manager, matching MJ 6.x. | all apps |
| `mj.config.cjs` | **REQ\*** (codegen) | CodeGen + migrate config: `entityPackageName`, `output[]` paths into `packages/*`, post-gen build `commands`, `NameRulesBySchema` (entity-name prefix), `includeSchemas` (positive opt-in scope — an exclude list alone does not keep CodeGen off other apps' schemas), `excludeSchemas`, `SQLOutput` (emit SQL for folding into migrations). No credentials — those live in `.env`. | this repo |
| `turbo.json` | REC | Task graph (`build` with `^build` dependency + caching). | all apps |
| `tsconfig.server.json` / `tsconfig.angular.json` | REC | Shared compiler bases the sub-packages extend. | all apps |
| `pnpm-workspace.yaml` | **REQ** | pnpm's workspace + resolution settings: the `packages:` globs, `linkWorkspacePackages: true` (without it, exact-pinned internal deps resolve from the REGISTRY instead of linking locally), and the `onlyBuiltDependencies` allowlist pnpm 10 requires before it will run a dependency's build script. | MJ core, bizapps-accounting |
| `.npmrc` | **REQ** | pnpm settings: `package-manager-strict=false`, `strict-peer-dependencies=false`, `auto-install-peers=true`. Committed (it is what makes an install resolve the same way for everyone); never put a registry token in it. | bizapps-common, bizapps-accounting |
| `.gitignore` | **REQ** | Must exclude `.env`, `node_modules`, `dist`, codegen scratch output. | this repo |
| `README.md` | REC | Overview + doc index. | all apps |
| `CLAUDE.md` + `docs/claude/` | REC | Agent/developer guide: `CLAUDE.md` is a slim entrypoint (repo structure + this repo's hard rules) referencing `docs/claude/` — the MJ development rulebook split into topic docs with a TOC (adapted from MJ's own monolithic CLAUDE.md). | this repo |
| `.vscode/` | OPT | Launch configs / settings. | bizapps-common |
| `scripts/` (lifecycle hooks) | OPT | Only if the manifest declares `hooks`. | — |

## 2. Database + metadata

| Item | Level | Purpose / notes |
|---|---|---|
| `migrations/` | **REQ\*** (schema apps) | Skyway (Flyway-compatible) migrations, applied to the app's OWN schema. Naming `V<YYYYMMDDHHMM>__v<appver>_<Description>.sql` (baseline may use `B` prefix; metadata seeds conventionally `*_Metadata_Sync.sql`). Immutable once applied/published; timestamps strictly increasing (CI-gated). No `__mj_*` timestamp columns / FK indexes (CodeGen owns them); hardcoded UUIDs. |
| `migrations-pg/` | OPT | PostgreSQL variants, generated via `mj migrate convert` (`pnpm run mj:migrate:convert`). On PG the engine reads `<directory>-pg`. |
| `metadata/` | OPT | mj-sync dirs: root `.mj-sync.json` (+ `directoryOrder`), one subfolder per entity (`.mj-sync.json` + `.<records>.json`). DEV-TIME ONLY — installs replay the equivalent SQL from migrations, never this folder. Authoring guide: `docs/template-docs/metadata.md`. Keep sample/draft files OUT of this tree — registered folders' dot-JSON files WILL be pushed. |
| Schema registration (`__mj.SchemaInfo` + `EntityNamePrefix`) | **REQ\*** (schema apps) | Seeded either via a `metadata/schema-info/` folder (this template + bizapps pattern; ships as a fill-out-required `.template`, created on first `mj sync push` after activation) or in the baseline migration — pick ONE. |

## 3. packages/ (npm workspace members)

Naming follows the dominant shipped convention (`bizapps-common`/`accounting`/
`forms`): `Actions, Angular, CoreEntitiesServer, Entities, Server`.
(`bizapps-tasks` variant adds a `Core` shared-types lib and names the server
overrides `EntitiesServer` — equivalent roles.)

| Package | Level | Role | Key dependency shape |
|---|---|---|---|
| `Entities` | **REQ\*** (schema apps) | CodeGen entity subclasses + zod schemas (`src/generated/`); listed in manifest `packages.shared` as `library`. | deps: `zod` · peers: MJ `core`,`global` |
| `CoreEntitiesServer` | OPT | Server-only entity overrides (ValidateAsync, Save hooks). Consumed by `Server`; NOT in the manifest. | dep: sibling `entities` (exact pin) · peers: MJ |
| `Actions` | OPT | MJ Action subclasses (generated + custom); `packages.shared`/`server` as `library`/`actions`. | deps: `zod` · peers: MJ incl. `actions`,`actions-base` |
| `Server` | **REQ\*** (server code) | THE server bootstrap: manifest `packages.server` role `bootstrap` + `startupExport`. Imports/chains the other server packages so one call registers everything; also exports CodeGen resolvers. | deps: siblings (exact pins) · peers: MJ incl. `server` |
| `Angular` | **REQ\*** (UI) | THE client bootstrap: manifest `packages.client` role `bootstrap` + `startupExport`; resource components (`@RegisterClass(BaseResourceComponent, DriverClass)`) matching application nav metadata; `src/lib/generated/` for CodeGen forms. Builds with `ngc`. | dep: sibling `entities` · peers: `@angular/*` ranges + MJ `global` |

Universal package rules: `main: dist/...`, `types`, `repository.url`
(CI-validated, needed for npm provenance), build `tsc && tsc-alias -f` (server)
/ `ngc` (Angular), all packages share ONE fixed version.

## 4. CI/CD + versioning

| Item | Level | Purpose |
|---|---|---|
| `.github/workflows/build.yml` | REC | Compile gate on PRs/pushes to `next` touching packages or the lockfile. |
| `.github/workflows/changes.yml` | REC | PR gate (→`next`/`main`): migration filename format, timestamps newer than base, **migration ⇒ changeset with ≥ minor bump**. |
| `.github/workflows/publish.yml` | REC | Push to `main`: validate → `changeset version` → sync `mj-app.json` version + derived `mjVersionRange` → build → `changeset publish` (npm **OIDC trusted publishing**, no token secret) → tag `vX.Y.Z` → merge-back `main`→`next` + lockfile refresh. |
| `.github/workflows/pg-migrations.yml` | OPT | PG migration conversion/validation (bizapps-accounting). |
| `.github/scripts/*.sh` | REC | The four validators used by the workflows (migration filenames, npm package existence, lockfile case, repository.url). |
| `ci/*.mjs` | REC | Release helpers invoked by publish.yml: `commit_push`, `merge_main`, `merge_main_and_update_lock`. |
| `.changeset/` | REC | Changesets config with `fixed: [["@scope/*"]]` — one version for the whole app. |

## 5. Branch + release structure

- `next` = **default** + integration branch; `main` = release branch (push
  publishes). Feature branches: cut from `next`, named `feature/<desc>`, track
  `origin/<same-name>` only. Release = one coordinating PR `next` → `main`.
- Within a published major: **additive-only** schema changes
  ([MJ `packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md)).

## 6. Documentation set (docs/)

REC for any app meant to be shared; REQUIRED for this template’s purpose:
`getting-started` (fill-in checklist), `repo-setup` (branches/services),
`linking-to-mj` (worktree dev loop + when a DB is needed), 
`codegen-and-metadata-migrations`, `branching`, `versioning-and-peer-deps`,
`publishing`, plus `plans/` for design docs.

## 7. Deliberate omissions in this template

- **`apps/MJAPI` + `apps/MJExplorer` standalone harness** (all shipped apps
  carry one): omitted here in favor of worktree-linked development inside an
  MJ checkout (docs/template-docs/linking-to-mj.md). Copy the pair from `bizapps-common` if
  a repo later needs self-hosted dev.
- `Demos/`, `archive/`, app-specific extras seen in individual repos.
