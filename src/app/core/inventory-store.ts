import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth';
import { Clock } from './clock';
import { Connectivity } from './connectivity';
import { Tables } from './database.types';
import { HouseholdService } from './household';
import { LocalStore } from './local-store';
import { Category, Item, ItemDraft } from './models';
import { applyOps, byCreation, ItemOp, opItemId } from './outbox';
import { clampQty, groupByCategory, needToBuy, toBuyList } from './stock';
import { SUPABASE } from './supabase';
import { ToastService } from './toast';

type ItemRow = Tables<'items'>;

/** How sending one operation ended. */
type SendResult =
  | { kind: 'done'; row?: ItemRow }
  /** The item no longer exists (another member deleted it). */
  | { kind: 'gone' }
  /** The backend refused it for good (for example, the person left the household). */
  | { kind: 'rejected' }
  /** No connection, or a passing failure: try again later. */
  | { kind: 'retry' };

const RETRY_MS = 30_000;

/**
 * The household's stock, shared through Supabase.
 *
 * Three pieces of state, all signals:
 * - `server`: the items as the backend last told us (initial fetch, then Realtime events).
 * - `outbox`: changes made here and not yet confirmed (see outbox.ts), kept on the device so they
 *   survive closing the app without signal.
 * - `items`: what the screen shows, a `computed` of the two.
 *
 * Everything else (to-buy list, groups, headline) is a `computed` of `items`.
 */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly supabase = inject(SUPABASE);
  private readonly cache = inject(LocalStore);
  private readonly auth = inject(AuthService);
  private readonly households = inject(HouseholdService);
  private readonly connectivity = inject(Connectivity);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);

  private readonly householdId = computed(() => this.households.current()?.id ?? null);
  private readonly server = signal<Item[]>([]);
  private readonly outbox = signal<ItemOp[]>([]);
  private readonly _categories = signal<Category[]>([]);

  readonly categories = this._categories.asReadonly();
  readonly items = computed(() =>
    applyOps(this.server(), this.outbox(), this.householdId() ?? '', this.auth.user()?.id ?? null),
  );
  readonly toBuy = computed(() => toBuyList(this.items()));
  readonly groups = computed(() => groupByCategory(this.items(), this._categories()));
  readonly unitsShort = computed(() => this.toBuy().reduce((sum, it) => sum + needToBuy(it), 0));
  readonly isEmpty = computed(() => this.items().length === 0);
  /** Changes made on this device that haven't reached the backend yet. */
  readonly pendingCount = computed(() => this.outbox().length);

  private channel: RealtimeChannel | null = null;
  private flushing = false;
  /** The item whose change is on its way. Its Realtime events wait for the response. */
  private inFlight: string | null = null;
  /** The newest Realtime version of the in-flight item, compared with the response. */
  private echo: Item | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped whenever a sent change lands, so a fetch that started earlier knows it is stale. */
  private writes = 0;
  private fetchAfterFlush = false;

  constructor() {
    // Follow the household: show what this device last knew, then fetch, listen and send.
    let previous: string | null = null;
    effect(() => {
      const id = this.householdId();
      untracked(() => {
        if (previous && previous !== id) this.forget(previous);
        previous = id;
        if (id) this.open(id);
      });
    });

    // Back online: send what queued up, then catch up on what others changed meanwhile.
    effect(() => {
      if (this.connectivity.online()) untracked(() => void this.sync());
    });
  }

  byId(id: string): Item | undefined {
    return this.items().find((it) => it.id === id);
  }

  adjust(id: string, delta: number): void {
    if (this.byId(id)) this.enqueue({ kind: 'adjust', ...this.stamp(), itemId: id, delta });
  }

  /** Sets an exact quantity, sent as the difference so it adds up with others' changes. */
  setQty(id: string, qty: number): void {
    const item = this.byId(id);
    if (item) this.adjust(id, clampQty(qty) - item.currentQty);
  }

  /** Marks an item as bought: back to its monthly level. Returns the previous quantity. */
  restock(id: string): number | undefined {
    const item = this.byId(id);
    if (!item) return undefined;
    this.enqueue({ kind: 'restock', ...this.stamp(), itemId: id });
    return item.currentQty;
  }

  add(draft: ItemDraft): Item | undefined {
    if (!this.householdId()) return undefined;
    const id = crypto.randomUUID();
    this.enqueue({ kind: 'create', ...this.stamp(), item: { id, ...cleanDraft(draft) } });
    return this.byId(id);
  }

  update(id: string, draft: ItemDraft): void {
    if (this.byId(id)) {
      this.enqueue({ kind: 'update', ...this.stamp(), itemId: id, changes: cleanDraft(draft) });
    }
  }

  /** Removes an item and returns a function that puts it back. */
  remove(id: string): (() => void) | undefined {
    const removed = this.byId(id);
    if (!removed) return undefined;
    const op: ItemOp = { kind: 'delete', ...this.stamp(), itemId: id };
    this.enqueue(op);
    return () => {
      // Not sent yet: just drop the delete. Already sent: create it again, same id.
      if (this.outbox().some((o) => o.opId === op.opId) && this.inFlight !== id) {
        this.setOutbox(this.outbox().filter((o) => o.opId !== op.opId));
        return;
      }
      const { name, categoryId, unit, monthlyUsage, currentQty } = removed;
      this.enqueue({
        kind: 'create',
        ...this.stamp(),
        item: { id, name, categoryId, unit, monthlyUsage, currentQty },
      });
    };
  }

  // -------------------------------------------------------------------------------------------
  // Loading and listening
  // -------------------------------------------------------------------------------------------

  private open(householdId: string): void {
    this.server.set(this.cache.read<Item[]>(itemsKey(householdId), []));
    this._categories.set(this.cache.read<Category[]>(categoriesKey(householdId), []));
    this.outbox.set(this.cache.read<ItemOp[]>(outboxKey(householdId), []));

    if (this.channel) void this.supabase.removeChannel(this.channel);
    const filter = `household_id=eq.${householdId}`;
    this.channel = this.supabase
      .channel(`stock:${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter }, (e) =>
        this.received(e.new as ItemRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items', filter }, (e) =>
        this.received(e.new as ItemRow),
      )
      // Deletes can't be filtered by household; they only carry the id.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (e) => {
        const id = (e.old as Partial<ItemRow>).id;
        if (id && id !== this.inFlight) this.setServer(this.server().filter((it) => it.id !== id));
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => void this.fetchCategories(),
      )
      // On the first subscription and after every reconnect: catch up on missed changes.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void this.sync();
      });
    void this.sync();
  }

  /** Sends what is queued, then fetches the whole stock. */
  private async sync(): Promise<void> {
    if (!this.householdId()) return;
    await this.flush();
    await Promise.all([this.fetchItems(), this.fetchCategories()]);
  }

  private async fetchItems(): Promise<void> {
    const householdId = this.householdId();
    if (!householdId) return;
    if (this.flushing) {
      this.fetchAfterFlush = true;
      return;
    }
    const writes = this.writes;
    const { data, error } = await this.supabase.from('items').select('*');
    if (error || householdId !== this.householdId()) return; // offline: keep what we have
    // A change of ours landed while this was in flight: this answer may predate it.
    if (writes !== this.writes) return this.fetchItems();
    this.setServer(data.map(toItem));
  }

  private async fetchCategories(): Promise<void> {
    const householdId = this.householdId();
    if (!householdId) return;
    const { data, error } = await this.supabase
      .from('categories')
      .select('id, name, is_base')
      .order('position');
    if (error || householdId !== this.householdId()) return;
    const categories = data.map((c) => ({ id: c.id, name: c.name, isBase: c.is_base }));
    this._categories.set(categories);
    this.cache.write(categoriesKey(householdId), categories);
  }

  private received(row: ItemRow): void {
    if (row.household_id !== this.householdId()) return;
    const item = toItem(row);
    if (row.id === this.inFlight) {
      // Applying it now would count our own queued change twice; hold it for the response.
      if (!this.echo || isNewer(item, this.echo)) this.echo = item;
      return;
    }
    this.upsertServer(item);
  }

  /** The household went away (signed out, left or removed): drop what this device kept. */
  private forget(householdId: string): void {
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    clearTimeout(this.retryTimer);
    this.server.set([]);
    this.outbox.set([]);
    this._categories.set([]);
    for (const key of [itemsKey, categoriesKey, outboxKey]) this.cache.remove(key(householdId));
  }

  // -------------------------------------------------------------------------------------------
  // Sending
  // -------------------------------------------------------------------------------------------

  private enqueue(op: ItemOp): void {
    this.setOutbox([...this.outbox(), op]);
    void this.flush();
  }

  /** Sends queued operations one at a time, in order, until the queue is empty or offline. */
  private async flush(): Promise<void> {
    if (this.flushing || !this.connectivity.online()) return;
    this.flushing = true;
    clearTimeout(this.retryTimer);
    let refetch = false;
    try {
      while (this.outbox().length) {
        const op = this.outbox()[0];
        const itemId = opItemId(op);
        const name = this.byId(itemId)?.name;
        this.inFlight = itemId;
        this.echo = null;
        const result = await this.send(op);
        if (result.kind === 'retry') {
          this.retryTimer = setTimeout(() => void this.flush(), RETRY_MS);
          break;
        }
        // The op leaves the queue and its result enters the server state in the same step,
        // so the screen never shows the change twice or not at all.
        this.setOutbox(this.outbox().filter((o) => o.opId !== op.opId));
        this.writes++;
        if (result.kind === 'done' && result.row) {
          // Another member's change may have landed after ours: keep whichever is newer.
          const mine = toItem(result.row);
          this.upsertServer(this.echo && isNewer(this.echo, mine) ? this.echo : mine);
        }
        if (result.kind === 'done' && op.kind === 'delete') {
          this.setServer(this.server().filter((it) => it.id !== itemId));
        }
        if (result.kind === 'gone') {
          this.setServer(this.server().filter((it) => it.id !== itemId));
          if (name) this.toast.show(`${name} ya no está: lo borró otro miembro.`);
        }
        if (result.kind === 'rejected') {
          this.toast.show(`No se pudo guardar el cambio${name ? ` en ${name}` : ''}.`);
          refetch = true;
        }
      }
    } finally {
      this.inFlight = null;
      this.echo = null;
      this.flushing = false;
    }
    if (refetch || this.fetchAfterFlush) {
      this.fetchAfterFlush = false;
      await this.fetchItems();
    }
  }

  private async send(op: ItemOp): Promise<SendResult> {
    switch (op.kind) {
      case 'create': {
        const { id, categoryId, name, unit, monthlyUsage, currentQty } = op.item;
        const { data, error } = await this.supabase
          .from('items')
          .insert({
            id,
            household_id: this.householdId()!,
            category_id: categoryId,
            name,
            unit,
            monthly_usage: monthlyUsage,
            current_qty: currentQty,
          })
          .select()
          .single();
        // Already there: an earlier attempt went through but its response got lost.
        if (error?.code === '23505') return { kind: 'done' };
        return error ? failure(error) : { kind: 'done', row: data };
      }
      case 'update': {
        const { categoryId, name, unit, monthlyUsage, currentQty } = op.changes;
        const { data, error } = await this.supabase
          .from('items')
          .update({
            category_id: categoryId,
            name,
            unit,
            monthly_usage: monthlyUsage,
            current_qty: currentQty,
          })
          .eq('id', op.itemId)
          .select()
          .maybeSingle();
        if (error) return failure(error);
        return data ? { kind: 'done', row: data } : { kind: 'gone' };
      }
      case 'adjust':
      case 'restock': {
        const { data, error } =
          op.kind === 'adjust'
            ? await this.supabase.rpc('adjust_qty', {
                p_item_id: op.itemId,
                p_delta: op.delta,
                p_change_id: op.opId,
              })
            : await this.supabase.rpc('restock', { p_item_id: op.itemId, p_change_id: op.opId });
        if (error) return failure(error);
        return { kind: 'done', row: data as ItemRow };
      }
      case 'delete': {
        const { error } = await this.supabase.from('items').delete().eq('id', op.itemId);
        return error ? failure(error) : { kind: 'done' };
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // State helpers: every write also updates the copy kept on the device.
  // -------------------------------------------------------------------------------------------

  private setServer(items: Item[]): void {
    const before = this.server();
    this.server.set(items.slice().sort(byCreation));
    const id = this.householdId();
    if (id) this.cache.write(itemsKey(id), this.server());
    this.dropOrphanedChanges(before);
  }

  /**
   * Someone else deleted an item this device still has changes queued for: those changes have
   * nowhere to go, so they are dropped and the person is told.
   */
  private dropOrphanedChanges(before: readonly Item[]): void {
    const present = new Set(this.server().map((it) => it.id));
    const created = new Set(
      this.outbox().flatMap((op) => (op.kind === 'create' ? [op.item.id] : [])),
    );
    const orphans = before.filter(
      (it) =>
        !present.has(it.id) &&
        !created.has(it.id) &&
        it.id !== this.inFlight &&
        this.outbox().some((op) => opItemId(op) === it.id && op.kind !== 'delete'),
    );
    if (!orphans.length) return;
    const gone = new Set(orphans.map((it) => it.id));
    this.setOutbox(this.outbox().filter((op) => !gone.has(opItemId(op))));
    const names = orphans.map((it) => it.name).join(', ');
    this.toast.show(
      orphans.length === 1
        ? `${names} ya no está: lo borró otro miembro.`
        : `${names} ya no están: los borró otro miembro.`,
    );
  }

  /** Adds or replaces an item, unless what we already have is newer (events can arrive late). */
  private upsertServer(item: Item): void {
    const known = this.server().find((it) => it.id === item.id);
    if (known && isNewer(known, item)) return;
    this.setServer([...this.server().filter((it) => it.id !== item.id), item]);
  }

  private setOutbox(ops: ItemOp[]): void {
    this.outbox.set(ops);
    const id = this.householdId();
    if (id) this.cache.write(outboxKey(id), ops);
  }

  private stamp(): { opId: string; at: string } {
    this.clock.tick();
    return { opId: crypto.randomUUID(), at: new Date().toISOString() };
  }
}

/** Compares server timestamps to the microsecond (Postgres trims trailing zeros). */
function isNewer(a: Item, b: Item): boolean {
  return timestampKey(a.updatedAt) > timestampKey(b.updatedAt);
}

function timestampKey(ts: string): string {
  return ts.replace(
    /(T\d{2}:\d{2}:\d{2})(\.\d+)?/,
    (_, time: string, frac = '.') => time + frac.padEnd(7, '0'),
  );
}

function failure(error: { code?: string; message?: string }): SendResult {
  // P0002: the RPC didn't find the item. Other coded errors are refusals by the database (RLS,
  // constraints); no code at all means the request never got an answer.
  if (error.code === 'P0002') return { kind: 'gone' };
  if (
    !error.code ||
    error.code.startsWith('PGRST3') ||
    /fetch|network/i.test(error.message ?? '')
  ) {
    return { kind: 'retry' };
  }
  return { kind: 'rejected' };
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    householdId: row.household_id,
    categoryId: row.category_id,
    name: row.name,
    unit: row.unit,
    monthlyUsage: row.monthly_usage,
    currentQty: row.current_qty,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    pending: false,
  };
}

function cleanDraft(draft: ItemDraft): ItemDraft {
  return {
    name: draft.name.trim(),
    categoryId: draft.categoryId,
    unit: draft.unit.trim() || 'unidades',
    monthlyUsage: clampQty(draft.monthlyUsage),
    currentQty: clampQty(draft.currentQty),
  };
}

const itemsKey = (householdId: string) => `items.${householdId}`;
const categoriesKey = (householdId: string) => `categories.${householdId}`;
const outboxKey = (householdId: string) => `outbox.${householdId}`;
