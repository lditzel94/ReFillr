import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { HouseholdService } from './household';

/**
 * Route guards read signals synchronously: no observables, no subscriptions.
 * Each one sends the user to the single screen that matches their state.
 */

/** Sign-in / sign-up: only when signed out. */
export const signedOutGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.signedIn() ? inject(Router).createUrlTree(['/']) : true;
};

/** Household setup: signed in, without a household yet. */
export const needsHouseholdGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(AuthService).signedIn()) return router.createUrlTree(['/ingresar']);
  return inject(HouseholdService).current() ? router.createUrlTree(['/stock']) : true;
};

/** Stock list: signed in and in a household. */
export const inHouseholdGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(AuthService).signedIn()) return router.createUrlTree(['/ingresar']);
  return inject(HouseholdService).current() ? true : router.createUrlTree(['/hogar']);
};
