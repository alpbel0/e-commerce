import { Component, OnInit, inject, signal } from '@angular/core';
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
  imports: [FormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './audit-log-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .filters {
        margin-bottom: 1rem;
      }
      .filters input {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        margin-right: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
      }
      th,
      td {
        text-align: left;
        padding: 6px 4px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .details {
        max-width: 360px;
        word-break: break-word;
        color: #475569;
      }
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
