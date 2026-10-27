import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="region" role="status" aria-live="polite">
      @if (toasts.current(); as toast) {
        <!-- track by id so a replacing toast replays the entry animation -->
        @for (t of [toast]; track t.id) {
          <div class="toast">
            <span class="text">{{ t.text }}</span>
            @if (t.undo) {
              <button type="button" class="btn btn-ghost" (click)="toasts.runUndo()">
                Deshacer
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .region {
      position: fixed;
      left: 50%;
      bottom: calc(96px + var(--safe-bottom));
      width: min(480px, 100%);
      transform: translateX(-50%);
      padding: 0 14px;
      z-index: 20;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      box-shadow: var(--shadow-md);
      animation: toast-in 180ms ease-out;
    }
    .text {
      flex: 1;
      font-size: 13px;
      color: var(--color-neutral-200);
    }
    .btn {
      font-size: 13px;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
