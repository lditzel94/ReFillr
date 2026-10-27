import { Injectable } from '@angular/core';

/**
 * Thin JSON wrapper over localStorage.
 *
 * This is the temporary persistence layer: everything lives on this device
 * until Supabase is wired in. Keeping every read/write behind this class
 * means the swap touches services, not components.
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
