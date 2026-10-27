import { Component, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Modal bottom sheet: backdrop tap or Escape closes it, content is projected.
 * Focus moves into the sheet when it opens.
 */
@Component({
  selector: 'app-bottom-sheet',
  host: {
    '(document:keydown.escape)': 'closed.emit()',
  },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label()"
      tabindex="-1"
    >
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      max-width: 480px;
      margin: 0 auto;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(41, 43, 49, 0.62);
      animation: fade-in 160ms ease-out;
    }
    .sheet {
      position: relative;
      max-height: 92dvh;
      overflow-y: auto;
      background: var(--color-surface);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      box-shadow: 0 -1px 0 #595d6c;
      padding: 18px var(--gutter) calc(24px + var(--safe-bottom));
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes sheet-in {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
  `,
})
export class BottomSheet {
  readonly label = input.required<string>();
  readonly closed = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('.sheet')?.focus());
  }
}
