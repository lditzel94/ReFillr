import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/toast-host';
import { UpdateBanner } from './shared/update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, UpdateBanner],
  template: `
    <div class="phone">
      <router-outlet />
      <app-toast-host />
      <app-update-banner />
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: radial-gradient(120% 80% at 20% 0%, #1c1f33 0%, var(--color-bg-deep) 60%);
    }
    /* Mobile-first: full screen on phones, a centered phone-width column elsewhere. */
    .phone {
      position: relative;
      min-height: 100dvh;
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
    }
    @media (min-width: 520px) {
      .phone {
        box-shadow:
          0 0 0 1px var(--color-neutral-800),
          0 24px 60px rgba(0, 0, 0, 0.5);
      }
    }
  `,
})
export class App {}
