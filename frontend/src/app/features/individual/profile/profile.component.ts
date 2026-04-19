import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../../core/api/auth.service';
import { ProfileService } from '../../../core/api/profile.service';
import { ToastService } from '../../../core/notify/toast.service';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, ErrorStateComponent],
  templateUrl: './profile.component.html',
  styles: [
    `
      .page-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 24px; }

      .profile-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 28px;
        box-shadow: var(--shadow-sm);
        margin-bottom: 20px;
        max-width: 600px;
      }
      .card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-default);
      }
      .card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px; height: 40px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-md);
        color: var(--clr-primary-600);
        flex-shrink: 0;
      }
      .card-title { font-size: 1rem; font-weight: 700; margin: 0; }
      .card-subtitle { font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0; }

      .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 480px) { .field-grid { grid-template-columns: 1fr; } }

      .field { display: flex; flex-direction: column; gap: 5px; }
      .field-full { grid-column: 1 / -1; }
      label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
      input, textarea {
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      input:focus, textarea:focus {
        border-color: var(--clr-primary-500);
        box-shadow: 0 0 0 3px rgba(14,165,233,.15);
      }
      textarea { min-height: 80px; resize: vertical; }

      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0.6rem 1.4rem;
        border-radius: var(--radius-md);
        border: none;
        background: var(--clr-primary-600);
        color: #fff;
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        margin-top: 16px;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .save-btn:hover:not(:disabled) { background: var(--clr-primary-700); box-shadow: 0 4px 12px rgba(2,132,199,.3); }
      .save-btn:disabled { opacity: .55; cursor: not-allowed; }
      .save-btn.secondary { background: var(--clr-slate-700); }
      .save-btn.secondary:hover:not(:disabled) { background: var(--clr-slate-900); box-shadow: none; }

      .err { color: var(--clr-danger-500); font-size: 0.8rem; margin-top: 4px; }
    `
  ]
})
export class ProfileComponent implements OnInit {
  private readonly profileApi = inject(ProfileService);
  private readonly authApi = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  private static readonly pwdPattern =
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,64}$';

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly savingPw = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    address: [''],
    profileImageUrl: ['']
  });

  readonly passwordForm = this.fb.nonNullable.group({
    oldPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.pattern(ProfileComponent.pwdPattern)]],
    confirmPassword: ['', Validators.required]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.profileApi.getMe().subscribe({
      next: (p) => {
        this.loading.set(false);
        this.profileForm.patchValue({
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone ?? '',
          address: p.address ?? '',
          profileImageUrl: p.profileImageUrl ?? ''
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.profileForm.getRawValue();
    this.profileApi
      .patchMe({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        phone: v.phone.trim() || undefined,
        address: v.address.trim() || undefined,
        profileImageUrl: v.profileImageUrl.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.showInfo('Profil güncellendi');
        },
        error: () => this.saving.set(false)
      });
  }

  savePassword(): void {
    const v = this.passwordForm.getRawValue();
    if (v.newPassword !== v.confirmPassword) {
      this.toast.showError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPw.set(true);
    this.authApi
      .changePassword({
        currentPassword: v.oldPassword,
        newPassword: v.newPassword
      })
      .subscribe({
        next: () => {
          this.savingPw.set(false);
          this.passwordForm.reset();
          this.toast.showInfo('Şifre güncellendi');
        },
        error: () => this.savingPw.set(false)
      });
  }
}
