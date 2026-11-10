/** Domain types. Terms follow GLOSSARY.md; the shapes mirror the Supabase tables. */

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Household {
  id: string;
  name: string;
  /** Start of the current shopping cycle (ISO date). Only a visual marker. */
  cycleStart: string;
}

/** A person in the household, as the other members see them. */
export interface Member {
  id: string;
  email: string;
  displayName: string;
  /** The admin can't be removed from a household by other members. */
  isAdmin: boolean;
}

/** A household's category: the three base ones, then the household's own in creation order. */
export interface Category {
  id: string;
  name: string;
  /** Despensa, Baño and Limpieza: every household has them and they can't be changed. */
  isBase: boolean;
}

export interface Item {
  id: string;
  householdId: string;
  categoryId: string;
  name: string;
  unit: string;
  monthlyUsage: number;
  currentQty: number;
  /** Who changed it last; null once that account is deleted. */
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
  /** True while a change made on this device has not reached the backend. */
  pending: boolean;
}

/** The editable part of an item, as used by the add/edit sheet. */
export interface ItemDraft {
  name: string;
  categoryId: string;
  unit: string;
  monthlyUsage: number;
  currentQty: number;
}
