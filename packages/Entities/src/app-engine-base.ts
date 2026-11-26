/**
 * SampleAppEngineBase — browser-safe reference BaseEngine template for this Open App.
 *
 * Implements MemberJunction's 5-Rule Performance & Caching Standard out of the box:
 * 1. Bounded reference/taxonomy caching via `BaseEnginePropertyConfig` (`AutoRefresh: true`).
 * 2. Multi-provider & impersonation safety: overrides `ProviderToUse` to track the active
 *    provider passed to `Config()` / `Metadata.Provider`, auto-evicts per-user caches on
 *    `userId` change, gates optional reads on `EntityInfo.GetUserPermisions(user)?.CanRead`,
 *    and documents `CacheLocal: false` for any RLS-filtered entity.
 * 3. Single-request `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` batching.
 * 4. `ConversationEngine`-style bounded per-container caching with `BaseEntity` event
 *    invalidation, explicit `InvalidateContainer()`, and persona-switch eviction — never
 *    caching unbounded transactional tables globally or arbitrary `ExtraFilter` list views.
 * 5. RLS-safe two-step entity reads (no raw SQL subqueries against RLS-filtered `vw*` views).
 *
 * TODO(template): after adding your app's first lookup/taxonomy entities and running CodeGen:
 *   - Add `BaseEnginePropertyConfig` entries in `Config()` for bounded reference tables
 *     (types, statuses, roles, categories) with `AutoRefresh: true`.
 *   - Build O(1) memoized lookup maps (`Map<string, Entity>`) and clear them in `AdditionalLoading()`.
 *   - Call `LoadSampleAppEngineBase()` from your server and client bootstrap packages so
 *     `@RegisterForStartup()` is preserved by bundlers.
 */
import {
    BaseEngine,
    type BaseEnginePropertyConfig,
    type BaseEntityEvent,
    type IMetadataProvider,
    Metadata,
    RegisterForStartup,
    RunView,
    type UserInfo,
} from '@memberjunction/core';

const normalizeKey = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * Per-provider, per-user bounded container cache bucket.
 * Automatically replaced whenever the active `userId` changes (e.g., persona switch / impersonation)
 * or `ClearUserCaches()` increments the cache epoch.
 */
interface UserProviderContainerCache {
    epoch: number;
    userId: string;
    containersByKey: Map<string, Readonly<Record<string, string | number | boolean | null | undefined>>>;
}

@RegisterForStartup()
export class SampleAppEngineBase extends BaseEngine<SampleAppEngineBase> {
    private _activeProvider: IMetadataProvider | null = null;
    private _providerUserCaches = new WeakMap<IMetadataProvider, UserProviderContainerCache>();
    private _lastActiveCache: UserProviderContainerCache | null = null;
    private _userCacheEpoch = 0;
    private _lastConfiguredUserId = '';

    /**
     * Singleton accessor backed by `BaseSingleton` (`GetGlobalObjectStore()`).
     * Never replace with a manual `static _instance` field.
     */
    public static get Instance(): SampleAppEngineBase {
        return super.getInstance<SampleAppEngineBase>();
    }

    /**
     * Follows the active provider passed to `Config()`, falling back to `super.ProviderToUse`
     * (which resolves to `Metadata.Provider`). Keeps multi-provider servers and browser
     * impersonation sessions bound to the active provider.
     */
    public override get ProviderToUse(): IMetadataProvider {
        return this._activeProvider ?? super.ProviderToUse;
    }

