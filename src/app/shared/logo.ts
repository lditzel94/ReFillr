import { Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="24" height="24" rx="7" stroke="currentColor" />
      <path
        d="M7 8h12M7 13h8M7 18h5"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      color: var(--color-accent);
    }
  `,
})
export class Logo {
  readonly size = input(26);
}
