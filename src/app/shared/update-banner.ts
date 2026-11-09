import { Component, inject, signal } from '@angular/core';
import { AppUpdate } from '../core/app-update';

/** Top banner offering to switch to a new deploy. Hidden until the service worker has one ready. */
@Component({
  selector: 'app-update-banner',
  template: `
    @if (update.ready()) {
      <div class="region" role="status">
        <div class="banner">
          <span class="text">Hay una versión nueva.</span>
          <button type="button" class="btn btn-ghost" (click)="update.dismiss()">Después</button>
          <button type="button" class="btn btn-primary" [disabled]="applying()" (click)="apply()">
            Actualizar
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .region {
      position: fixed;
      top: calc(10px + var(--safe-top));
      left: 50%;
      width: min(480px, 100%);
      transform: translateX(-50%);
      padding: 0 14px;
      z-index: 30;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 10px 9px 14px;
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-md);
      animation: banner-in 180ms ease-out;
    }
    .text {
      flex: 1;
      font-size: 13px;
      color: var(--color-neutral-200);
    }
    .btn {
      font-size: 13px;
    }
    @keyframes banner-in {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class UpdateBanner {
  protected readonly update = inject(AppUpdate);
  protected readonly applying = signal(false);

  protected apply(): void {
    this.applying.set(true);
    this.update.apply().catch(() => this.applying.set(false));
  }
}
