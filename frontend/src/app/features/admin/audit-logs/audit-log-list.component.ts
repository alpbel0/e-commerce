import { Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import type { AuditLogResponse } from '../../../core/models/admin.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-admin-audit-log-list',
  standalone: true,
  imports: [FormsModule, RouterLink, SlicePipe, LoadingSpinnerComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './audit-log-list.component.html',
  styles: [
    `
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 20px; }

      .search-bar {
        display: flex;
        gap: 8px;
        align-items: center;
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 10px 14px;
        margin-bottom: 16px;
        box-shadow: var(--shadow-sm);
      }
      .search-bar svg { color: var(--text-muted); flex-shrink: 0; }
      .search-bar input {
        flex: 1;
        border: none; outline: none;
        font-size: 0.875rem;
        background: transparent;
        color: var(--text-primary);
      }
      .search-bar input::placeholder { color: var(--text-muted); }
      .btn-search {
        height: 32px; padding: 0 14px;
        border-radius: var(--radius-md);
        border: none; background: var(--clr-primary-600); color: #fff;
        font-size: 0.8rem; font-weight: 700; cursor: pointer;
        white-space: nowrap;
        transition: background var(--trans-fast);
      }
      .btn-search:hover { background: var(--clr-primary-700); }

      .table-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }

      .action-link { color: var(--clr-primary-600); text-decoration: none; font-weight: 600; font-family: monospace; font-size: .78rem; }
      .action-link:hover { text-decoration: underline; }

      .details { max-width: 320px; word-break: break-word; font-size: .75rem; color: var(--text-muted); }
    `
  ]
})
export class AdminAuditLogListComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<AuditLogResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  actionFilter = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin
      .listAuditLogs({
        page: this.page(),
        size: 20,
        action: this.actionFilter.trim() || undefined
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

  applyAction(): void {
    this.page.set(0);
    this.load();
  }

  onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  shortAt(value: string): string {
    return (value ?? '').replace('T', ' ').slice(0, 19);
  }
}
