import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface UiSettings {
  compactTables: boolean;
  showRevenueWidgets: boolean;
  defaultPageSize: number;
}

const SETTINGS_KEY = 'admin_ui_settings';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './system-settings.component.html',
  styles: [
    `
      .panel {
        max-width: 640px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .row:last-child {
        border-bottom: none;
      }
      input[type='number'] {
        width: 100px;
        padding: 0.4rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
    `
  ]
})
export class SystemSettingsComponent implements OnInit {
  readonly settings = signal<UiSettings>({
    compactTables: false,
    showRevenueWidgets: true,
    defaultPageSize: 15
  });

  ngOnInit(): void {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try {
      this.settings.set({ ...this.settings(), ...JSON.parse(raw) });
    } catch {
      localStorage.removeItem(SETTINGS_KEY);
    }
  }

  update<K extends keyof UiSettings>(key: K, value: UiSettings[K]): void {
    const next = { ...this.settings(), [key]: value };
    this.settings.set(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }
}
