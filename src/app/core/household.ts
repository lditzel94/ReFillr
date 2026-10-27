import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { LocalStore } from './local-store';
import { Household } from './models';
import { generateInviteCode, normalizeInviteCode } from './stock';

/**
 * Households and membership. Items belong to a household, never to a user.
 *
 * PLACEHOLDER persistence (localStorage), so joining by code only finds
 * households created on this same device until Supabase lands.
 */
@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);

  private readonly households = signal<Household[]>(this.store.read<Household[]>('households', []));

  /** The signed-in user's household (first one they belong to). */
  readonly current = computed(() => {
    const user = this.auth.user();
    if (!user) return null;
    return this.households().find((h) => h.memberIds.includes(user.id)) ?? null;
  });

  readonly members = computed(() =>
    (this.current()?.memberIds ?? []).map((id) => this.auth.userById(id)).filter((u) => !!u),
  );

  findByCode(raw: string): Household | undefined {
    const code = normalizeInviteCode(raw);
    if (code.length !== 6) return undefined;
    return this.households().find((h) => h.inviteCode === code);
  }

  create(): Household {
    const user = this.requireUser();
    const now = new Date().toISOString();
    const household: Household = {
      id: crypto.randomUUID(),
      name: `Hogar de ${user.displayName}`,
      inviteCode: this.uniqueCode(),
      memberIds: [user.id],
      createdAt: now,
      cycleStart: now,
    };
    this.save([...this.households(), household]);
    return household;
  }

  join(raw: string): Household | undefined {
    const user = this.requireUser();
    const target = this.findByCode(raw);
    if (!target) return undefined;
    if (!target.memberIds.includes(user.id)) {
      this.patch(target.id, { memberIds: [...target.memberIds, user.id] });
    }
    return target;
  }

  startNewCycle(): void {
    const current = this.current();
    if (current) this.patch(current.id, { cycleStart: new Date().toISOString() });
  }

  private patch(id: string, changes: Partial<Household>): void {
    this.save(this.households().map((h) => (h.id === id ? { ...h, ...changes } : h)));
  }

  private save(list: Household[]): void {
    this.households.set(list);
    this.store.write('households', list);
  }

  private uniqueCode(): string {
    let code: string;
    do code = generateInviteCode();
    while (this.households().some((h) => h.inviteCode === code));
    return code;
  }

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('Not signed in');
    return user;
  }
}
