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
      :host {
        display: block;
        max-width: 400px;
        margin: 0 auto;
      }
      .field {
        margin-bottom: 1rem;
      }
      label {
        display: block;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
      }
      input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        box-sizing: border-box;
      }
      button {
        width: 100%;
        padding: 0.6rem 1rem;
        border: none;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ok {
        color: #15803d;
        margin-top: 1rem;
      }
      .hint {
        margin-top: 1rem;
      }
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
