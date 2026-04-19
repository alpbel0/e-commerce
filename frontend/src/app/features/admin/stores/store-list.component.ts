import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import { StoreService } from '../../../core/api/store.service';
import type { StoreSummaryResponse } from '../../../core/models/store.models';
import { ToastService } from '../../../core/notify/toast.service';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-admin-store-list',
  standalone: true,
  imports: [FormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, PaginationComponent],
  templateUrl: './store-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .filters {
        margin-bottom: 1rem;
      }
      .filters select {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
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
      select.sm {
        padding: 0.25rem 0.35rem;
        border-radius: 6px;
        font-size: 0.8rem;
      }
    `
  ]
})
export class AdminStoreListComponent implements OnInit {
  private readonly stores = inject(StoreService);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<StoreSummaryResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  statusFilter = '';

  readonly statusOptions = ['OPEN', 'CLOSED', 'SUSPENDED'] as const;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.stores
      .list({
        page: this.page(),
        size: 15,
        sort: 'name,asc',
        status: this.statusFilter || undefined
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

  onFilterChange(): void {
    this.page.set(0);
    this.load();
  }

  onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  changeStatus(store: StoreSummaryResponse, event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    if (status === store.status) return;
    this.admin.updateStoreStatus(store.id, { status }).subscribe({
      next: (detail) => {
        this.items.update((list) => list.map((item) => (item.id === detail.id ? { ...item, status: detail.status } : item)));
        this.toast.showInfo('Magaza durumu guncellendi');
      },
      error: () => {}
    });
  }
}
