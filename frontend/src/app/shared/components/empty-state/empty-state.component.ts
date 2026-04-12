import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty">
      @if (icon) {
        <div class="icon" aria-hidden="true">{{ icon }}</div>
      }
      <h3 class="title">{{ title }}</h3>
      @if (message) {
        <p class="msg">{{ message }}</p>
      }
      @if (actionLabel && actionLink) {
        <a class="btn" [routerLink]="actionLink">{{ actionLabel }}</a>
      }
    </div>
  `,
  styles: [
    `
      .empty {
        text-align: center;
        padding: 2rem 1rem;
        color: #475569;
      }
      .icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
        color: #0f172a;
      }
      .msg {
        margin: 0 0 1rem;
        font-size: 0.9rem;
      }
      .btn {
        display: inline-block;
        padding: 0.45rem 1rem;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        text-decoration: none;
        font-size: 0.9rem;
      }
    `
  ]
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input({ required: true }) title!: string;
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() actionLink: string | string[] = '';
}
