# 4 · Performance & Caching Standard

Every MemberJunction Open App MUST follow the **Canonical 5-Rule Performance Standard** below. The starter engine in [`packages/Entities/src/app-engine-base.ts`](../../packages/Entities/src/app-engine-base.ts) scaffolds these patterns out of the box.

---

## Rule 1 · `BaseEngine` (`BaseSingleton`) for Bounded Reference/Taxonomy Metadata

Small, bounded lookup/config tables (types, statuses, roles, categories, space types, forum types, relationship types) MUST be cached on a `BaseEngine<T>` subclass (`BaseSingleton` + `@RegisterForStartup()`) using `BaseEnginePropertyConfig` with `AutoRefresh: true`. Never re-query them via `RunView` on every widget mount or panel open.

```typescript
import {
    BaseEngine,
    type BaseEnginePropertyConfig,
    type IMetadataProvider,
    Metadata,
    RegisterForStartup,
    type UserInfo,
} from '@memberjunction/core';

@RegisterForStartup()
export class SampleAppEngineBase extends BaseEngine<SampleAppEngineBase> {
    private _statuses: SampleAppStatusEntity[] = [];
    private _statusById: Map<string, SampleAppStatusEntity> | null = null;

    public static get Instance(): SampleAppEngineBase {
        return super.getInstance<SampleAppEngineBase>();
    }

    public async Config(
        forceRefresh = false,
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<void> {
        const md = provider ?? Metadata.Provider;
        const params: Array<Partial<BaseEnginePropertyConfig>> = [
            {
                PropertyName: '_statuses',
                EntityName: 'Sample App: Statuses',
                AutoRefresh: true,
                CacheLocal: true, // OK only for non-RLS public/shared lookup tables
                OrderBy: 'Sequence ASC',
            },
        ];
        return await this.Load(params, md, forceRefresh, contextUser);
    }

    protected override async AdditionalLoading(_contextUser?: UserInfo): Promise<void> {
        this._statusById = null; // Always reset O(1) lookup maps on reload
    }

    public StatusById(id: string): SampleAppStatusEntity | undefined {
        if (!this._statusById) {
            this._statusById = new Map(
                this.GetConfigData<SampleAppStatusEntity>('_statuses').map((s) => [s.ID.toLowerCase(), s]),
            );
        }
        return this._statusById.get(id.toLowerCase());
    }
}
```

- Lazy-load with `await SampleAppEngineBase.Instance.Config(false, contextUser, provider)` at every entry point — once loaded, subsequent calls are a no-op.
- In Angular, subscribe to `engine.ObserveProperty<E>('_statuses')` for reactive updates on save/delete/remote invalidation rather than polling.

---

## Rule 2 · Multi-Provider & Impersonation Safety

Engines run both on multi-tenant/multi-provider servers and in browser sessions that support **persona switching / user impersonation**. Every engine MUST enforce four invariants:

1. **Active `ProviderToUse`:** Track the active `IMetadataProvider` passed to `Config()` (falling back to `super.ProviderToUse` / `Metadata.Provider`), and pass `this.ProviderToUse` to every `RunView.FromMetadataProvider(...)` call.
2. **User-switch cache eviction:** Key per-user caches in a `WeakMap<IMetadataProvider, ...>` with the normalized `userId` and a monotonically increasing epoch. Auto-evict whenever `userId` changes.
3. **`CacheLocal: false` on every RLS-filtered entity:** Browser `LocalCacheManager` (IndexedDB) must never serve User A's RLS-filtered rows to User B after an impersonation switch. Only global, non-RLS taxonomy tables may use `CacheLocal: true`.
4. **Permission gating before optional queries:** Gate optional or staff-only reads on `EntityInfo.GetUserPermisions(user)?.CanRead` (or isolate staff-only metadata in a separate `AdminEngineBase` so guests never fail bootstrap).

