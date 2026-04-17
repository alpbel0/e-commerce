import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroCube,
  heroShoppingBag,
  heroUser,
  heroChatBubbleLeftEllipsis,
  heroChartBar,
  heroUsers,
  heroBuildingStorefront,
  heroTag,
  heroClipboardDocumentList,
  heroCog6Tooth,
  heroArrowTrendingUp,
  heroTruck,
  heroStar,
  heroSquaresPlus,
  heroCurrencyDollar,
  heroUserGroup,
  heroHeart
} from '@ng-icons/heroicons/outline';

export interface AppSidebarLink {
  label: string;
  routerLink: string;
  exact?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [provideIcons({
    heroHome,
    heroCube,
    heroShoppingBag,
    heroUser,
    heroChatBubbleLeftEllipsis,
    heroChartBar,
    heroUsers,
    heroBuildingStorefront,
    heroTag,
    heroClipboardDocumentList,
    heroCog6Tooth,
    heroArrowTrendingUp,
    heroTruck,
    heroStar,
    heroSquaresPlus,
    heroCurrencyDollar,
    heroUserGroup,
    heroHeart
  })],
  template: `
    <nav class="sidebar" aria-label="Yan menü">
      <div class="sidebar__inner">
        @for (l of links; track l.routerLink) {
          <a
            class="sidebar__link"
            [routerLink]="l.routerLink"
            routerLinkActive="sidebar__link--active"
            [routerLinkActiveOptions]="{ exact: !!l.exact }"
            [attr.aria-label]="l.label"
          >
            @if (l.icon) {
              <span class="sidebar__link-icon">
                <ng-icon [name]="l.icon" size="18" />
              </span>
            }
            <span class="sidebar__link-label">{{ l.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      background: var(--clr-slate-900);
      border-right: 1px solid rgba(255,255,255,.06);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .sidebar__inner {
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sidebar__link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      color: var(--clr-slate-400);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background var(--trans-fast), color var(--trans-fast);
    }
    .sidebar__link:hover {
      background: rgba(255,255,255,.07);
      color: var(--clr-slate-100);
    }
    .sidebar__link--active {
      background: rgba(99,102,241,.2);
      color: #a5b4fc;
      font-weight: 600;
    }
    .sidebar__link--active .sidebar__link-icon { color: #818cf8; }
    .sidebar__link-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .sidebar__link-label { flex: 1; }
  `]
})
export class SidebarComponent {
  @Input({ required: true }) links: AppSidebarLink[] = [];
}
