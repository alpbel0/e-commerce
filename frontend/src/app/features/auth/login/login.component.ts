import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { homeCommandsForRole } from '../../../core/auth/home-navigation';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styles: [`
    :host { display: block; }

    .login-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .login-subtitle {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 28px;
    }

    /* Alert */
    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      margin-bottom: 20px;
    }
    .alert--success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .alert--error   { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

    /* Form */
    .login-form { display: flex; flex-direction: column; gap: 18px; }

    .demo-login {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--clr-primary-200);
      border-radius: var(--radius-md);
      background: var(--clr-primary-50);
      margin-bottom: 18px;
    }
    .demo-login__title {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--clr-primary-600);
      margin-bottom: 2px;
    }
    .demo-login__meta {
      font-size: 0.78rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }
    .demo-login__btn {
      flex-shrink: 0;
      border: none;
      border-radius: var(--radius-md);
      padding: 0.45rem 0.8rem;
      background: var(--clr-primary-600);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: background var(--trans-fast);
    }
    .demo-login__btn:hover {
      background: var(--clr-primary-700);
    }

    /* Field */
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field__label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .field__label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .field__link {
      font-size: 0.78rem;
      color: var(--clr-primary-600);
      font-weight: 500;
    }
    .field__link:hover { text-decoration: underline; }
    .field__input-wrap {
      position: relative;
    }
    .field__icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }
    .field__input-wrap input {
      padding-left: 38px;
      transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
    }
    .field__input--error {
      border-color: var(--clr-danger-500) !important;
      box-shadow: 0 0 0 3px rgba(239,68,68,.12) !important;
    }
    .field__error {
      font-size: 0.76rem;
      color: var(--clr-danger-500);
    }

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
      transition: background var(--trans-fast), transform var(--trans-fast), box-shadow var(--trans-fast);
      margin-top: 4px;
    }
    .submit-btn:hover:not(:disabled) {
      background: var(--clr-primary-700);
      box-shadow: 0 6px 18px rgba(2,132,199,.35);
      transform: translateY(-1px);
    }
    .submit-btn:active:not(:disabled) { transform: translateY(0); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .submit-btn__spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Footer */
    .login-footer {
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 24px;
    }
    .login-footer__link {
      color: var(--clr-primary-600);
      font-weight: 600;
    }
    .login-footer__link:hover { text-decoration: underline; }
  `]
})
export class LoginComponent implements OnInit {
  readonly adminDemoEmail = 'admin@local.test';
  readonly adminDemoPassword = 'Passw0rd!';

  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submitting = false;
  loginError = false;
  registeredOk = false;

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('registered') === '1') {
      this.registeredOk = true;
    }
  }

  submit(): void {
    this.loginError = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const { email, password } = this.form.getRawValue();
    this.authStore.login(email, password).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(homeCommandsForRole(this.authStore.activeRole()));
      },
      error: () => {
        this.submitting = false;
        this.loginError = true;
      }
    });
  }

  fillAdminDemo(): void {
    this.form.setValue({
      email: this.adminDemoEmail,
      password: this.adminDemoPassword
    });
    this.loginError = false;
  }
}
