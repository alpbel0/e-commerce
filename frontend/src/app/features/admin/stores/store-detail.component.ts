import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import type { StoreDetailResponse } from '../../../core/models/store.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-store-detail',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <a routerLink="/admin/stores" style="display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none"><- Magazalara don</a>
    @if (loading()) {
      <app-loading-spinner />
    } @else if (error()) {
      <app-error-state message="Magaza detayi yuklenemedi." (retry)="load()" />
    } @else {
      @if (store(); as item) {
        <h2>{{ item.name }}</h2>
        <div class="grid">
          <div class="card"><strong>Durum</strong><div>{{ item.status }}</div></div>
          <div class="card"><strong>Iletisim</strong><div>{{ item.contactEmail }}</div></div>
          <div class="card"><strong>Telefon</strong><div>{{ item.contactPhone || '-' }}</div></div>
          <div class="card"><strong>Urun sayisi</strong><div>{{ item.productCount ?? '-' }}</div></div>
          <div class="card"><strong>Toplam satis</strong><div>{{ item.totalSales }}</div></div>
          <div class="card"><strong>Owner ID</strong><div>{{ item.ownerId }}</div></div>
        </div>
        @if (item.description) {
          <p><strong>Aciklama:</strong> {{ item.description }}</p>
        }
        @if (item.address) {
          <p><strong>Adres:</strong> {{ item.address }}</p>
        }
      }
    }
  `,
  styles: [`
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}
  `]
})
export class AdminStoreDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly admin = inject(AdminService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly store = signal<StoreDetailResponse | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.admin.getStore(id).subscribe({
      next: (store) => {
        this.loading.set(false);
        this.store.set(store);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
