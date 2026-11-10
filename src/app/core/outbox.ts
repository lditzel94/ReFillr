import { Category, Item, ItemDraft } from './models';
import { clampQty } from './stock';

/**
 * A change to the stock made on this device and not yet confirmed by the backend.
 *
 * Every change goes through the outbox, online or not: it shows up on screen at once (applied on
 * top of the last known server state) and is sent in order when there is a connection. `opId`
 * identifies the change; quantity changes send it as `change_id`, so a retry after a dropped
 * response is applied only once.
 */
export type ItemOp =
  | { kind: 'create'; opId: string; at: string; item: ItemDraft & { id: string } }
  | { kind: 'update'; opId: string; at: string; itemId: string; changes: ItemDraft }
  | { kind: 'adjust'; opId: string; at: string; itemId: string; delta: number }
  | { kind: 'restock'; opId: string; at: string; itemId: string }
  | { kind: 'delete'; opId: string; at: string; itemId: string }
  | { kind: 'createCategory'; opId: string; at: string; categoryId: string; name: string }
  | { kind: 'renameCategory'; opId: string; at: string; categoryId: string; name: string }
  | { kind: 'deleteCategory'; opId: string; at: string; categoryId: string };

/** Category changes share the queue with item changes, so an item can use a category created offline. */
export type CategoryOp = Extract<ItemOp, { categoryId: string }>;

export function isCategoryOp(op: ItemOp): op is CategoryOp {
  return 'categoryId' in op;
}

/** The item or category an operation is about. */
export function opTargetId(op: ItemOp): string {
  if (isCategoryOp(op)) return op.categoryId;
  return op.kind === 'create' ? op.item.id : op.itemId;
}

/**
 * What the screen shows: the server's items with the pending operations applied in order.
 * Items touched by a pending operation are marked `pending` and attributed to `me`.
 */
export function applyOps(
  server: readonly Item[],
  ops: readonly ItemOp[],
  householdId: string,
  me: string | null,
): Item[] {
  let items = server.slice();
  for (const op of ops) {
    if (isCategoryOp(op)) continue;
    const id = opTargetId(op);
    const touched = { pending: true, updatedBy: me, updatedAt: op.at };
    switch (op.kind) {
      case 'create':
        if (!items.some((it) => it.id === id)) {
          items.push({ ...op.item, householdId, createdAt: op.at, ...touched });
        }
        break;
      case 'update':
        items = items.map((it) => (it.id === id ? { ...it, ...op.changes, ...touched } : it));
        break;
      case 'adjust':
        items = items.map((it) =>
          it.id === id ? { ...it, currentQty: clampQty(it.currentQty + op.delta), ...touched } : it,
        );
        break;
      case 'restock':
        items = items.map((it) =>
          it.id === id
            ? { ...it, currentQty: Math.max(it.currentQty, it.monthlyUsage), ...touched }
            : it,
        );
        break;
      case 'delete':
        items = items.filter((it) => it.id !== id);
        break;
    }
  }
  return items;
}

/** The categories to show: the server's, with the pending category changes applied in order. */
export function applyCategoryOps(server: readonly Category[], ops: readonly ItemOp[]): Category[] {
  let categories = server.slice();
  for (const op of ops) {
    if (!isCategoryOp(op)) continue;
    switch (op.kind) {
      case 'createCategory':
        if (!categories.some((c) => c.id === op.categoryId)) {
          categories.push({ id: op.categoryId, name: op.name, isBase: false });
        }
        break;
      case 'renameCategory':
        categories = categories.map((c) =>
          c.id === op.categoryId && !c.isBase ? { ...c, name: op.name } : c,
        );
        break;
      case 'deleteCategory':
        categories = categories.filter((c) => c.id !== op.categoryId || c.isBase);
        break;
    }
  }
  return categories;
}

/** Keeps the list in the order items were added. */
export function byCreation(a: Item, b: Item): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