```typescript
private _activeProvider: IMetadataProvider | null = null;
private _lastUserId = '';

public override get ProviderToUse(): IMetadataProvider {
    return this._activeProvider ?? super.ProviderToUse;
}

public CanReadEntity(entityName: string, user?: UserInfo): boolean {
    const md = this.ProviderToUse;
    const effectiveUser = user ?? md.CurrentUser;
    if (!effectiveUser) return false;
    return Boolean(md.EntityByName(entityName)?.GetUserPermisions(effectiveUser)?.CanRead);
}

// Inside Config(forceRefresh, contextUser, provider):
const md = provider ?? Metadata.Provider;
this._activeProvider = md;
const nextUserId = (contextUser ?? md.CurrentUser)?.ID?.trim().toLowerCase() ?? '';
if (nextUserId !== this._lastUserId) {
    this._lastUserId = nextUserId;
    this.ClearUserCaches();
}
```

---

## Rule 3 · Mandatory `rv.RunViews([...])` Single-Request Batching

Never fire `Promise.all([new RunView().RunView(...), ...])` — that dispatches N separate GraphQL/HTTP round-trips. Always batch independent queries into ONE `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` call with `ResultType: 'simple'` and narrow `Fields` whenever mutation is not required.

```typescript
// ❌ BAD — 3 separate HTTP requests in parallel
const [itemsRes, membersRes, notesRes] = await Promise.all([
    rv.RunView({ EntityName: 'Sample App: Items', ExtraFilter: `ParentID = '${id}'`, ResultType: 'simple' }),
    rv.RunView({ EntityName: 'Sample App: Members', ExtraFilter: `ParentID = '${id}'`, ResultType: 'simple' }),
    rv.RunView({ EntityName: 'Sample App: Notes', ExtraFilter: `ParentID = '${id}'`, ResultType: 'simple' }),
]);

// ✅ GOOD — ONE batched HTTP request with narrow projections
const rv = RunView.FromMetadataProvider(this.ProviderToUse);
const [itemsRes, membersRes, notesRes] = await rv.RunViews([
    {
        EntityName: 'Sample App: Items',
        ExtraFilter: `ParentID = '${id}'`,
        Fields: ['ID', 'Name', 'StatusID'],
        ResultType: 'simple',
    },
    {
        EntityName: 'Sample App: Members',
        ExtraFilter: `ParentID = '${id}'`,
        Fields: ['ID', 'UserID', 'RoleID'],
        ResultType: 'simple',
    },
    {
        EntityName: 'Sample App: Notes',
        ExtraFilter: `ParentID = '${id}'`,
        Fields: ['ID', 'Title', '__mj_UpdatedAt'],
        OrderBy: '__mj_UpdatedAt DESC',
        ResultType: 'simple',
    },
], contextUser);
```

### Avoid multi-hop `ParentID` loops when `RootParentID` exists

```typescript
// ❌ BAD — O(depth) sequential RunView round-trips walking ParentID level by level
// ✅ GOOD — single RunView fetching the entire tree in one round-trip
const treeRes = await rv.RunView<TaskRow>({
    EntityName: 'Sample App: Work Items',
    ExtraFilter: `ID = '${rootId}' OR RootParentID = '${rootId}'`,
    Fields: ['ID', 'ParentID', 'RootParentID', 'Name', 'Sequence'],
    OrderBy: 'Sequence ASC',
    ResultType: 'simple',
}, contextUser);
```

### `entity_object` vs `simple` (the biggest easy win)

| Use | When | Notes |
|---|---|---|
| `ResultType: 'entity_object'` | You will **mutate and save** the records | Full `BaseEntity` instances. `Fields` is **ignored** (all columns load by design). |
| `ResultType: 'simple'` + `Fields: [...]` | Read/display/aggregation only | Plain objects, much faster; `Fields` narrows SQL projection and skips large text/JSON columns. |

Anti-pattern: loading `entity_object` just to `.map(r => r.ID)`.

---

## Rule 4 · `ConversationEngine`-Style Bounded Container Caching

**Never** cache unbounded transactional tables globally (e.g., all Orders, all Tasks, all People, all Posts) and **never** build an arbitrary `ExtraFilter` SQL query cache.

Instead, follow `ConversationEngine`'s pattern: cache ONLY **bounded container windows or subtrees** (e.g., per-`SpaceID`, per-`ConversationID`, per-`RootParentID`, or incremental ID-keyed lookups) with three mandatory invalidation paths:

1. **`BaseEntity` event invalidation** via `HandleIndividualBaseEntityEvent(event)` on save/delete.
2. **Explicit `Invalidate*(containerId)`** methods called after out-of-band mutations.
3. **Persona-switch eviction** via `ClearUserCaches()` on `userId` change or `AdditionalLoading()`.

