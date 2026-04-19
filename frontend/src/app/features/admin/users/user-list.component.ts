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
      /* Header */
      .page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }
      .btn-new {
        display: inline-flex; align-items: center; gap: 7px;
        height: 38px; padding: 0 16px;
        background: var(--clr-primary-600); color: #fff;
        border: none; border-radius: var(--radius-md);
        font-size: 0.82rem; font-weight: 700; cursor: pointer;
        transition: background var(--trans-fast);
      }
      .btn-new:hover { background: var(--clr-primary-700); }

      /* Create panel */
      .create {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        margin-bottom: 20px;
        max-width: 640px;
      }
      .create__header {
        padding: 14px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
        display: flex; align-items: center; gap: 10px;
        font-size: 0.9rem; font-weight: 700;
      }
      .create__icon { width: 30px; height: 30px; background: var(--clr-primary-50); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--clr-primary-600); }
      .create__body { padding: 20px; }
      .create .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
      @media (max-width: 480px) { .create .row { grid-template-columns: 1fr; } }
      .create .field { display: flex; flex-direction: column; gap: 4px; }
      .create label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }
      .create input, .create select {
        height: 36px; padding: 0 10px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md); font-size: 0.82rem;
        transition: border-color var(--trans-fast);
      }
      .create input:focus, .create select:focus { border-color: var(--clr-primary-500); outline: none; box-shadow: 0 0 0 3px rgba(14,165,233,.12); }
      .create .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-size: 0.82rem; color: var(--text-secondary); }
      .create .check input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--clr-primary-600); }

      /* Toolbar */
      .toolbar {
        display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
        background: #fff; border: 1px solid var(--border-default);
        border-radius: var(--radius-lg); padding: 12px 16px;
        margin-bottom: 16px; box-shadow: var(--shadow-sm);
        justify-content: space-between;
      }
      .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .filters label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
      .filters input, .filters select {
        height: 34px; padding: 0 10px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md); font-size: 0.82rem; min-width: 130px;
      }
      .btn-filter {
        height: 34px; padding: 0 14px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md); background: var(--clr-primary-600); color: #fff;
        font-size: 0.8rem; font-weight: 700; cursor: pointer;
        transition: background var(--trans-fast);
      }
      .btn-filter:hover { background: var(--clr-primary-700); }

      /* Table */
      .table-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }

      .cell-actions { white-space: nowrap; }
      .btn-action {
        display: inline-flex; align-items: center; gap: 4px;
        height: 28px; padding: 0 10px;
        border-radius: var(--radius-sm); border: 1.5px solid var(--border-default);
        background: #fff; font-size: 0.73rem; font-weight: 600;
        color: var(--text-secondary); cursor: pointer;
        transition: all var(--trans-fast); margin-right: 4px;
        margin-bottom: 2px; white-space: nowrap;
      }
      .btn-action:hover { border-color: var(--clr-primary-200, #bae6fd); color: var(--clr-primary-600); background: var(--clr-primary-50); }
      .btn-action:disabled { opacity: .4; cursor: not-allowed; }
      .btn-action--create {
        border: none; background: var(--clr-primary-600); color: #fff;
      }
      .btn-action--create:hover { background: var(--clr-primary-700); }
      .btn-action--danger { border-color: #fecaca; color: var(--clr-danger-600); }
      .btn-action--danger:hover { background: #fef2f2; border-color: #fca5a5; }
      .btn-action--stores { color: var(--clr-slate-700); }
      .btn-action--stores:hover { background: var(--clr-slate-50); }

      .role-select {
        height: 28px; padding: 0 6px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600;
        transition: border-color var(--trans-fast);
      }
      .role-select:not(:disabled):hover { border-color: var(--clr-primary-400, #38bdf8); }
      .role-select:disabled { opacity: .55; }

      .active-pill { display: inline-block; padding: 1px 8px; border-radius: var(--radius-full); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
      .active-pill--on  { background: #dcfce7; color: #166534; }
      .active-pill--off { background: #fee2e2; color: #991b1b; }

      .owned-stores td { background: var(--clr-slate-50); padding-left: 24px; }
      .owned-stores ul { margin: 6px 0 0; padding-left: 16px; font-size: 0.8rem; color: var(--text-secondary); }
      .owned-stores li { margin-bottom: 2px; }
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
