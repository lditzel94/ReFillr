import { Injectable, computed, inject, signal } from '@angular/core';
import { LocalStore } from './local-store';
import { User } from './models';

export class AuthError extends Error {}

/**
 * Account session.
 *
 * PLACEHOLDER: accounts live in localStorage and passwords are not checked.
 * This keeps the screens and guards real while Supabase Auth is pending;
 * the public surface (user signal + signIn/signUp/signOut) is what the
 * Supabase implementation will keep.
 *
 * Note this is only "who is signed in". A future biometric unlock gates the
 * app on top of an existing session and belongs in a separate service.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly store = inject(LocalStore);

  private readonly users = signal<User[]>(this.store.read<User[]>('users', []));
  private readonly sessionUserId = signal<string | null>(
    this.store.read<string | null>('session', null),
  );

  readonly user = computed(() => this.users().find((u) => u.id === this.sessionUserId()) ?? null);
  readonly signedIn = computed(() => this.user() !== null);

  userById(id: string): User | undefined {
    return this.users().find((u) => u.id === id);
  }

  async signIn(email: string, _password: string): Promise<User> {
    const user = this.users().find((u) => u.email === normalizeEmail(email));
    if (!user) throw new AuthError('No encontramos una cuenta con ese email en este dispositivo.');
    this.setSession(user.id);
    return user;
  }

  async signUp(displayName: string, email: string, _password: string): Promise<User> {
    const normalized = normalizeEmail(email);
    if (this.users().some((u) => u.email === normalized)) {
      throw new AuthError('Ya existe una cuenta con ese email.');
    }
    const user: User = {
      id: crypto.randomUUID(),
      email: normalized,
      displayName: displayName.trim(),
    };
    this.users.update((list) => [...list, user]);
    this.store.write('users', this.users());
    this.setSession(user.id);
    return user;
  }

  signOut(): void {
    this.setSession(null);
  }

  private setSession(id: string | null): void {
    this.sessionUserId.set(id);
    this.store.write('session', id);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
