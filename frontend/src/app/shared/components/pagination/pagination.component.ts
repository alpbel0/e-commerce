import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalPages > 1) {
      <nav class="pg" aria-label="Sayfalama">
        <button type="button" [disabled]="currentPage <= 0 || disabled" (click)="go(currentPage - 1)">
          Önceki
        </button>
        <span class="info">{{ currentPage + 1 }} / {{ totalPages }}</span>
        <button
          type="button"
          [disabled]="currentPage >= totalPages - 1 || disabled"
          (click)="go(currentPage + 1)"
        >
          Sonraki
        </button>
      </nav>
    }
  `,
  styles: [
    `
      .pg {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 1rem;
      }
      button {
        padding: 0.35rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .info {
        font-size: 0.875rem;
        color: #475569;
      }
    `
  ]
})
export class PaginationComponent {
  /** 0-based sayfa indeksi (backend ile uyumlu) */
  @Input() currentPage = 0;
  @Input() totalPages = 0;
  @Input() disabled = false;
  @Output() pageChange = new EventEmitter<number>();

  go(page: number): void {
    if (page < 0 || page > this.totalPages - 1) return;
    this.pageChange.emit(page);
  }
}
