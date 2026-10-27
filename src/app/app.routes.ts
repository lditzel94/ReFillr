import { Routes } from '@angular/router';
import { inHouseholdGuard, needsHouseholdGuard, signedOutGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  {
    path: '',
    loadComponent: () => import('./auth/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'ingresar',
        title: 'Ingresar · ReFillr',
        canActivate: [signedOutGuard],
        loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn),
      },
      {
        path: 'registro',
        title: 'Crear cuenta · ReFillr',
        canActivate: [signedOutGuard],
        loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp),
      },
      {
        path: 'hogar',
        title: 'Tu hogar · ReFillr',
        canActivate: [needsHouseholdGuard],
        loadComponent: () => import('./auth/household-setup').then((m) => m.HouseholdSetup),
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
