import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="spinner" [class.inline]="inline" role="status" aria-label="Yükleniyor">
      <span class="dot"></span>
    </div>
  `,
  styles: [
    `
      .spinner {
        display: flex;
        justify-content: center;
        padding: 1rem;
      }
      .spinner.inline {
        padding: 0;
        display: inline-flex;
      }
      .dot {
        width: 28px;
        height: 28px;
        border: 3px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
  ]
})
export class LoadingSpinnerComponent {
  @Input() inline = false;
}
