import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth';
import { Connectivity } from './connectivity';
import { LocalStore } from './local-store';
import { Household, Member } from './models';
import { SUPABASE } from './supabase';

/** A failure worth showing to the person, already worded in Spanish. */
export class HouseholdError extends Error {}

interface Snapshot {
  household: Household | null;
  members: Member[];
}

/**
 * The signed-in person's household and its members, from Supabase.
 *
 * Households and members are set up by the admin with SQL scripts (supabase/scripts); from the
 * app a member can only remove someone else, leave, or start a new cycle. Membership changes made
 * anywhere arrive over Realtime, so being added or removed shows up without reloading.
 *
 * The last snapshot is kept on the device, so the app still opens without signal.
 */
@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly supabase = inject(SUPABASE);
  private readonly auth = inject(AuthService);
  private readonly cache = inject(LocalStore);
  private readonly connectivity = inject(Connectivity);

  private readonly _current = signal<Household | null>(null);
  private readonly _members = signal<Member[]>([]);
  /** False until the first load for the signed-in person finishes (from the network or cache). */
  private readonly _loaded = signal(false);

  readonly current = this._current.asReadonly();
  readonly members = this._members.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Only the id: a name change must not reload the household or reopen the channel. */
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  private loadingFor: string | null = null;
  private loading: Promise<void> = Promise.resolve();
  private channel: RealtimeChannel | null = null;

  constructor() {
    // Follow the signed-in person: load their household, listen for changes, clear on sign-out.
    effect(() => {
      const userId = this.userId();
      untracked(() => {
        if (userId) {
          void this.ensureLoaded();
          this.listen(userId);
        } else {
          this.reset();
        }
      });
    });

    // Changes made while offline were missed by Realtime: fetch again on reconnect.
    effect(() => {
      if (this.connectivity.online()) untracked(() => void this.refresh());
    });
  }

  /** Resolves once the household of whoever is signed in now has been loaded. */
  ensureLoaded(): Promise<void> {
    const userId = this.userId();
    if (userId !== this.loadingFor) {
      this.loadingFor = userId;
      this._loaded.set(false);
      this.loading = userId ? this.load(userId) : Promise.resolve();
    }
    return this.loading;
  }

  /** Fetches again, keeping what is shown until the new data arrives. */
  async refresh(): Promise<void> {
    const userId = this.userId();
    if (userId && userId === this.loadingFor) {
      this.loading = this.load(userId);
      await this.loading;
    }
  }

  memberName(id: string | null): string | undefined {
    return this._members().find((m) => m.id === id)?.displayName || undefined;
  }

  /** "Sacar": removes someone else from this household. The database refuses the admin. */
  async remove(memberId: string): Promise<void> {
    const { error } = await this.supabase.rpc('remove_member', { p_user_id: memberId });
    if (error) throw toHouseholdError(error);
    await this.refresh();
  }

  /** Leaves the household. If nobody is left, the household is deleted with its stock. */
  async leave(): Promise<void> {
    const { error } = await this.supabase.rpc('leave_household');
    if (error) throw toHouseholdError(error);
    await this.refresh();
  }

  async startNewCycle(): Promise<void> {
    const household = this._current();
    if (!household) return;
    const cycleStart = new Date().toISOString();
    const { error } = await this.supabase
      .from('households')
      .update({ cycle_start: cycleStart })
      .eq('id', household.id);
    if (error) throw toHouseholdError(error);
    this.apply(this.auth.user()?.id ?? '', {
      household: { ...household, cycleStart },
      members: this._members(),
    });
  }

  private async load(userId: string): Promise<void> {
    try {
      const snapshot = await this.fetch(userId);
      if (userId !== this.loadingFor) return; // signed out or switched account meanwhile
      this.apply(userId, snapshot);
    } catch {
      if (userId !== this.loadingFor) return;
      // Offline or the backend is unreachable: show what we last knew.
      if (!this._loaded()) {
        const cached = this.cache.read<Snapshot | null>(cacheKey(userId), null);
        this._current.set(cached?.household ?? null);
        this._members.set(cached?.members ?? []);
      }
    } finally {
      if (userId === this.loadingFor) this._loaded.set(true);
    }
  }

  private async fetch(userId: string): Promise<Snapshot> {
    // RLS narrows each of these to the caller's own household.
    const [members, profiles, admins] = await Promise.all([
      this.supabase.from('household_members').select('user_id, household_id, joined_at'),
      this.supabase.from('profiles').select('user_id, email, display_name'),
      this.supabase.from('app_admins').select('user_id'),
    ]);
    for (const result of [members, profiles, admins]) if (result.error) throw result.error;

    const mine = members.data!.find((m) => m.user_id === userId);
    if (!mine) return { household: null, members: [] };

    const { data: row, error } = await this.supabase
      .from('households')
      .select('id, name, cycle_start')
      .eq('id', mine.household_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { household: null, members: [] };

    const adminIds = new Set(admins.data!.map((a) => a.user_id));
    const byId = new Map(profiles.data!.map((p) => [p.user_id, p]));
    return {
      household: { id: row.id, name: row.name, cycleStart: row.cycle_start },
      members: members
        .data!.filter((m) => m.household_id === row.id)
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
        .map((m) => ({
          id: m.user_id,
          email: byId.get(m.user_id)?.email ?? '',
          displayName: byId.get(m.user_id)?.display_name ?? '',
          isAdmin: adminIds.has(m.user_id),
        })),
    };
  }

  private apply(userId: string, snapshot: Snapshot): void {
    this._current.set(snapshot.household);
    this._members.set(snapshot.members);
    this.cache.write(cacheKey(userId), snapshot);
  }

  /** Any change to memberships, households or names the person can see triggers a fetch. */
  private listen(userId: string): void {
    if (this.channel) void this.supabase.removeChannel(this.channel);
    const refresh = () => void this.refresh();
    this.channel = this.supabase
      .channel(`household:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households' }, refresh)
      // Also on (re)subscribing: covers whatever changed before the channel was listening.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });
  }

  private reset(): void {
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    this.loadingFor = null;
    this.loading = Promise.resolve();
    this._current.set(null);
    this._members.set([]);
    this._loaded.set(false);
  }
}

function cacheKey(userId: string): string {
  return `household.${userId}`;
}

function toHouseholdError(error: { code?: string; message?: string }): HouseholdError {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return new HouseholdError('Necesitás conexión para hacer esto.');
  }
  if (error.message?.includes('admin')) {
    return new HouseholdError('Al administrador no se lo puede sacar del hogar.');
  }
  return new HouseholdError('Algo falló. Probá de nuevo.');
}
