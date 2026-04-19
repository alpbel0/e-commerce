import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/api/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styles: [
    `
      :host { display: block; }

      .fp-title {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 4px;
        letter-spacing: -.02em;
      }
      .fp-subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        margin-bottom: 28px;
        line-height: 1.6;
      }

      /* Field */
      .fp-form { display: flex; flex-direction: column; gap: 18px; }
      .field { display: flex; flex-direction: column; gap: 5px; }
      .field__label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
      .field__input-wrap { position: relative; }
      .field__icon {
        position: absolute;
        left: 12px; top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
      .field__input-wrap input { padding-left: 38px; }

      /* Submit */
      .submit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 0.7rem 1rem;
        border: none;
        border-radius: var(--radius-md);
        background: var(--clr-primary-600);
        color: #fff;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: background var(--trans-fast), box-shadow var(--trans-fast), transform var(--trans-fast);
      }
      .submit-btn:hover:not(:disabled) {
        background: var(--clr-primary-700);
        box-shadow: 0 6px 18px rgba(2,132,199,.35);
        transform: translateY(-1px);
      }
      .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
      .submit-btn__spinner {
        display: inline-block;
        width: 16px; height: 16px;
        border: 2px solid rgba(255,255,255,.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin .7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Success state */
      .success-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        padding: 32px 24px;
        background: var(--clr-primary-50);
        border: 1px solid var(--clr-primary-200);
        border-radius: var(--radius-xl);
      }
      .success-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px; height: 56px;
        background: var(--clr-primary-600);
        border-radius: var(--radius-full);
        color: #fff;
        box-shadow: 0 4px 16px rgba(2,132,199,.35);
      }
      .success-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--clr-primary-700);
      }
      .success-text {
        font-size: 0.875rem;
        color: var(--text-secondary);
        line-height: 1.6;
        max-width: 300px;
      }

      /* Footer */
      .fp-footer {
        text-align: center;
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 24px;
      }
      .fp-footer__link { color: var(--clr-primary-600); font-weight: 600; }
      .fp-footer__link:hover { text-decoration: underline; }
    `
  ]
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submitting = false;
  success = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.success = false;
    this.auth.forgotPassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting = false;
        this.success = true;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }
}
