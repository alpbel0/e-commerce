import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (open) {
      <div class="backdrop" (click)="onBackdrop()"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <h2 [id]="titleId" class="title">{{ title }}</h2>
        <p class="body">{{ message }}</p>
        <div class="actions">
          <button type="button" class="cancel" (click)="cancel.emit()">{{ cancelLabel }}</button>
          <button type="button" class="ok" (click)="confirm.emit()">{{ confirmLabel }}</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 1040;
      }
      .dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 1050;
        background: #fff;
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        min-width: min(360px, 92vw);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
      }
      .body {
        margin: 0 0 1.25rem;
        color: #475569;
        font-size: 0.95rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .cancel {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
      }
      .ok {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: none;
        background: #dc2626;
        color: #fff;
        cursor: pointer;
      }
    `
  ]
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Onay';
  @Input() message = '';
  @Input() confirmLabel = 'Evet';
  @Input() cancelLabel = 'Vazgeç';
  @Input() closeOnBackdrop = true;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  readonly titleId = 'confirm-dialog-title-' + Math.random().toString(36).slice(2, 9);

  onBackdrop(): void {
    if (this.closeOnBackdrop) {
      this.cancel.emit();
    }
  }
}
