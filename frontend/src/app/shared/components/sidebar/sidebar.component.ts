import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface AppSidebarLink {
  label: string;
  routerLink: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="side" aria-label="Yan menü">
      @for (l of links; track l.routerLink) {
        <a
          [routerLink]="l.routerLink"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: !!l.exact }"
        >
          {{ l.label }}
        </a>
      }
    </nav>
  `,
  styles: [
    `
      .side {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 200px;
        padding: 12px 0;
      }
      a {
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        color: #334155;
        text-decoration: none;
        font-size: 0.9rem;
      }
      a:hover {
        background: #f1f5f9;
      }
      a.active {
        background: #e0e7ff;
        color: #1e3a8a;
        font-weight: 600;
      }
    `
  ]
})
export class SidebarComponent {
  @Input({ required: true }) links: AppSidebarLink[] = [];
}