    /**
     * Loads bounded reference/taxonomy tables via `BaseEngine.Load()`.
     * Safe to call from every UI or server entry point — repeated calls with `forceRefresh = false`
     * return immediately once loaded, and auto-evict user caches when the caller identity changes.
     */
    public async Config(
        forceRefresh = false,
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<void> {
        const md = provider ?? Metadata.Provider;
        this._activeProvider = md;

        const effectiveUser = contextUser ?? md.CurrentUser;
        const nextUserId = normalizeKey(effectiveUser?.ID);
        if (nextUserId !== this._lastConfiguredUserId) {
            this._lastConfiguredUserId = nextUserId;
            this.ClearUserCaches();
        }

        // TODO(template): register your app's bounded reference/taxonomy tables here.
        // Example:
        //   const params: Array<Partial<BaseEnginePropertyConfig>> = [
        //       {
        //           PropertyName: '_itemTypes',
        //           EntityName: 'Sample App: Item Types',
        //           AutoRefresh: true,
        //           CacheLocal: true,   // Set CacheLocal: false on ANY RLS-filtered entity!
        //           OrderBy: 'Sequence ASC',
        //       },
        //   ];
        // For optional/admin-only entities, check `this.CanReadEntity(entityName, effectiveUser)`
        // or split them into a separate Admin engine so non-admin users never hit a permission error.
        const params: Array<Partial<BaseEnginePropertyConfig>> = [];

        return await this.Load(params, md, forceRefresh, contextUser);
    }

    /**
     * Reset all derived O(1) lookup maps and per-user bounded container caches on load/reload.
     */
    protected override async AdditionalLoading(_contextUser?: UserInfo): Promise<void> {
        this.ClearUserCaches();
    }

    /**
     * Automatic invalidation hook for bounded container caches when a tracked entity saves or deletes.
     * Override or extend to invalidate specific container keys (e.g. by `SpaceID` or `ConversationID`)
     * instead of caching arbitrary filtered list views.
     */
    protected override async HandleIndividualBaseEntityEvent(event: BaseEntityEvent): Promise<boolean> {
        const handled = await super.HandleIndividualBaseEntityEvent(event);
        if (event.type === 'save' || event.type === 'delete') {
            const recordId = event.baseEntity?.PrimaryKey?.Values?.();
            if (recordId) {
                this.InvalidateContainer(recordId);
            }
        }
        return handled;
    }

    /**
     * Permission gate for optional queries (Rule 2).
     * Check before querying entities that lower-privilege personas or guests may not read.
     */
    public CanReadEntity(
        entityName: string,
        user?: UserInfo,
        provider?: IMetadataProvider,
    ): boolean {
        const md = provider ?? this.ProviderToUse;
        const effectiveUser = user ?? md.CurrentUser;
        if (!effectiveUser) {
            return false;
        }
        const entityInfo = md.EntityByName(entityName);
        if (!entityInfo) {
            return false;
        }
        return Boolean(entityInfo.GetUserPermisions(effectiveUser)?.CanRead);
    }

    /**
     * Creates a provider-bound `RunView` for batched `rv.RunViews([...])` queries (Rule 3).
     */
    protected createRunView(provider?: IMetadataProvider): RunView {
        return RunView.FromMetadataProvider(provider ?? this.ProviderToUse);
    }

    // ─── Bounded Per-Container User Cache (Rule 4) ────────────────────────────

    /**
     * Clears all per-user bounded container caches across every provider.
     * Call on sign-out, persona switch, or full reload.
     */
    public ClearUserCaches(): void {
        this._userCacheEpoch += 1;
        this._lastActiveCache = null;
    }

    /**
     * Evicts a single bounded container entry (or clears all user caches when `containerKey` is omitted).
     */
    public InvalidateContainer(containerKey?: string | null): void {
        const normalized = normalizeKey(containerKey);
        if (!normalized) {
            this.ClearUserCaches();
            return;
        }
        const active = this._lastActiveCache;
        if (active && active.epoch === this._userCacheEpoch) {
            active.containersByKey.delete(normalized);
        } else {
            this.ClearUserCaches();
        }
    }

    /**
     * Reads a bounded per-container cache entry for `(provider, userId, containerKey)`.
     * Automatically isolates entries by provider and evicts on userId change.
     */
    protected getCachedContainer<T extends Readonly<Record<string, string | number | boolean | null | undefined>>>(
        containerKey: string,
        user?: UserInfo,
        provider?: IMetadataProvider,
    ): T | undefined {
        const md = provider ?? this.ProviderToUse;
        const userId = normalizeKey(user?.ID ?? md.CurrentUser?.ID);
        if (!userId) {
            return undefined;
        }
        const cache = this.getOrCreateUserCache(md, userId);
        return cache.containersByKey.get(normalizeKey(containerKey)) as T | undefined;
    }

    /**
     * Stores a bounded per-container snapshot for `(provider, userId, containerKey)`.
     * Never use this to cache unbounded entity lists or arbitrary `ExtraFilter` queries.
     */
    protected setCachedContainer<T extends Readonly<Record<string, string | number | boolean | null | undefined>>>(
        containerKey: string,
        value: T,
        user?: UserInfo,
        provider?: IMetadataProvider,
    ): void {
        const md = provider ?? this.ProviderToUse;
        const userId = normalizeKey(user?.ID ?? md.CurrentUser?.ID);
        const key = normalizeKey(containerKey);
        if (!userId || !key) {
            return;
        }
        const cache = this.getOrCreateUserCache(md, userId);
        cache.containersByKey.set(key, value);
    }

    private getOrCreateUserCache(provider: IMetadataProvider, normalizedUserId: string): UserProviderContainerCache {
        let entry = this._providerUserCaches.get(provider);
        if (!entry || entry.epoch !== this._userCacheEpoch || entry.userId !== normalizedUserId) {
            entry = {
                epoch: this._userCacheEpoch,
                userId: normalizedUserId,
                containersByKey: new Map(),
            };
            this._providerUserCaches.set(provider, entry);
        }
        this._lastActiveCache = entry;
        return entry;
    }
}

/**
 * Tree-shaking anchor so bundlers preserve `@RegisterForStartup()` when imported from
 * server/client bootstrap packages.
 */
export function LoadSampleAppEngineBase(): void {
    void SampleAppEngineBase;
}
