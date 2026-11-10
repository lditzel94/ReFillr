import { Routes } from '@angular/router';
import { inHouseholdGuard, noHouseholdGuard, signedOutGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  {
    path: '',
    loadComponent: () => import('./auth/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'sign-in',
        title: 'Ingresar · ReFillr',
        canActivate: [signedOutGuard],
        loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn),
      },
      {
        path: 'forgot-password',
        title: 'Olvidé mi contraseña · ReFillr',
        canActivate: [signedOutGuard],
        loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword),
      },
      {
        // Opened from the invite and recovery emails, signed in or not.
        path: 'set-password',
        title: 'Elegí tu contraseña · ReFillr',
        loadComponent: () => import('./auth/set-password').then((m) => m.SetPassword),
      },
      {
        path: 'no-household',
        title: 'Tu hogar · ReFillr',
        canActivate: [noHouseholdGuard],
        loadComponent: () => import('./auth/no-household').then((m) => m.NoHousehold),
      },
    ],
  },
  {
    path: 'stock',
    title: 'ReFillr',
    canActivate: [inHouseholdGuard],
    loadComponent: () => import('./stock/stock-page').then((m) => m.StockPage),
  },
  { path: '**', redirectTo: 'stock' },
];
