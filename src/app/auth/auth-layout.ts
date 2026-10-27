import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, Logo],
  template: `
    <header class="brand">
      <app-logo />
      <span>ReFillr</span>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: calc(64px + var(--safe-top)) 26px calc(34px + var(--safe-bottom));
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 40px;
      font-size: 17px;
      font-weight: 500;
      letter-spacing: -0.01em;
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class AuthLayout {}
