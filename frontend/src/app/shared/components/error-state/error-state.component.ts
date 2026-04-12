import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <div class="err">
      <p class="msg">{{ message }}</p>
      @if (showRetry) {
        <button type="button" class="retry" (click)="retry.emit()">Tekrar dene</button>
      }
    </div>
  `,
  styles: [
    `
      .err {
        padding: 1rem;
        text-align: center;
      }
      .msg {
        color: #b91c1c;
        margin: 0 0 0.75rem;
      }
      .retry {
        padding: 0.4rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        cursor: pointer;
      }
    `
  ]
})
export class ErrorStateComponent {
  @Input() message = 'Bir hata oluştu.';
  @Input() showRetry = true;
  @Output() retry = new EventEmitter<void>();
}
