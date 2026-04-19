import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CategoryService } from '../../../core/api/category.service';
import type { CategoryResponse } from '../../../core/models/category.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-category-detail',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <a routerLink="/admin/categories" style="display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none"><- Kategorilere don</a>
    @if (loading()) {
      <app-loading-spinner />
    } @else if (error()) {
      <app-error-state message="Kategori detayi yuklenemedi." (retry)="load()" />
    } @else {
      @if (category(); as item) {
        <h2>{{ item.name }}</h2>
        <div class="grid">
          <div class="card"><strong>Slug</strong><div>{{ item.slug }}</div></div>
          <div class="card"><strong>Aktif</strong><div>{{ item.active ? 'Evet' : 'Hayir' }}</div></div>
          <div class="card"><strong>Seviye</strong><div>{{ item.level }}</div></div>
          <div class="card"><strong>Sira</strong><div>{{ item.displayOrder }}</div></div>
          <div class="card"><strong>Parent ID</strong><div>{{ item.parentId || '-' }}</div></div>
        </div>
        <p><strong>Aciklama:</strong> {{ item.description || '-' }}</p>
      }
    }
  `,
  styles: [`
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}
  `]
})
export class AdminCategoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly categories = inject(CategoryService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly category = signal<CategoryResponse | null>(null);

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
    this.categories.getById(id).subscribe({
      next: (category) => {
        this.loading.set(false);
        this.category.set(category);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
