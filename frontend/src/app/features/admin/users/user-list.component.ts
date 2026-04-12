import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/api/admin.service';
import type { RoleType } from '../../../core/models/common.models';
import type { AdminUserListResponse } from '../../../core/models/admin.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/notify/toast.service';

@Component({
  selector: 'app-admin-user-list',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './user-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
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
      button {
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        font-size: 0.75rem;
        margin-right: 4px;
      }
    `
  ]
})
export class AdminUserListComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<AdminUserListResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  q = '';
  roleFilter = '';
  activeFilter: 'all' | 'true' | 'false' = 'all';

  readonly roles: RoleType[] = ['INDIVIDUAL', 'CORPORATE', 'ADMIN'];

  ngOnInit(): void {
    this.load();
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

  toggleActive(u: AdminUserListResponse): void {
    this.admin.updateUserStatus(u.id, { active: !u.active }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((x) => (x.id === row.id ? row : x)));
        this.toast.showInfo('Kullanıcı güncellendi');
      },
      error: () => {}
    });
  }

  changeRole(u: AdminUserListResponse, ev: Event): void {
    const role = (ev.target as HTMLSelectElement).value as RoleType;
    if (role === u.activeRole) return;
    this.admin.updateUserRole(u.id, { role }).subscribe({
      next: (row) => {
        this.items.update((list) => list.map((x) => (x.id === row.id ? row : x)));
        this.toast.showInfo('Rol güncellendi');
      },
      error: () => {}
    });
  }
}
