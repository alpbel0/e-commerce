import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import type { ApiErrorResponse, RoleType } from '../../../core/models/common.models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styles: [`
    :host { display: block; }

    .reg-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .reg-subtitle {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 28px;
    }

    /* Form */
    .reg-form { display: flex; flex-direction: column; gap: 16px; }

    /* Two-col row */
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* Field */
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field__label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
    .field__hint { font-size: 0.75rem; color: var(--text-muted); }
    .field__error { font-size: 0.76rem; color: var(--clr-danger-500); }
    .field__input--error {
      border-color: var(--clr-danger-500) !important;
      box-shadow: 0 0 0 3px rgba(239,68,68,.12) !important;
    }

    /* Role picker */
    .role-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .role-option {
      position: relative;
      cursor: pointer;
    }
    .role-option input[type="radio"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .role-option__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 10px;
      border: 1.5px solid var(--border-default);
      border-radius: var(--radius-lg);
      text-align: center;
      transition: border-color var(--trans-fast), background var(--trans-fast), box-shadow var(--trans-fast);
      color: var(--text-muted);
    }
    .role-option:hover .role-option__content {
      border-color: var(--clr-primary-300);
      background: var(--clr-primary-50);
      color: var(--clr-primary-600);
    }
    .role-option--selected .role-option__content {
      border-color: var(--clr-primary-500);
      background: var(--clr-primary-50);
      color: var(--clr-primary-600);
      box-shadow: 0 0 0 3px rgba(99,102,241,.12);
    }
    .role-option__label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .role-option__desc { font-size: 0.72rem; color: var(--text-muted); }

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
      box-shadow: 0 6px 18px rgba(79,70,229,.35);
      transform: translateY(-1px);
    }
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
    .reg-footer {
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 24px;
    }
    .reg-footer__link { color: var(--clr-primary-600); font-weight: 600; }
    .reg-footer__link:hover { text-decoration: underline; }
  `]
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  private static readonly pwdPattern =
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,64}$';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    password: [
      '',
      [Validators.required, Validators.pattern(RegisterComponent.pwdPattern)]
    ],
    role: this.fb.nonNullable.control<RoleType>('INDIVIDUAL', Validators.required),
    storeName: ['']
  });

  submitting = false;

  ngOnInit(): void {
    this.syncStoreNameValidators(this.form.controls.role.value);
    this.form.controls.role.valueChanges.subscribe((r) => this.syncStoreNameValidators(r));
  }

  private syncStoreNameValidators(role: RoleType): void {
    const c = this.form.controls.storeName;
    if (role === 'CORPORATE') {
      c.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(255)]);
    } else {
      c.clearValidators();
      c.setValue('');
    }
    c.updateValueAndValidity();
  }

  showStoreName(): boolean {
    return this.form.controls.role.value === 'CORPORATE';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body =
      v.role === 'CORPORATE'
        ? {
            email: v.email,
            firstName: v.firstName,
            lastName: v.lastName,
            password: v.password,
            role: v.role,
            storeName: v.storeName
          }
        : {
            email: v.email,
            firstName: v.firstName,
            lastName: v.lastName,
            password: v.password,
            role: v.role
          };

    this.clearServerErrors();
    this.submitting = true;
    this.authStore.register(body).subscribe({
      next: () => {
        this.submitting = false;
        void this.router.navigate(['/auth/login'], {
          queryParams: { registered: '1' }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting = false;
        if (err.status === 400) {
          this.applyFieldErrors(err);
        }
      }
    });
  }

  private clearServerErrors(): void {
    for (const k of Object.keys(this.form.controls)) {
      const c = this.form.get(k);
      if (c?.errors?.['server']) {
        const { server: _s, ...rest } = c.errors;
        c.setErrors(Object.keys(rest).length ? rest : null);
      }
    }
  }

  private applyFieldErrors(err: HttpErrorResponse): void {
    const body = err.error as ApiErrorResponse | undefined;
    const list = body?.fieldErrors;
    if (!list?.length) {
      return;
    }
    for (const fe of list) {
      const c = this.form.get(fe.field);
      if (c) {
        c.setErrors({ ...(c.errors ?? {}), server: fe.message });
      }
    }
  }
}