```typescript
protected override async HandleIndividualBaseEntityEvent(event: BaseEntityEvent): Promise<boolean> {
    const handled = await super.HandleIndividualBaseEntityEvent(event);
    if (event.type === 'save' || event.type === 'delete') {
        const containerId = event.baseEntity?.PrimaryKey?.Values?.();
        if (containerId) {
            this.InvalidateContainer(containerId);
        }
    }
    return handled;
}
```

---

## Rule 5 · RLS-Safe Two-Step Entity Reads

**Never** write raw SQL subqueries against RLS-filtered base views (`vw*`) inside `ExtraFilter`. Raw SQL subqueries bypass MJ's row-level security pipeline, break cross-dialect SQL Server/PostgreSQL parity, and can leak unauthorized rows.

Always execute a **two-step entity read**: query the RLS-protected entity through `RunView` first (so MJ enforces RLS and permissions), extract the authorized IDs, then filter the second entity with `ID IN (...)`.

```typescript
// ❌ BAD — raw SQL subquery bypasses RLS and breaks PG parity
const notesRes = await rv.RunView({
    EntityName: 'Sample App: Notes',
    ExtraFilter: `ParentID IN (SELECT ID FROM [sample_app].[vwProtectedContainers] WHERE Status = 'Active')`,
    ResultType: 'simple',
}, contextUser);

// ✅ GOOD — two-step RLS-safe read
const containersRes = await rv.RunView<{ ID: string }>({
    EntityName: 'Sample App: Protected Containers',
    ExtraFilter: `Status = 'Active'`,
    Fields: ['ID'],
    ResultType: 'simple',
}, contextUser);

const allowedIds = (containersRes.Results ?? []).map((r) => r.ID);
if (allowedIds.length === 0) return [];

const notesRes = await rv.RunView<NoteRow>({
    EntityName: 'Sample App: Notes',
    ExtraFilter: `ParentID IN (${allowedIds.map((id) => `'${id}'`).join(', ')})`,
    Fields: ['ID', 'ParentID', 'Title'],
    ResultType: 'simple',
}, contextUser);
```

---

## Deep pagination — keyset, not offset

Background jobs iterating a whole entity use `RunViewParams.AfterKey`
(keyset/seek — O(log N) per page at any depth), not `StartRow` (each page
re-scans everything skipped). Single-column-PK entities only; UI grids can
stay on `StartRow`.

```typescript
let last: CompositeKey | undefined;
while (true) {
    const r = await rv.RunView<MyEntity>({
        EntityName: 'X',
        AfterKey: last,
        MaxRows: 500,
        OrderBy: 'ID ASC',
        ResultType: 'entity_object',
    }, user);
    if (!r.Success || r.Results.length === 0) break;
    /* process */
    if (r.Results.length < 500) break;
    last = CompositeKey.FromID(r.Results[r.Results.length - 1].ID);
}
```

## Server-side caching (know it exists)

MJAPI trusts its local cache completely (`BaseEntity` events invalidate it);
small unfiltered results are auto-cached. Per-query escape hatch when you need
true DB state after out-of-band SQL: `BypassCache: true`. Also: before
bulk-loading an entity a loaded engine may already hold, ask
`BaseEngineRegistry.Instance.TryGetCachedRecords<T>(name, { unfilteredOnly: true })`
— read the returned array, never mutate it. Full doctrine lives in MJ's
[`guides/CACHING_AND_PUBSUB_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/CACHING_AND_PUBSUB_GUIDE.md).

## MJ's deep-dive guides

- [`guides/CACHING_AND_PUBSUB_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/CACHING_AND_PUBSUB_GUIDE.md) — the full caching + pub/sub doctrine referenced above
- [`guides/KEYSET_PAGINATION_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/KEYSET_PAGINATION_GUIDE.md) — pagination that stays fast at depth
- [`guides/LAZY_LOADING_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/LAZY_LOADING_GUIDE.md) — deferring work until it is needed
- [`guides/RECORD_SET_PROCESSING_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/RECORD_SET_PROCESSING_GUIDE.md) — bulk processing patterns
