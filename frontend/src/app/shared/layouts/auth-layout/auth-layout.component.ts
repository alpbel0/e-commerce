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
        <div class="auth-panel__content">
          <div class="auth-panel__logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 001.575 1.37L21 11l-4.512 3.88a2 2 0 00-.637 2.033L17.25 21 12 17.5 6.75 21l1.399-4.087a2 2 0 00-.637-2.033L3 11l5.513-.817a2 2 0 001.575-1.37z"/>
            </svg>
          </div>
          <h1 class="auth-panel__title">E-Commerce<br/>Analytics<br/>Platform</h1>
          <p class="auth-panel__sub">Multi-role analytics dashboard<br/>powered by AI Text2SQL</p>
          <div class="auth-panel__features">
            <div class="auth-panel__feature">
              <span class="auth-panel__feature-dot auth-panel__feature-dot--green"></span>
              Role-based access control
            </div>
            <div class="auth-panel__feature">
              <span class="auth-panel__feature-dot auth-panel__feature-dot--blue"></span>
              Real-time analytics dashboard
            </div>
            <div class="auth-panel__feature">
              <span class="auth-panel__feature-dot auth-panel__feature-dot--purple"></span>
              AI-powered Text2SQL chatbot
            </div>
          </div>
        </div>
      </div>

      <!-- Right form panel -->
      <div class="auth-form-side">
        <div class="auth-form-wrapper">
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

    /* Left panel */
    .auth-panel {
      flex: 0 0 420px;
      background: var(--clr-slate-900);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .auth-panel__glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }
    .auth-panel__glow--1 {
      width: 400px;
      height: 400px;
      background: rgba(99,102,241,.25);
      top: -80px;
      left: -100px;
    }
    .auth-panel__glow--2 {
      width: 300px;
      height: 300px;
      background: rgba(16,185,129,.15);
      bottom: 40px;
      right: -60px;
    }
    .auth-panel__content {
      position: relative;
      z-index: 1;
      padding: 48px 40px;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .auth-panel__logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      border-radius: var(--radius-lg);
      color: #fff;
      margin-bottom: 48px;
    }
    .auth-panel__title {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
      line-height: 1.1;
      margin-bottom: 16px;
    }
    .auth-panel__sub {
      font-size: 0.9rem;
      color: var(--clr-slate-400);
      line-height: 1.6;
      margin-bottom: 48px;
    }
    .auth-panel__features {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: auto;
    }
    .auth-panel__feature {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--clr-slate-300);
    }
    .auth-panel__feature-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .auth-panel__feature-dot--green  { background: var(--clr-accent-400); }
    .auth-panel__feature-dot--blue   { background: #60a5fa; }
    .auth-panel__feature-dot--purple { background: #a78bfa; }

    /* Right panel */
    .auth-form-side {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 32px;
      background: var(--surface-bg);
    }
    .auth-form-wrapper {
      width: 100%;
      max-width: 420px;
    }

    @media (max-width: 768px) {
      .auth-panel { display: none; }
      .auth-shell { min-height: 100vh; }
    }
  `]
})
export class AuthLayoutComponent {}
