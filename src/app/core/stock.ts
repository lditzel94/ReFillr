import { Category, CATEGORIES, Item } from './models';

/** Core rule of the app: how many units bring the item back to its monthly level. */
export function needToBuy(item: Pick<Item, 'monthlyUsage' | 'currentQty'>): number {
  return Math.max(0, (item.monthlyUsage || 0) - (item.currentQty || 0));
}

/** Items that need buying, largest shortfall first (ties keep their original order). */
export function toBuyList<T extends Pick<Item, 'monthlyUsage' | 'currentQty'>>(
  items: readonly T[],
): T[] {
  return items.filter((it) => needToBuy(it) > 0).sort((a, b) => needToBuy(b) - needToBuy(a));
}

/** Groups items by category in the fixed category order, dropping empty groups. */
export function groupByCategory<T extends Pick<Item, 'category'>>(
  items: readonly T[],
): { category: Category; items: T[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((it) => it.category === category),
  })).filter((g) => g.items.length > 0);
}

export const MAX_QTY = 999;

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.min(MAX_QTY, Math.max(0, Math.round(qty)));
}
