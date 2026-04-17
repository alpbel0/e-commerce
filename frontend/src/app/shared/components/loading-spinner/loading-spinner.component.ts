import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="spinner-wrap" [class.inline]="inline" role="status" aria-label="Yükleniyor">
      <div class="spinner">
        <div class="spinner__ring spinner__ring--outer"></div>
        <div class="spinner__ring spinner__ring--inner"></div>
      </div>
      @if (!inline) {
        <p class="spinner__label">Yükleniyor...</p>
      }
    </div>
  `,
  styles: [`
    .spinner-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 24px;
    }
    .spinner-wrap.inline {
      flex-direction: row;
      padding: 0;
      gap: 8px;
    }
    .spinner {
      position: relative;
      width: 36px;
      height: 36px;
    }
    .spinner-wrap.inline .spinner { width: 20px; height: 20px; }
    .spinner__ring {
      position: absolute;
      border-radius: 50%;
      border: 2.5px solid transparent;
      animation: spinRing .75s linear infinite;
    }
    .spinner__ring--outer {
      inset: 0;
      border-top-color: var(--clr-primary-500);
      border-right-color: var(--clr-primary-200);
    }
    .spinner__ring--inner {
      inset: 5px;
      border-top-color: var(--clr-accent-400);
      animation-direction: reverse;
      animation-duration: .5s;
    }
    .spinner-wrap.inline .spinner__ring--inner { inset: 3px; }
    .spinner__label {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    @keyframes spinRing { to { transform: rotate(360deg); } }
  `]
})
export class LoadingSpinnerComponent {
  @Input() inline = false;
}
