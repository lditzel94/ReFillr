import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { AuthError, AuthService } from '../core/auth';
import { FieldError } from '../shared/field-error';

@Component({
  selector: 'app-forgot-password',
  imports: [FormField, FormRoot, RouterLink, FieldError],
  styleUrl: './auth-screen.css',
  template: `
    @if (sentTo(); as address) {
      <div class="stack">
        <div>
          <h1 class="display">Revisá tu mail</h1>
          <p class="lede muted">
            Si {{ address }} tiene una cuenta, le llega un link para elegir una contraseña nueva.
            Mirá también en spam.
          </p>
        </div>
        <a class="btn btn-secondary btn-lg btn-block" routerLink="/sign-in">Volver a ingresar</a>
      </div>
    } @else {
      <form [formRoot]="resetForm">
        <div>
          <h1 class="display">Olvidé mi contraseña</h1>
          <p class="lede muted">Te mandamos un link para elegir una nueva.</p>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            class="input"
            type="email"
            autocomplete="email"
            placeholder="sam@ejemplo.com"
            [formField]="resetForm.email"
          />
          <app-field-error [field]="resetForm.email" />
        </div>

        @for (error of resetForm().errors(); track $index) {
          <p class="form-error">{{ error.message }}</p>
        }

        <button
          type="submit"
          class="btn btn-primary btn-lg btn-block"
          [disabled]="resetForm().submitting()"
        >
          Mandar el link
        </button>
        <a class="btn btn-ghost back" routerLink="/sign-in">Volver</a>
      </form>
    }
  `,
  styles: `
    .back {
      align-self: flex-start;
      font-size: 13px;
      text-decoration: none;
    }
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  private readonly model = signal({ email: '' });
  /** Set once the email went out; the reply is the same whether or not the account exists. */
  protected readonly sentTo = signal<string | null>(null);

  protected readonly resetForm = form(
    this.model,
    (p) => {
      required(p.email, { message: 'Ingresá tu email.' });
      email(p.email, { message: 'Ese email no parece válido.' });
    },
    {
      submission: {
        action: async (f) => {
          const address = f().value().email.trim();
          try {
            await this.auth.requestPasswordReset(address);
          } catch (e) {
            if (e instanceof AuthError) return { kind: 'auth', message: e.message };
            throw e;
          }
          this.sentTo.set(address);
          return undefined;
        },
      },
    },
  );
}
