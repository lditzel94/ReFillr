/**
 * Domain types. The shapes mirror the tables we plan to create in Supabase
 * (households, household_members, items) so the persistence layer can be
 * swapped without touching the UI.
 */

export const CATEGORIES = ['pantry', 'bathroom', 'cleaning'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  pantry: 'Despensa',
  bathroom: 'Baño',
  cleaning: 'Limpieza',
};

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

export interface Item {
  id: string;
  householdId: string;
  name: string;
  category: Category;
  unit: string;
  monthlyUsage: number;
  currentQty: number;
  updatedBy: string;
  updatedAt: string;
  /** True while a local change has not been acknowledged by the backend. */
  pending: boolean;
}

/** The editable part of an item, as used by the add/edit sheet. */
export interface ItemDraft {
  name: string;
  category: Category;
  unit: string;
  monthlyUsage: number;
  currentQty: number;
}
