import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="auth-shell">
      <!-- Left decorative panel -->
      <div class="auth-panel" aria-hidden="true">
        <div class="auth-panel__glow auth-panel__glow--1"></div>
        <div class="auth-panel__glow auth-panel__glow--2"></div>
        <div class="auth-panel__glow auth-panel__glow--3"></div>
        <div class="auth-panel__content">
          <!-- Logo -->
          <div class="auth-panel__brand">
            <div class="auth-panel__logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <span class="auth-panel__brand-name">E-Commerce</span>
          </div>

          <div class="auth-panel__hero">
            <h1 class="auth-panel__title">Alışverişin<br/>akıllı adresi</h1>
            <p class="auth-panel__sub">Bireysel alışverişten kurumsal analitiğe,<br/>tek platformda her şey.</p>
          </div>

          <!-- Feature cards -->
          <div class="auth-panel__cards">
            <div class="auth-panel__card">
              <span class="auth-panel__card-icon auth-panel__card-icon--green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <div>
                <div class="auth-panel__card-title">Bireysel Alışveriş</div>
                <div class="auth-panel__card-desc">Ürünleri keşfet, sepete ekle, takip et</div>
              </div>
            </div>
            <div class="auth-panel__card">
              <span class="auth-panel__card-icon auth-panel__card-icon--blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              <div>
                <div class="auth-panel__card-title">Kurumsal Panel</div>
                <div class="auth-panel__card-desc">Mağaza yönetimi, satış analitiği</div>
              </div>
            </div>
            <div class="auth-panel__card">
              <span class="auth-panel__card-icon auth-panel__card-icon--amber">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <div>
                <div class="auth-panel__card-title">AI Chat Analiz</div>
                <div class="auth-panel__card-desc">Doğal dille akıllı raporlama</div>
              </div>
            </div>
          </div>

          <p class="auth-panel__footer">© 2026 E-Commerce</p>
        </div>
      </div>

      <!-- Right form panel -->
      <div class="auth-form-side">
        <div class="auth-form-wrapper animate-fade-in-up">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-shell {
      min-height: 100vh;
      display: flex;
    }

    /* ---- Left panel ---- */
    .auth-panel {
      flex: 0 0 440px;
      background: linear-gradient(160deg, #061929 0%, #0a2540 55%, #071e35 100%);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .auth-panel__glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
    }
    .auth-panel__glow--1 {
      width: 450px; height: 450px;
      background: rgba(14,165,233,.2);
      top: -120px; left: -120px;
    }
    .auth-panel__glow--2 {
      width: 320px; height: 320px;
      background: rgba(2,132,199,.14);
      bottom: 0; right: -60px;
    }
    .auth-panel__glow--3 {
      width: 200px; height: 200px;
      background: rgba(251,191,36,.08);
      top: 45%; left: 30%;
    }
    .auth-panel__content {
      position: relative;
      z-index: 1;
      padding: 44px 40px;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Brand */
    .auth-panel__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 56px;
    }
    .auth-panel__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px; height: 44px;
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      border-radius: var(--radius-md);
      color: #fff;
      box-shadow: 0 4px 20px rgba(14,165,233,.4);
    }
    .auth-panel__brand-name {
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -.02em;
    }

    /* Hero text */
    .auth-panel__hero { margin-bottom: 48px; }
    .auth-panel__title {
      font-size: 2.2rem;
      font-weight: 900;
      color: #fff;
      line-height: 1.1;
      letter-spacing: -.03em;
      margin-bottom: 14px;
    }
    .auth-panel__sub {
      font-size: 0.9rem;
      color: rgba(255,255,255,.5);
      line-height: 1.7;
    }

    /* Feature cards */
    .auth-panel__cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: auto;
    }
    .auth-panel__card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(8px);
      transition: background var(--trans-base);
    }
    .auth-panel__card:hover { background: rgba(255,255,255,.08); }
    .auth-panel__card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px; height: 36px;
      border-radius: var(--radius-md);
      flex-shrink: 0;
      color: #fff;
    }
    .auth-panel__card-icon--green  { background: rgba(14,165,233,.25); color: #7dd3fc; }
    .auth-panel__card-icon--blue   { background: rgba(96,165,250,.2);  color: #93c5fd; }
    .auth-panel__card-icon--amber  { background: rgba(251,191,36,.2);  color: #fcd34d; }
    .auth-panel__card-title { font-size: 0.875rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .auth-panel__card-desc  { font-size: 0.75rem; color: rgba(255,255,255,.45); }

    .auth-panel__footer {
      margin-top: 24px;
      font-size: 0.72rem;
      color: rgba(255,255,255,.25);
    }

    /* ---- Right panel ---- */
    .auth-form-side {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 32px;
      background: #fff;
    }
    .auth-form-wrapper {
      width: 100%;
      max-width: 420px;
    }

    @media (max-width: 768px) {
      .auth-panel { display: none; }
      .auth-form-side { background: var(--surface-bg); }
    }
  `]
})
export class AuthLayoutComponent {}
