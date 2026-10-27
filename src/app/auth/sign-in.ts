import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthError, AuthService } from '../core/auth';
import { FieldError } from '../shared/field-error';

@Component({
  selector: 'app-sign-in',
  imports: [FormField, FormRoot, RouterLink, FieldError],
  styleUrl: './auth-screen.css',
  template: `
    <form [formRoot]="signInForm">
      <div>
        <h1 class="display">Ingresar</h1>
        <p class="lede muted">Tu cuenta, el stock compartido del hogar.</p>
      </div>

      <div class="fields">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            class="input"
            type="email"
            autocomplete="email"
            placeholder="sam@ejemplo.com"
            [formField]="signInForm.email"
          />
          <app-field-error [field]="signInForm.email" />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            class="input"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            [formField]="signInForm.password"
          />
          <app-field-error [field]="signInForm.password" />
        </div>
      </div>

      @for (error of signInForm().errors(); track $index) {
        <p class="form-error">{{ error.message }}</p>
      }

      <button
        type="submit"
        class="btn btn-primary btn-lg btn-block"
        [disabled]="signInForm().submitting()"
      >
        Ingresar
      </button>

      <div class="row">
        <a class="btn btn-ghost" routerLink="/registro">Crear una cuenta</a>
        <span class="muted">Olvidé mi contraseña</span>
      </div>

      <p class="footnote">
        La sesión queda abierta en este dispositivo. Más adelante se podrá sumar un desbloqueo con
        huella o Face ID: protege la app, no reemplaza la cuenta.
      </p>
    </form>
  `,
  styles: `
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .row .btn {
      font-size: 13px;
      text-decoration: none;
    }
  `,
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly model = signal({ email: '', password: '' });

  protected readonly signInForm = form(
    this.model,
    (p) => {
      required(p.email, { message: 'Ingresá tu email.' });
      email(p.email, { message: 'Ese email no parece válido.' });
      required(p.password, { message: 'Ingresá tu contraseña.' });
    },
    {
      submission: {
        action: async (f) => {
          const { email, password } = f().value();
          try {
            await this.auth.signIn(email, password);
          } catch (e) {
            if (e instanceof AuthError) return { kind: 'auth', message: e.message };
            throw e;
          }
          await this.router.navigateByUrl('/');
          return undefined;
        },
      },
    },
  );
}
