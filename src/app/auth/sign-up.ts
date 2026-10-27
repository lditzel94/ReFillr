import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, minLength, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthError, AuthService } from '../core/auth';
import { FieldError } from '../shared/field-error';

@Component({
  selector: 'app-sign-up',
  imports: [FormField, FormRoot, RouterLink, FieldError],
  styleUrl: './auth-screen.css',
  template: `
    <form [formRoot]="signUpForm">
      <div>
        <h1 class="display">Crear cuenta</h1>
        <p class="lede muted">Después te unís a un hogar o creás uno.</p>
      </div>

      <div class="fields">
        <div class="field">
          <label for="name">Nombre</label>
          <input
            id="name"
            class="input"
            autocomplete="given-name"
            placeholder="Sam"
            [formField]="signUpForm.displayName"
          />
          <app-field-error [field]="signUpForm.displayName" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            class="input"
            type="email"
            autocomplete="email"
            placeholder="sam@ejemplo.com"
            [formField]="signUpForm.email"
          />
          <app-field-error [field]="signUpForm.email" />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder="8 caracteres o más"
            [formField]="signUpForm.password"
          />
          <app-field-error [field]="signUpForm.password" />
        </div>
      </div>

      @for (error of signUpForm().errors(); track $index) {
        <p class="form-error">{{ error.message }}</p>
      }

      <button
        type="submit"
        class="btn btn-primary btn-lg btn-block"
        [disabled]="signUpForm().submitting()"
      >
        Continuar
      </button>
      <a class="btn btn-ghost back" routerLink="/ingresar">Ya tengo una cuenta</a>
    </form>
  `,
  styles: `
    .back {
      align-self: flex-start;
      font-size: 13px;
      text-decoration: none;
    }
  `,
})
export class SignUp {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly model = signal({ displayName: '', email: '', password: '' });

  protected readonly signUpForm = form(
    this.model,
    (p) => {
      required(p.displayName, { message: '¿Cómo te llamamos?' });
      required(p.email, { message: 'Ingresá tu email.' });
      email(p.email, { message: 'Ese email no parece válido.' });
      required(p.password, { message: 'Elegí una contraseña.' });
      minLength(p.password, 8, { message: 'Tiene que tener 8 caracteres o más.' });
    },
    {
      submission: {
        action: async (f) => {
          const { displayName, email, password } = f().value();
          try {
            await this.auth.signUp(displayName, email, password);
          } catch (e) {
            if (e instanceof AuthError) return { kind: 'auth', message: e.message };
            throw e;
          }
          await this.router.navigateByUrl('/hogar');
          return undefined;
        },
      },
    },
  );
}
