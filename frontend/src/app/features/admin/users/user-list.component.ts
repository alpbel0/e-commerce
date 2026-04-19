import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminService } from '../../../core/api/admin.service';
import { AuthStore } from '../../../core/auth/auth.store';
import type { RoleType } from '../../../core/models/common.models';
import type { AdminUserListResponse } from '../../../core/models/admin.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/notify/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
    `
  ]
})
export class AdminUserListComponent implements OnInit {
  @ViewChild('createPanel') private readonly createPanel?: ElementRef<HTMLElement>;

  private readonly admin = inject(AdminService);
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
    const active =
      this.activeFilter === 'all' ? undefined : this.activeFilter === 'true' ? true : false;
    this.admin
      .listUsers({
        q: this.q.trim() || undefined,
        role: this.roleFilter ? (this.roleFilter as RoleType) : undefined,
        active,
        page: this.page(),
        size: 15
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.items.set(res.items);
          this.totalPages.set(res.totalPages);
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

  onPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  isSelf(u: AdminUserListResponse): boolean {
    const id = this.auth.currentUser()?.id;
    return !!id && id === u.id;
  }

  toggleActive(u: AdminUserListResponse): void {
    if (this.isSelf(u)) return;
    this.admin.updateUserStatus(u.id, { active: !u.active }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((x) => (x.id === row.id ? row : x)));
        this.toast.showInfo('Kullanıcı güncellendi');
      },
      error: () => {}
    });
  }

  changeRole(u: AdminUserListResponse, role: RoleType): void {
    if (this.isSelf(u) || role === u.activeRole) return;
    this.admin.updateUserRole(u.id, { role }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((x) => (x.id === row.id ? row : x)));
        this.toast.showInfo('Rol güncellendi');
      },
      error: () => {}
    });
  }

  createUser(): void {
    const role = this.createForm.controls.role.value;
    if (role === 'CORPORATE') {
      const sn = this.createForm.controls.storeName.value.trim();
      if (!sn) {
        this.toast.showError('Kurumsal hesap için mağaza adı zorunlu.');
        this.createForm.controls.storeName.markAsTouched();
        return;
      }
    }
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const v = this.createForm.getRawValue();
    this.savingCreate.set(true);
    const body = {
      email: v.email.trim(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      password: v.password,
      role: v.role,
      active: v.active,
      ...(v.role === 'CORPORATE' ? { storeName: v.storeName.trim() } : {})
    };
    this.admin.createUser(body).subscribe({
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
        this.toast.showInfo('Kullanıcı oluşturuldu');
        this.page.set(0);
        this.load();
      },
      error: () => this.savingCreate.set(false)
    });
  }

  askDeactivate(u: AdminUserListResponse): void {
    this.deleteTarget.set(u);
    this.deleteOpen.set(true);
  }

  cancelDeactivate(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDeactivate(): void {
    const u = this.deleteTarget();
    if (!u) return;
    this.admin.deleteUser(u.id).subscribe({
      next: (res) => {
        this.cancelDeactivate();
        this.toast.showInfo(res.message || 'Hesap kapatıldı');
        this.load();
      },
      error: () => this.cancelDeactivate()
    });
  }
}
