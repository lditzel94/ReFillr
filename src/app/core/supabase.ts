import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../../environments/supabase';
import { Database } from './database.types';

export type Supabase = SupabaseClient<Database>;

/**
 * The one Supabase client of the app. Only `core/` services inject it, so components never talk
 * to the backend directly.
 *
 * The session is kept in localStorage, so the app opens signed in even without signal. Links in
 * auth emails are handled by the /set-password screen itself, not detected from the URL.
 */
export const SUPABASE = new InjectionToken<Supabase>('Supabase', {
  providedIn: 'root',
  factory: () =>
    createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'refillr.auth',
      },
    }),
});
