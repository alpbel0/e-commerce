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
      h2 {
        margin: 0 0 1rem;
      }
      section {
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #e2e8f0;
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1.05rem;
      }
      .field {
        margin-bottom: 12px;
        max-width: 420px;
      }
      label {
        display: block;
        font-size: 0.8rem;
        color: #475569;
        margin-bottom: 4px;
      }
      input,
      textarea {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      textarea {
        min-height: 72px;
        resize: vertical;
      }
      button {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: none;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
        margin-top: 4px;
      }
      button.secondary {
        background: #334155;
      }
      .err {
        color: #b91c1c;
        font-size: 0.85rem;
        margin-top: 6px;
      }
      .meta {
        font-size: 0.85rem;
        color: #64748b;
        margin-bottom: 8px;
      }
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
