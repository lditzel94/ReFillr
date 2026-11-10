import { Injectable } from '@angular/core';

/**
 * Thin JSON wrapper over localStorage: the device's copy of what the backend last said (household,
 * items, categories) and the changes still waiting to be sent. It lets the app open and keep
 * working without signal; Supabase stays the source of truth.
 */
@Injectable({ providedIn: 'root' })
export class LocalStore {
  private readonly prefix = 'refillr.';

  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Storage full or blocked (private mode): the app keeps working in memory.
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      // ignore
    }
  }
}
