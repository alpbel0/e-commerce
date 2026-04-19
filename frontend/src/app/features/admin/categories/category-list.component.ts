import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminService } from '../../../core/api/admin.service';
import { CategoryService } from '../../../core/api/category.service';
import type { CategoryResponse } from '../../../core/models/category.models';
import { ToastService } from '../../../core/notify/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, ErrorStateComponent, ConfirmDialogComponent],
  templateUrl: './category-list.component.html',
  styles: [
    `
      .page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }

      /* Create card */
      .create {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        margin-bottom: 20px;
        max-width: 560px;
      }
      .create__header {
        padding: 14px 20px; border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50); display: flex; align-items: center; gap: 10px;
        font-size: 0.9rem; font-weight: 700;
      }
      .create__icon { width: 30px; height: 30px; background: var(--clr-primary-50); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--clr-primary-600); }
      .create__body { padding: 20px; }

      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
      @media (max-width: 480px) { .row { grid-template-columns: 1fr; } }
      .field { display: flex; flex-direction: column; gap: 4px; }
      label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); display: block; }
      input, textarea {
        height: 36px; padding: 0 10px;
        border: 1.5px solid var(--border-default); border-radius: var(--radius-md); font-size: 0.82rem;
        transition: border-color var(--trans-fast);
      }
      textarea { height: auto; padding: 8px 10px; }
      input:focus, textarea:focus { border-color: var(--clr-primary-500); outline: none; box-shadow: 0 0 0 3px rgba(14,165,233,.12); }
      .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-size: 0.82rem; color: var(--text-secondary); }
      .check input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--clr-primary-600); }

      .btn-add {
        height: 36px; padding: 0 16px;
        border: none; border-radius: var(--radius-md);
        background: var(--clr-primary-600); color: #fff;
        font-size: 0.82rem; font-weight: 700; cursor: pointer; margin-top: 4px;
        transition: background var(--trans-fast);
      }
      .btn-add:hover:not(:disabled) { background: var(--clr-primary-700); }
      .btn-add:disabled { opacity: .55; cursor: not-allowed; }

      /* Table card */
      .table-card { background: #fff; border: 1px solid var(--border-default); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }

      .cat-link { color: var(--clr-primary-600); text-decoration: none; font-weight: 600; font-size:.82rem; }
      .cat-link:hover { text-decoration: underline; }

      .inline {
        width: 100%; box-sizing: border-box;
        height: 30px; padding: 0 8px;
        border-radius: var(--radius-sm); border: 1.5px solid var(--border-default); font-size: 0.82rem;
        transition: border-color var(--trans-fast);
      }
      .inline:focus { border-color: var(--clr-primary-500); outline: none; }

      .btn-del {
        height: 28px; padding: 0 10px;
        border-radius: var(--radius-sm); border: 1px solid #fecaca;
        background: #fef2f2; color: var(--clr-danger-600);
        font-size: 0.73rem; font-weight: 600; cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-del:hover { background: #fee2e2; border-color: #fca5a5; }
    `
  ]
})
export class AdminCategoryListComponent implements OnInit {
  private readonly categoriesApi = inject(CategoryService);
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<CategoryResponse[]>([]);
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleteTarget = signal<CategoryResponse | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    displayOrder: [0, Validators.required],
    active: [true]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.categoriesApi.list().subscribe({
      next: (response) => {
        this.loading.set(false);
        this.items.set(response.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.saving.set(true);
    this.admin
      .createCategory({
        name: value.name.trim(),
        description: value.description.trim() || null,
        displayOrder: value.displayOrder,
        parentId: null,
        active: value.active
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createForm.reset({ name: '', description: '', displayOrder: 0, active: true });
          this.toast.showInfo('Kategori eklendi');
          this.load();
        },
        error: () => this.saving.set(false)
      });
  }

  patchField(category: CategoryResponse, field: 'name' | 'active', event: Event): void {
    const target = event.target as HTMLInputElement;
    if (field === 'name') {
      const name = target.value.trim();
      if (!name || name === category.name) return;
      this.pushPatch(category.id, { name });
      return;
    }
    const active = target.checked;
    if (active === category.active) return;
    this.pushPatch(category.id, { active });
  }

  private pushPatch(id: string, body: { name: string } | { active: boolean }): void {
    this.saving.set(true);
    this.admin.updateCategory(id, body).subscribe({
      next: (row) => {
        this.saving.set(false);
        this.items.update((list) => list.map((item) => (item.id === row.id ? row : item)));
        this.toast.showInfo('Kategori guncellendi');
      },
      error: () => this.saving.set(false)
    });
  }

  askDelete(category: CategoryResponse): void {
    this.deleteTarget.set(category);
    this.deleteOpen.set(true);
  }

  cancelDelete(): void {
    this.deleteOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const category = this.deleteTarget();
    if (!category) return;
    this.admin.deleteCategory(category.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.toast.showInfo('Kategori silindi');
        this.load();
      },
      error: () => this.cancelDelete()
    });
  }
}
