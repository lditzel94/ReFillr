import { Injectable, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { AuthService } from './auth';
import { Clock } from './clock';
import { Connectivity } from './connectivity';
import { DEMO_ITEMS } from './demo-data';
import { HouseholdService } from './household';
import { LocalStore } from './local-store';
import { Item, ItemDraft } from './models';
import { clampQty, groupByCategory, needToBuy, toBuyList } from './stock';

/**
 * The household's stock, as signals.
 *
 * - `items` is a linkedSignal: it re-derives from storage whenever the
 *   current household changes, but stays locally writable in between.
 * - Everything the screen shows (to-buy list, groups, headline) is a
 *   `computed` of `items`, so there is no manual bookkeeping.
 * - An `effect` persists every change. When Supabase arrives, that effect
 *   becomes the write-through to the backend and realtime events feed `items`.
 */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);
  private readonly households = inject(HouseholdService);
  private readonly connectivity = inject(Connectivity);
  private readonly clock = inject(Clock);

  private readonly householdId = computed(() => this.households.current()?.id ?? null);

  readonly items = linkedSignal<string | null, Item[]>({
    source: this.householdId,
    computation: (id) => (id ? this.read(id) : []),
  });

  readonly toBuy = computed(() => toBuyList(this.items()));
  readonly groups = computed(() => groupByCategory(this.items()));
  readonly unitsShort = computed(() => this.toBuy().reduce((sum, it) => sum + needToBuy(it), 0));
  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    effect(() => {
      const id = this.householdId();
      const items = this.items();
      if (id) this.store.write(itemsKey(id), items);
    });

    // Coming back online "acknowledges" queued writes. With the local
    // backend that is all a sync is; Supabase will replace this with a flush.
    effect(() => {
      if (this.connectivity.online()) {
        untracked(() => {
          if (this.items().some((it) => it.pending)) {
            this.items.update((list) => list.map((it) => ({ ...it, pending: false })));
          }
        });
      }
    });
  }

  countFor(householdId: string): number {
    return this.read(householdId).length;
  }

  byId(id: string): Item | undefined {
    return this.items().find((it) => it.id === id);
  }

  adjust(id: string, delta: number): void {
    const item = this.byId(id);
    if (item) this.patch(id, { currentQty: clampQty(item.currentQty + delta) });
  }

  setQty(id: string, qty: number): void {
    this.patch(id, { currentQty: clampQty(qty) });
  }

  /** Marks an item as bought: back to its monthly level. Returns the previous quantity. */
  restock(id: string): number | undefined {
    const item = this.byId(id);
    if (!item) return undefined;
    this.patch(id, { currentQty: Math.max(item.currentQty, item.monthlyUsage) });
    return item.currentQty;
  }

  add(draft: ItemDraft): Item | undefined {
    const householdId = this.householdId();
    if (!householdId) return undefined;
    const item: Item = {
      id: crypto.randomUUID(),
      householdId,
      ...cleanDraft(draft),
      ...this.stamp(),
    };
    this.items.update((list) => [...list, item]);
    return item;
  }

  update(id: string, draft: ItemDraft): void {
    this.patch(id, cleanDraft(draft));
  }

  /** Removes an item and returns a function that puts it back where it was. */
  remove(id: string): (() => void) | undefined {
    const index = this.items().findIndex((it) => it.id === id);
    if (index < 0) return undefined;
    const removed = this.items()[index];
    this.items.update((list) => list.filter((it) => it.id !== id));
    return () =>
      this.items.update((list) => [...list.slice(0, index), removed, ...list.slice(index)]);
  }

  loadDemo(): void {
    const householdId = this.householdId();
    const user = this.auth.user();
    if (!householdId || !user) return;
    const now = Date.now();
    this.items.set(
      DEMO_ITEMS.map((d, i) => ({
        id: crypto.randomUUID(),
        householdId,
        ...d.draft,
        updatedBy: user.id,
        updatedAt: new Date(now - d.minutesAgo * 60_000 - i).toISOString(),
        pending: false,
      })),
    );
  }

  private patch(id: string, changes: Partial<Item>): void {
    const stamp = this.stamp();
    this.items.update((list) =>
      list.map((it) => (it.id === id ? { ...it, ...changes, ...stamp } : it)),
    );
  }

  private stamp(): Pick<Item, 'updatedBy' | 'updatedAt' | 'pending'> {
    this.clock.tick();
    return {
      updatedBy: this.auth.user()?.id ?? '',
      updatedAt: new Date().toISOString(),
      pending: !this.connectivity.online(),
    };
  }

  private read(householdId: string): Item[] {
    return this.store.read<Item[]>(itemsKey(householdId), []);
  }
}

function itemsKey(householdId: string): string {
  return `items.${householdId}`;
}

function cleanDraft(draft: ItemDraft): ItemDraft {
  return {
    name: draft.name.trim(),
    category: draft.category,
    unit: draft.unit.trim() || 'unidades',
    monthlyUsage: clampQty(draft.monthlyUsage),
    currentQty: clampQty(draft.currentQty),
  };
}
