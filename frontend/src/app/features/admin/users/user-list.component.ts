import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminService } from '../../../core/api/admin.service';
import { StoreService } from '../../../core/api/store.service';
import { AuthStore } from '../../../core/auth/auth.store';
import type { AdminUserListResponse } from '../../../core/models/admin.models';
import type { RoleType } from '../../../core/models/common.models';
import type { StoreSummaryResponse } from '../../../core/models/store.models';
import { ToastService } from '../../../core/notify/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

const ADMIN_PASSWORD_PATTERN = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,64}$';

@Component({
  selector: 'app-admin-user-list',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    LoadingSpinnerComponent,
    ErrorStateComponent,
    PaginationComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './user-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 1rem;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 1rem;
        align-items: flex-end;
      }
      .filters label {
        display: flex;
        flex-direction: column;
        font-size: 0.75rem;
        color: #64748b;
        gap: 4px;
      }
      .filters input,
      .filters select {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        min-width: 140px;
      }
      .create {
        margin-bottom: 1.5rem;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        max-width: 520px;
      }
      .create .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }
      .create label {
        display: block;
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 4px;
      }
      .create input,
      .create select {
        width: 100%;
        padding: 0.35rem 0.45rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        box-sizing: border-box;
      }
      .create .check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .cell-actions {
        white-space: nowrap;
      }
      button {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        font-size: 0.75rem;
        margin-right: 4px;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      button.primary {
        border: none;
        background: #0f172a;
        color: #fff;
      }
      button.warn {
        border: none;
        background: #b91c1c;
        color: #fff;
      }
      .owned-stores {
        background: #f8fafc;
      }
      .owned-stores ul {
        margin: 8px 0 0;
        padding-left: 18px;
      }
    `
  ]
})
export class AdminUserListComponent implements OnInit {
  @ViewChild('createPanel') private readonly createPanel?: ElementRef<HTMLElement>;

  private readonly admin = inject(AdminService);
  private readonly stores = inject(StoreService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<AdminUserListResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly savingCreate = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleteTarget = signal<AdminUserListResponse | null>(null);
  readonly ownerStores = signal<Record<string, StoreSummaryResponse[]>>({});
  readonly storesLoadingByUser = signal<Record<string, boolean>>({});

  q = '';
  roleFilter = '';
  activeFilter: 'all' | 'true' | 'false' = 'all';

  readonly roles: RoleType[] = ['INDIVIDUAL', 'CORPORATE', 'ADMIN'];

  readonly createForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.pattern(ADMIN_PASSWORD_PATTERN)]],
    role: ['INDIVIDUAL' as RoleType, Validators.required],
    storeName: [''],
    active: [true]
  });

  ngOnInit(): void {
    this.auth.ensureProfileLoaded().subscribe({
      next: () => this.load(),
      error: () => this.load()
    });
  }

  scrollToCreate(): void {
    this.createPanel?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    const active = this.activeFilter === 'all' ? undefined : this.activeFilter === 'true';
    this.admin
      .listUsers({
        q: this.q.trim() || undefined,
        role: this.roleFilter ? (this.roleFilter as RoleType) : undefined,
        active,
        page: this.page(),
        size: 15
      })
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          this.items.set(response.items);
          this.totalPages.set(response.totalPages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
  }

  applyFilters(): void {
    this.page.set(0);
    this.load();
  }

  onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  isSelf(user: AdminUserListResponse): boolean {
    const id = this.auth.currentUser()?.id;
    return !!id && id === user.id;
  }

  toggleActive(user: AdminUserListResponse): void {
    if (this.isSelf(user)) return;
    this.admin.updateUserStatus(user.id, { active: !user.active }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((item) => (item.id === row.id ? row : item)));
        this.toast.showInfo('Kullanici guncellendi');
      },
      error: () => {}
    });
  }

  changeRole(user: AdminUserListResponse, role: RoleType): void {
    if (this.isSelf(user) || role === user.activeRole) return;
    this.admin.updateUserRole(user.id, { role }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((item) => (item.id === row.id ? row : item)));
        this.toast.showInfo('Rol guncellendi');
      },
      error: () => {}
    });
  }

  createUser(): void {
    const role = this.createForm.controls.role.value;
    if (role === 'CORPORATE' && !this.createForm.controls.storeName.value.trim()) {
      this.toast.showError('Kurumsal hesap icin magaza adi zorunlu.');
      this.createForm.controls.storeName.markAsTouched();
      return;
    }
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.savingCreate.set(true);
    this.admin.createUser({
      email: value.email.trim(),
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      password: value.password,
      role: value.role,
      active: value.active,
      ...(value.role === 'CORPORATE' ? { storeName: value.storeName.trim() } : {})
    }).subscribe({
      next: () => {
        this.savingCreate.set(false);
        this.createForm.reset({
          email: '',
          firstName: '',
          lastName: '',
          password: '',
          role: 'INDIVIDUAL' as RoleType,
          storeName: '',
          active: true
        });
        this.toast.showInfo('Kullanici olusturuldu');
        this.page.set(0);
        this.load();
      },
      error: () => {
        this.savingCreate.set(false);
        this.toast.showError('Kullanici olusturulamadi');
      }
    });
  }

  askDeactivate(user: AdminUserListResponse): void {
    this.deleteTarget.set(user);
    this.deleteOpen.set(true);
  }

  cancelDeactivate(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDeactivate(): void {
    const user = this.deleteTarget();
    if (!user) return;
    this.admin.deleteUser(user.id).subscribe({
      next: (response) => {
        this.cancelDeactivate();
        this.toast.showInfo(response.message || 'Hesap kapatildi');
        this.load();
      },
      error: () => this.cancelDeactivate()
    });
  }

  toggleOwnedStores(user: AdminUserListResponse): void {
    if (user.activeRole !== 'CORPORATE') {
      return;
    }
    const current = this.ownerStores();
    if (current[user.id]) {
      const next = { ...current };
      delete next[user.id];
      this.ownerStores.set(next);
      return;
    }

    this.storesLoadingByUser.set({ ...this.storesLoadingByUser(), [user.id]: true });
    this.stores.getStoresByOwner(user.id).subscribe({
      next: (response) => {
        this.ownerStores.set({ ...this.ownerStores(), [user.id]: response.items });
        const nextLoading = { ...this.storesLoadingByUser() };
        delete nextLoading[user.id];
        this.storesLoadingByUser.set(nextLoading);
      },
      error: () => {
        const nextLoading = { ...this.storesLoadingByUser() };
        delete nextLoading[user.id];
        this.storesLoadingByUser.set(nextLoading);
        this.toast.showError('Magazalar yuklenemedi');
      }
    });
  }
}
