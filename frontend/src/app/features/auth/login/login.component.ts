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
      .actions {
        margin-top: 1.25rem;
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
      .links {
        margin-top: 1rem;
        font-size: 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .links a {
        color: #2563eb;
      }
      .ok-banner {
        color: #15803d;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .err {
        color: #b91c1c;
        font-size: 0.875rem;
        margin-top: 0.75rem;
      }
      .hint {
        font-size: 0.8rem;
        color: #64748b;
        margin-top: 0.25rem;
      }
    `
  ]
})
export class LoginComponent implements OnInit {
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
}
