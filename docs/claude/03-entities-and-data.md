# 3 · Entities & data access

## Creating entity objects — always via Metadata

Never `new EntityClass()` — it bypasses MJ's class factory (and any registered
subclass overrides). Always:

```typescript
const md = new Metadata();
const person = await md.GetEntityObject<PersonEntity>('Person', contextUser);
```

- Use the generic parameter for full typing (`GetEntityObject<T>`, `RunView<T>`, `Load<T>`).
- **Server-side code always passes `contextUser`** (to `GetEntityObject` AND
  `RunView`) — the server serves many users; omitting it breaks isolation and
  auditing. Client-side Angular code may omit it (context is ambient).

## Loading collections — `RunView` & `RunViews`

```typescript
const rv = RunView.FromMetadataProvider(this.ProviderToUse);
const result = await rv.RunView<PersonRow>({
    EntityName: 'Person',
    ExtraFilter: `LastName='Smith'`,
    Fields: ['ID', 'FirstName', 'LastName'],
    OrderBy: 'FirstName ASC',
    ResultType: 'simple',
}, contextUser);
if (result.Success) { const people = result.Results ?? []; }
else { LogError(result.ErrorMessage); }
```

- **RunView does NOT throw** — check `result.Success` / `result.ErrorMessage`.
  A try/catch around it catches nothing.
- **Batch independent queries with `rv.RunViews([...])` (plural)** — NEVER fire
  `Promise.all([new RunView().RunView(...), ...])` (that sends N separate HTTP
  requests). Never call `RunView` inside a loop; load once, aggregate client-side.
- **Read bounded lookup/taxonomy tables from your `BaseEngine`**
  (`SampleAppEngineBase.Instance`) instead of issuing `RunView` on every mount.
- Prefer the view's denormalized fields (`run.Model`) over a second lookup by
  ID (`run.ModelID` → query), and query `RootParentID` in one read instead of
  multi-hop `ParentID` loops.

## RLS-safe two-step entity reads & permission gating

- **Never write raw SQL subqueries against RLS-filtered views (`vw*`) in `ExtraFilter`**
  (they bypass MJ's RLS pipeline and break SQL Server / PostgreSQL parity).
  Instead, query the RLS-protected entity via `RunView` first, collect the
  returned IDs, and pass `ID IN (...)` to the second query.
- **Gate optional queries on `EntityInfo.GetUserPermisions(user)?.CanRead`**
  before querying staff-only or optional entities so lower-privilege users
  degrade cleanly without authorization errors.
- See [`04-performance.md`](04-performance.md) for full TypeScript examples of
  all 5 performance & caching rules.

## Save / Delete — booleans, not exceptions

`Save()`/`Delete()` return `true`/`false`; they do **not** throw on logical
failures (validation, permissions, FK violations). Always check the return
value and read errors from `entity.LatestResult?.CompleteMessage` (not
`.Message` — `CompleteMessage` combines everything).

## The spread-operator trap

BaseEntity fields are getters — the spread operator skips them.
`{ ...entity }` silently produces an object with **no** field values. Use
`{ ...entity.GetAll() }`.

## Looking up entity definitions

Use `md.EntityByName(name)` (case-insensitive, trimmed, O(1)) — never
`md.Entities.find(e => e.Name === …)` (case-sensitive scan that silently
misses). Guard the `undefined` return. Iterate `md.Entities` only when you
genuinely need all of them.

## Entity naming — the "MJ: " prefix

Newer MJ core entities are named with an `MJ: ` prefix
(`'MJ: AI Agent Runs'`, not `'AI Agent Runs'`); older ones aren't. Verify
names in the generated `entity_subclasses.ts` (the `@RegisterClass` JSDoc
shows each entity's exact name). Your own app's entities get YOUR schema
prefix (this template: `Sample App: `) via `SchemaInfo.EntityNamePrefix` +
`mj.config.cjs` `NameRulesBySchema` — that's what prevents cross-app
collisions.

## Provider awareness (multi-provider code paths)

`new Metadata()` resolves to the process-global provider. Inside a class that
owns a provider (`ProviderBase`, `BaseEngine`, `BaseEntity`) use `this` /
`this.ProviderToUse`; in helpers accept an optional
`provider?: IMetadataProvider` and fall back to the global explicitly. Global
is fine in single-provider apps, CLI scripts, and bootstrap code.


## MJ's deep-dive guides

- [`guides/BASE_ENTITY_SERVER_PATTERNS.md`](https://github.com/MemberJunction/MJ/blob/next/guides/BASE_ENTITY_SERVER_PATTERNS.md) — server-side `BaseEntity` subclass patterns (validation, save hooks), i.e. what belongs in `packages/CoreEntitiesServer`
- [`guides/TRANSACTIONS_AND_BATCHING_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/TRANSACTIONS_AND_BATCHING_GUIDE.md) — transaction groups and batched saves
- [`guides/ENTITY_SEARCH_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/ENTITY_SEARCH_GUIDE.md) — search across entities
- [`guides/SOFT_DELETES_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/SOFT_DELETES_GUIDE.md) — soft-delete semantics
- [`guides/UUID_COMPARISON_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/UUID_COMPARISON_GUIDE.md) — comparing UUID primary keys correctly (a real source of silent bugs)
- [`guides/RECORD_SET_PROCESSING_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/RECORD_SET_PROCESSING_GUIDE.md) — processing large record sets
