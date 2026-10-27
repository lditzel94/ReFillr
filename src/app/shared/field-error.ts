import { Component, computed, input } from '@angular/core';

/** Structural slice of a signal-forms FieldState that this component needs. */
interface FieldLike {
  touched(): boolean;
  errors(): readonly { message?: string }[];
}

/** Shows a field's first validation message once the user has interacted with it. */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="field-error">{{ text }}</p>
    }
  `,
  styles: `
    p {
      margin: 5px 0 0;
    }
  `,
})
export class FieldError {
  readonly field = input.required<() => FieldLike>();

  protected readonly message = computed(() => {
    const state = this.field()();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  });
}
