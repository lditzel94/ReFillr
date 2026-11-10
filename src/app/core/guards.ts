import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { HouseholdService } from './household';

/**
 * Each guard sends the person to the one screen that matches their state. "Signed in" is a
 * signal read synchronously (the session is restored before the first navigation, see
 * app.config.ts); the household needs one fetch, so the household guards wait for it.
 */

/** Sign in and forgot password: only when signed out. */
export const signedOutGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.signedIn() ? inject(Router).createUrlTree(['/']) : true;
};

/** "No household yet": signed in, without a household. */
export const noHouseholdGuard: CanActivateFn = async () => {
  const router = inject(Router);
  if (!inject(AuthService).signedIn()) return router.createUrlTree(['/sign-in']);
  const households = inject(HouseholdService);
  await households.ensureLoaded();
  return households.current() ? router.createUrlTree(['/stock']) : true;
};

/** Stock list: signed in and in a household. */
export const inHouseholdGuard: CanActivateFn = async () => {
  const router = inject(Router);
  if (!inject(AuthService).signedIn()) return router.createUrlTree(['/sign-in']);
  const households = inject(HouseholdService);
  await households.ensureLoaded();
  return households.current() ? true : router.createUrlTree(['/no-household']);
};
