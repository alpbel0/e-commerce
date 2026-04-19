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
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 20px; }

      .toolbar {
        display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
        background: #fff; border: 1px solid var(--border-default);
        border-radius: var(--radius-lg); padding: 12px 16px;
        margin-bottom: 16px; box-shadow: var(--shadow-sm);
      }
      .toolbar label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
      .toolbar select {
        height: 34px; padding: 0 10px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md); font-size: 0.82rem; min-width: 130px;
      }

      .table-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }

      .store-link { color: var(--clr-primary-600); text-decoration: none; font-weight: 600; }
      .store-link:hover { text-decoration: underline; }

      .status-badge { display: inline-block; padding: 2px 10px; border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .s-OPEN      { background: #dcfce7; color: #166534; }
      .s-CLOSED    { background: #f1f5f9; color: #475569; }
      .s-SUSPENDED { background: #fee2e2; color: #991b1b; }

      select.sm {
        height: 30px; padding: 0 8px;
        border-radius: var(--radius-sm); border: 1.5px solid var(--border-default);
        background: #fff; font-size: 0.75rem; font-weight: 600;
        transition: border-color var(--trans-fast);
      }
      select.sm:focus { border-color: var(--clr-primary-500); outline: none; }
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
