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
  styles: [
    `
      :host {
        display: block;
        max-width: 440px;
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
      input,
      select {
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
        margin-top: 0.5rem;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .err {
        color: #b91c1c;
        font-size: 0.8rem;
        margin-top: 0.25rem;
      }
      .hint {
        font-size: 0.8rem;
        color: #64748b;
        margin-top: 0.25rem;
      }
    `
  ]
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
