import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EmailOtpType,
  Session,
  isAuthApiError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';
import { User } from './models';
import { SUPABASE } from './supabase';

/** A failure worth showing to the person, already worded in Spanish. */
export class AuthError extends Error {}

/** The kinds of link the auth emails carry (see supabase/templates). */
export type AuthLinkType = Extract<EmailOtpType, 'invite' | 'recovery'>;

/**
 * Who is signed in, backed by Supabase Auth.
 *
 * `session` mirrors the client's own session through onAuthStateChange, so everything downstream
 * (guards, the household, the stock) reacts to signing in and out as signals.
 *
 * Note this is only "who is signed in". A future biometric unlock gates the app on top of an
 * existing session and belongs in a separate service.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);
  private readonly session = signal<Session | null>(null);

  /** Same value while the same person stays signed in, even as their token refreshes. */
  readonly user = computed<User | null>(
    () => {
      const user = this.session()?.user;
      if (!user) return null;
      const name = user.user_metadata?.['display_name'];
      return {
        id: user.id,
        email: user.email ?? '',
        displayName: typeof name === 'string' ? name : '',
      };
    },
    {
      equal: (a, b) =>
        a?.id === b?.id && a?.email === b?.email && a?.displayName === b?.displayName,
    },
  );
  readonly signedIn = computed(() => this.user() !== null);

  /** Reads the stored session before the first navigation, so guards can decide synchronously. */
  async init(): Promise<void> {
    await this.adoptDefaultLink();
    const { data } = await this.supabase.auth.getSession();
    this.session.set(data.session);
    this.supabase.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  /**
   * Supabase's own email templates (used if ours aren't applied) link to `/auth/v1/verify`, which
   * lands on the site with the session in the URL hash: `#access_token=…&refresh_token=…&type=…`.
   * Take that session and continue on /set-password as if our own link had been used. Runs before
   * the first navigation, so the router only ever sees the clean URL.
   */
  private async adoptDefaultLink(): Promise<void> {
    if (typeof location === 'undefined' || !location.hash.includes('type=')) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const type = params.get('type');
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (type !== 'invite' && type !== 'recovery') return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (!access_token || !refresh_token) return;
    const { error } = await this.supabase.auth.setSession({ access_token, refresh_token });
    if (!error) history.replaceState(history.state, '', `/set-password?type=${type}`);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw toAuthError(error);
  }

  /** Signs out on this device only. Works without signal. */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut({ scope: 'local' });
  }

  /**
   * Sends the "Elegí una contraseña nueva" email. Says nothing about whether the email has an
   * account: only a missing connection or too many attempts are reported.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error && (isAuthRetryableFetchError(error) || isRateLimit(error))) {
      throw toAuthError(error);
    }
  }

  /** Signs in with the one-time token from an invite or recovery email. */
  async openLink(tokenHash: string, type: AuthLinkType): Promise<void> {
    const { error } = await this.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return;
    if (isAuthRetryableFetchError(error)) throw toAuthError(error);
    throw new AuthError('El link venció o ya se usó.');
  }

  /** Sets the signed-in person's password, and their name when given (first time, from an invite). */
  async setPassword(password: string, displayName?: string): Promise<void> {
    const name = displayName?.trim();
    const { data, error } = await this.supabase.auth.updateUser({
      password,
      ...(name ? { data: { display_name: name } } : {}),
    });
    if (error) throw toAuthError(error);
    if (name) {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({ display_name: name })
        .eq('user_id', data.user.id);
      if (profileError) throw new AuthError('No pudimos guardar tu nombre. Probá de nuevo.');
    }
  }
}

function isRateLimit(error: unknown): boolean {
  return isAuthApiError(error) && (error.status === 429 || /rate_limit/.test(error.code ?? ''));
}

function toAuthError(error: unknown): AuthError {
  if (isAuthRetryableFetchError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return new AuthError('No hay conexión. Probá de nuevo cuando vuelva la señal.');
  }
  if (isRateLimit(error)) {
    return new AuthError('Demasiados intentos. Esperá un minuto y probá de nuevo.');
  }
  if (isAuthApiError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return new AuthError('El email o la contraseña no coinciden.');
      case 'weak_password':
        return new AuthError('Elegí una contraseña de 8 caracteres o más.');
      case 'same_password':
        return new AuthError('Tiene que ser distinta de la que tenías.');
      case 'session_not_found':
      case 'session_expired':
        return new AuthError('El link venció. Pedí uno nuevo.');
    }
  }
  return new AuthError('Algo falló. Probá de nuevo.');
}
