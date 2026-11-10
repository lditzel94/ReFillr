import { Component, inject, input, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, minLength, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthError, AuthLinkType, AuthService } from '../core/auth';
import { FieldError } from '../shared/field-error';

type Phase = 'checking' | 'form' | 'invalid';

/**
 * Where the invite and recovery emails land: `/set-password?token_hash=…&type=invite|recovery`.
 *
 * The one-time token signs the person in, and is then dropped from the address bar so a reload
 * or a shared screenshot can't replay it. An invite also asks for the name the other members see.
 */
@Component({
  selector: 'app-set-password',
  imports: [FormField, FormRoot, RouterLink, FieldError],
  styleUrl: './auth-screen.css',
  template: `
    @switch (phase()) {
      @case ('checking') {
        <p class="muted" role="status">Abriendo el link…</p>
      }
      @case ('invalid') {
        <div class="stack">
          <div>
            <h1 class="display">El link no sirve</h1>
            <p class="lede muted">{{ problem() }}</p>
          </div>
          <a class="btn btn-primary btn-lg btn-block" routerLink="/forgot-password">
            Pedir un link nuevo
          </a>
          <p class="muted note">
            Si era una invitación, pedile al administrador que te la mande de nuevo.
          </p>
        </div>
      }
      @case ('form') {
        <form [formRoot]="passwordForm">
          <div>
            @if (isInvite()) {
              <h1 class="display">Te damos la bienvenida</h1>
              <p class="lede muted">Contanos cómo te llamás y elegí tu contraseña.</p>
            } @else {
              <h1 class="display">Contraseña nueva</h1>
              <p class="lede muted">Elegí una contraseña para tu cuenta.</p>
            }
          </div>

          <div class="fields">
            @if (isInvite()) {
              <div class="field">
                <label for="name">¿Cómo te llamás?</label>
                <input
                  id="name"
                  class="input"
                  autocomplete="given-name"
                  placeholder="Sam"
                  [formField]="passwordForm.displayName"
                />
                <app-field-error [field]="passwordForm.displayName" />
              </div>
            }
            <div class="field">
              <label for="password">Contraseña</label>
              <input
                id="password"
                class="input"
                type="password"
                autocomplete="new-password"
                placeholder="8 caracteres o más"
                [formField]="passwordForm.password"
              />
              <app-field-error [field]="passwordForm.password" />
            </div>
          </div>

          @for (error of passwordForm().errors(); track $index) {
            <p class="form-error">{{ error.message }}</p>
          }

          <button
            type="submit"
            class="btn btn-primary btn-lg btn-block"
            [disabled]="passwordForm().submitting()"
          >
            {{ isInvite() ? 'Entrar' : 'Guardar' }}
          </button>
        </form>
      }
    }
  `,
  styles: `
    .note {
      margin: 0;
      font-size: 13px;
    }
  `,
})
export class SetPassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query parameters, bound by the router (withComponentInputBinding). */
  readonly tokenHash = input<string | undefined>(undefined, { alias: 'token_hash' });
  readonly type = input<string | undefined>();

  protected readonly phase = signal<Phase>('checking');
  protected readonly problem = signal('');
  protected readonly isInvite = signal(false);

  private readonly model = signal({ displayName: '', password: '' });

  protected readonly passwordForm = form(
    this.model,
    (p) => {
      required(p.displayName, { message: 'Contanos tu nombre.', when: () => this.isInvite() });
      required(p.password, { message: 'Elegí una contraseña.' });
      minLength(p.password, 8, { message: 'Tiene que tener 8 caracteres o más.' });
    },
    {
      submission: {
        action: async (f) => {
          const { displayName, password } = f().value();
          try {
            await this.auth.setPassword(password, this.isInvite() ? displayName : undefined);
          } catch (e) {
            if (e instanceof AuthError) return { kind: 'auth', message: e.message };
            throw e;
          }
          await this.router.navigateByUrl('/', { replaceUrl: true });
          return undefined;
        },
      },
    },
  );

  async ngOnInit(): Promise<void> {
    const tokenHash = this.tokenHash();
    const type = this.type();
    const linkType: AuthLinkType = type === 'invite' ? 'invite' : 'recovery';
    this.isInvite.set(linkType === 'invite');

    if (!tokenHash) {
      // Reloaded after the link was used: carry on if the link already signed the person in.
      if (this.auth.signedIn()) this.phase.set('form');
      else await this.router.navigateByUrl('/sign-in', { replaceUrl: true });
      return;
    }

    try {
      await this.auth.openLink(tokenHash, linkType);
    } catch (e) {
      this.problem.set(e instanceof AuthError ? e.message : 'Algo falló. Probá de nuevo.');
      this.phase.set('invalid');
      return;
    }
    await this.router.navigate([], { queryParams: { type: linkType }, replaceUrl: true });
    this.phase.set('form');
  }
}
