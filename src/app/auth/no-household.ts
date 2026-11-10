import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth';
import { HouseholdService } from '../core/household';

/**
 * Signed in, but not a member of any household yet (or removed from one). Households are set up
 * by the admin; as soon as they add this person, Realtime brings the household and this screen
 * moves on to the stock by itself.
 */
@Component({
  selector: 'app-no-household',
  styleUrl: './auth-screen.css',
  template: `
    <div class="stack">
      <div>
        <h1 class="display">Todavía no estás en ningún hogar</h1>
        <p class="lede muted">
          Pedile al administrador que te sume. Cuando lo haga, esta pantalla cambia sola.
        </p>
      </div>
      @if (auth.user(); as user) {
        <p class="muted account">Entraste como {{ user.email }}</p>
      }
      <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="signOut()">
        Cerrar sesión
      </button>
    </div>
  `,
  styles: `
    .account {
      margin: 0;
      font-size: 13px;
    }
  `,
})
export class NoHousehold {
  protected readonly auth = inject(AuthService);
  private readonly households = inject(HouseholdService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.households.current()) void this.router.navigateByUrl('/stock', { replaceUrl: true });
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/sign-in', { replaceUrl: true });
  }
}
