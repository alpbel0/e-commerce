import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthStore } from '../../core/auth/auth.store';
import { ChatPlotlyComponent } from './components/chat-plotly.component';
import type {
  ChatAskRequest,
  ChatAskResponse,
  ChatSessionStateResponse,
  ConversationMessage,
  ErrorCode,
  ExecutionStepResponse,
  StoreInfo,
} from './models/chat.models';
import { ChatService } from './services/chat.service';
import { formatTableCell } from './utils/format-table-cell.util';
import { extractPlotlyFigure, hasRenderableVisualization } from './utils/plotly-figure.util';

@Component({
  selector: 'app-chat-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatPlotlyComponent],
  styles: [
    `
      .chat-page {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
      }
      .messages {
        display: grid;
        gap: 16px;
        margin: 20px 0;
        min-height: 120px;
      }
      .message {
        border: 1px solid #d7dde8;
        border-radius: 8px;
        padding: 14px;
        background: #fff;
      }
      .message.user {
        background: #eef6ff;
      }
      .answer-text {
        margin: 6px 0 0;
        line-height: 1.6;
      }
      .answer-text p {
        margin: 0 0 8px;
      }
      .answer-text h3 {
        margin: 2px 0 8px;
        font-size: 16px;
        line-height: 1.35;
      }
      .answer-text strong {
        font-weight: 700;
      }
      .answer-text ul {
        margin: 8px 0 8px 18px;
        padding: 0;
      }
      .answer-text li {
        margin: 4px 0;
      }
      .message.loading-msg {
        min-height: 120px;
        opacity: 0.92;
      }
      .skeleton-line {
        height: 12px;
        background: linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0);
        background-size: 200% 100%;
        animation: sk 1.2s ease-in-out infinite;
        border-radius: 4px;
        margin-top: 10px;
        max-width: 92%;
      }
      .skeleton-line.short {
        max-width: 55%;
      }
      @keyframes sk {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      .steps {
        margin-top: 12px;
        display: grid;
        gap: 8px;
        font-size: 13px;
      }
      .step-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        color: #334155;
      }
      .step-name {
        font-weight: 600;
        min-width: 140px;
      }
      .step-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .step-completed {
        background: #dcfce7;
        color: #166534;
      }
      .step-running {
        background: #dbeafe;
        color: #1e40af;
      }
      .step-pending {
        background: #f1f5f9;
        color: #475569;
      }
      .step-failed {
        background: #fee2e2;
        color: #991b1b;
      }
      .step-skipped {
        background: #f3f4f6;
        color: #6b7280;
      }
      .composer {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      textarea {
        flex: 1;
        min-height: 88px;
        resize: vertical;
        padding: 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
      }
      button.primary {
        border: 0;
        border-radius: 8px;
        padding: 10px 16px;
        background: #0f766e;
        color: #fff;
        cursor: pointer;
      }
      button.primary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      button.ghost {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 12px;
        background: #fff;
        cursor: pointer;
        font-size: 13px;
      }
      .table-wrap {
        margin-top: 12px;
        overflow: auto;
        max-height: 360px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      table.result {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      table.result th,
      table.result td {
        border-bottom: 1px solid #e2e8f0;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      table.result th {
        position: sticky;
        top: 0;
        background: #f8fafc;
        z-index: 1;
      }
      table.result th.col-metric,
      table.result td.col-metric,
      table.result th.col-currency,
      table.result td.col-currency {
        white-space: nowrap;
      }
      table.result th.col-id,
      table.result td.col-id {
        min-width: 180px;
        word-break: break-word;
      }
      table.result th.col-title,
      table.result td.col-title,
      table.result th.col-store,
      table.result td.col-store {
        min-width: 170px;
      }
      table.result th.col-brand,
      table.result td.col-brand {
        min-width: 120px;
      }
      table.result th.col-metric,
      table.result td.col-metric {
        min-width: 110px;
      }
      table.result th.col-currency,
      table.result td.col-currency {
        min-width: 90px;
      }
      details.tech {
        margin-top: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 12px;
        background: #fafafa;
      }
      details.tech summary {
        cursor: pointer;
        font-weight: 600;
        color: #334155;
      }
      .samples {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0 8px;
      }
      .samples button {
        text-align: left;
      }
      .retry-row {
        margin-top: 10px;
      }
      .chart-block {
        margin-top: 14px;
      }
      .chart-notes {
        margin: 8px 0 0;
        padding-left: 18px;
        color: #475569;
        font-size: 13px;
      }
      .chart-notes li {
        margin: 4px 0;
      }
      .sql-block {
        margin-top: 8px;
        padding: 10px;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        overflow: auto;
        font-size: 12px;
      }
      .muted {
        font-size: 13px;
        color: #64748b;
        margin-top: 8px;
      }
      .error-code {
        font-size: 12px;
        color: #64748b;
        margin-top: 6px;
      }
      @media (max-width: 640px) {
        .chat-page {
          padding: 12px;
        }
        .composer {
          flex-direction: column;
        }
        button.primary {
          width: 100%;
        }
        .step-name {
          min-width: 100%;
        }
      }
    `,
  ],
  template: `
    <section class="chat-page">
      <h2>Analytics sohbet</h2>
      <p>Rolünüze uygun e-ticaret analitik soruları sorun.</p>

      <div class="samples">
        <button type="button" class="ghost" (click)="startNewChat()" [disabled]="loading()">
          New Chat
        </button>
      </div>
      <div class="messages">
        <article
          *ngFor="let message of messages()"
          class="message"
          [class.user]="message.role === 'user'"
        >
          <strong>{{ message.role === 'user' ? 'Siz' : 'Asistan' }}</strong>
          <p *ngIf="message.role === 'user'">{{ message.content }}</p>
          <div
            *ngIf="message.role === 'assistant'"
            class="answer-text"
            [innerHTML]="renderAnswer(message.content)"
          ></div>

          <ng-container *ngIf="message.role === 'assistant' && message.response as response">
            <div class="error-code" *ngIf="response.error?.code as code">
              Kod: {{ code }} — {{ errorCodeHint(code) }}
            </div>

            <div class="steps" *ngIf="response.executionSteps?.length">
              <div *ngFor="let step of response.executionSteps" class="step-row">
                <span class="step-name">{{ step.name }}</span>
                <span class="step-badge" [ngClass]="stepBadgeClass(step)">{{ step.status }}</span>
                <span>{{ step.message }}</span>
              </div>
            </div>

            <div class="table-wrap" *ngIf="response.table?.columns?.length">
              <table class="result">
                <thead>
                  <tr>
                    <th
                      *ngFor="let column of response.table!.columns"
                      [ngClass]="columnClass(column)"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of response.table!.rows">
                    <td
                      *ngFor="let column of response.table!.columns; let i = index"
                      [ngClass]="columnClass(column)"
                    >
                      {{ formatCell(column, row[i], row, response.table!.columns) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="chart-block" *ngIf="hasChart(response.visualization)">
              <app-chat-plotly [figure]="plotlyFigure(response.visualization)" />
              <ul class="chart-notes" *ngIf="chartNotes(response).length">
                <li *ngFor="let note of chartNotes(response)">{{ note }}</li>
              </ul>
            </div>

            <details class="tech" *ngIf="response.technical">
              <summary>Teknik detaylar</summary>
              <p *ngIf="response.technical.sqlSummary"><strong>Özet:</strong> {{ response.technical.sqlSummary }}</p>
              <pre
                *ngIf="showFullSql() && response.technical.generatedSql"
                class="sql-block"
              ><code>{{ response.technical.generatedSql }}</code></pre>
              <p *ngIf="!showFullSql() && response.technical.generatedSql" class="muted">
                Tam SQL metni bu rol için gösterilmez; yalnızca özet kullanılabilir.
              </p>
              <p>
                Satır: {{ response.technical.rowCount }} | Süre: {{ response.technical.executionMs }} ms | Onarım
                denemesi: {{ response.technical.retryCount }}
              </p>
            </details>

            <div class="retry-row" *ngIf="canRetry(response)">
              <button type="button" class="ghost" (click)="retryAfterError()">Yeniden dene</button>
            </div>
          </ng-container>
        </article>

        <article *ngIf="loading()" class="message loading-msg" aria-busy="true">
          <strong>Asistan</strong>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </article>
      </div>

      <div *ngIf="!messages().length" class="empty">
        <p>Örnek sorular (rolünüze göre):</p>
        <div class="samples">
          <button
            type="button"
            class="ghost"
            *ngFor="let q of samplePrompts()"
            (click)="sendMessage(q)"
          >
            {{ q }}
          </button>
        </div>
      </div>

      <form class="composer" (ngSubmit)="sendMessage()">
        <textarea
          name="message"
          [(ngModel)]="draft"
          [disabled]="loading()"
          placeholder="Analitik sorunuzu yazın"
        ></textarea>
        <button type="submit" class="primary" [disabled]="loading() || !draft.trim()">
          {{ loading() ? 'Gönderiliyor…' : 'Gönder' }}
        </button>
      </form>
    </section>
  `,
})
export class ChatHomeComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly authStore = inject(AuthStore);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly sessionId = signal<string>('');
  draft = '';

  readonly samplePrompts = computed(() => {
    const role = this.authStore.activeRole() ?? 'INDIVIDUAL';
    if (role === 'ADMIN') {
      return [
        'Platform genelinde son 30 günde toplam sipariş ve ciro özeti',
        'Bu ay en yüksek ciroya sahip mağazalar hangileri?',
      ];
    }
    if (role === 'CORPORATE') {
      return [
        'Mağazalarımı ciroya göre karşılaştır',
        'Son 30 günde en çok satan ürünler hangileri?',
      ];
    }
    return [
      'Son 30 günde kategori bazında ne kadar harcadım?',
      'Bu ay en çok harcama yaptığım kategori hangisi?',
    ];
  });

  readonly showFullSql = computed(() => {
    const role = this.authStore.activeRole() ?? 'INDIVIDUAL';
    return role === 'ADMIN' || role === 'CORPORATE';
  });

  private readonly conversation = computed<ConversationMessage[]>(() =>
    this.messages()
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }))
  );

  readonly formatCell = formatTableCell;
  readonly hasChart = hasRenderableVisualization;
  readonly plotlyFigure = extractPlotlyFigure;
  readonly renderAnswer = renderAssistantMarkdown;

  ngOnInit(): void {
    this.chatService.getActiveSession().subscribe({
      next: (state) => this.applySessionState(state),
      error: () => {
        this.sessionId.set(crypto.randomUUID());
        this.messages.set([]);
      },
    });
  }

  sendMessage(prefill?: string): void {
    const content = (prefill ?? this.draft).trim();
    if (!content || this.loading() || !this.sessionId()) {
      return;
    }
    this.draft = '';
    this.messages.update((messages) => [...messages, { role: 'user', content }]);
    this.loading.set(true);

    this.chatService.askQuestion(this.buildRequest(content)).subscribe({
      next: (response) => {
        this.messages.update((messages) => [
          ...messages,
          {
            role: 'assistant',
            content: this.assistantText(response),
            response,
          },
        ]);
        this.loading.set(false);
      },
    });
  }

  startNewChat(): void {
    if (this.loading()) {
      return;
    }
    this.chatService.createNewSession().subscribe({
      next: (state) => {
        this.draft = '';
        this.applySessionState(state);
      },
    });
  }

  retryAfterError(): void {
    const msgs = this.messages();
    const last = msgs[msgs.length - 1];
    const prev = msgs[msgs.length - 2];
    if (last?.role !== 'assistant' || !last.response?.error || prev?.role !== 'user') {
      return;
    }
    const userContent = prev.content;
    this.messages.update((m) => m.slice(0, -1));
    this.loading.set(true);
    this.chatService.askQuestion(this.buildRequest(userContent)).subscribe({
      next: (response) => {
        this.messages.update((messages) => [
          ...messages,
          {
            role: 'assistant',
            content: this.assistantText(response),
            response,
          },
        ]);
        this.loading.set(false);
      },
    });
  }

  canRetry(response: ChatAskResponse): boolean {
    const c = response.error?.code;
    return c === 'BACKEND_UNAVAILABLE' || c === 'MODEL_ERROR' || c === 'SCHEMA_UNAVAILABLE';
  }

  stepBadgeClass(step: ExecutionStepResponse): string {
    switch (step.status) {
      case 'completed':
        return 'step-completed';
      case 'running':
        return 'step-running';
      case 'pending':
        return 'step-pending';
      case 'failed':
        return 'step-failed';
      case 'skipped':
        return 'step-skipped';
      default:
        return 'step-pending';
    }
  }

  errorCodeHint(code: ErrorCode): string {
    const hints: Partial<Record<ErrorCode, string>> = {
      OUT_OF_SCOPE: 'Soru analitik kapsam dışında.',
      PRIVACY_RISK: 'Kişisel veri talebi güvenlik nedeniyle reddedildi.',
      DESTRUCTIVE_REQUEST: 'Veri değiştiren işlemler desteklenmiyor.',
      AMBIGUOUS_QUESTION: 'Soru netleştirilmeli.',
      SQL_VALIDATION_FAILED: 'Sorgu güvenlik doğrulamasından geçemedi.',
      SQL_SCOPE_VIOLATION: 'Sorgu rol kapsamını aşıyor.',
      SQL_EXECUTION_FAILED: 'Sorgu çalıştırılamadı.',
      SQL_REPAIR_FAILED: 'Sorgu otomatik onarılamadı.',
      QUERY_TIMEOUT: 'Zaman aşımı; daha dar tarih aralığı deneyin.',
      BACKEND_UNAVAILABLE: 'Servis kullanılamıyor.',
      SCHEMA_UNAVAILABLE: 'Şema bilgisi alınamadı.',
      MODEL_ERROR: 'Model yanıtı üretilemedi.',
      AUTHORIZATION_RISK: 'Yetki kapsamini asan veri talebi reddedildi.',
      PROMPT_INJECTION: 'Sistem talimatlarini degistirme denemesi reddedildi.',
    };
    return hints[code] ?? '';
  }

  private assistantText(response: ChatAskResponse): string {
    if (response.answer?.trim()) {
      return response.answer;
    }
    if (response.error?.message) {
      return response.error.message;
    }
    return 'Yanıt alınamadı.';
  }

  private buildRequest(message: string): ChatAskRequest {
    const currentUser = this.authStore.currentUser();
    const role = this.authStore.activeRole() ?? 'INDIVIDUAL';
    return {
      sessionId: this.sessionId(),
      message,
      currentDate: new Date().toISOString().slice(0, 10),
      user: {
        userId: currentUser?.id ?? '00000000-0000-0000-0000-000000000000',
        email: currentUser?.email ?? '',
        role,
      },
      accessScope: {
        ownedStores: this.ownedStores(),
      },
      conversation: this.conversation(),
    };
  }

  private ownedStores(): StoreInfo[] {
    const ids = this.authStore.ownedStoreIds();
    const names = this.authStore.ownedStoreNames();
    return ids.map((id, index) => ({ id, name: names[index] ?? `Store-${id}` }));
  }

  private applySessionState(state: ChatSessionStateResponse): void {
    this.sessionId.set(state.sessionId);
    this.messages.set(
      state.messages.map((message) => ({
        role: message.role,
        content: message.content,
        response: message.response,
      }))
    );
  }

  columnClass(column: string): string {
    const normalized = column.trim().toLowerCase();
    if (/(^|[\s_])(id|product id|store id|order id)([\s_]|$)/i.test(normalized)) {
      return 'col-id';
    }
    if (/(title|product title)/i.test(normalized)) {
      return 'col-title';
    }
    if (/(store name|seller|merchant|mağaza|magaza)/i.test(normalized)) {
      return 'col-store';
    }
    if (/brand/i.test(normalized)) {
      return 'col-brand';
    }
    if (/(avg rating|rating|review count|count|orders|quantity|qty|score|puan)/i.test(normalized)) {
      return 'col-metric';
    }
    if (/currency/i.test(normalized)) {
      return 'col-currency';
    }
    return '';
  }

  chartNotes(response: ChatAskResponse): string[] {
    const notes = response.visualization?.data?.notes;
    return Array.isArray(notes) ? notes.filter((note): note is string => typeof note === 'string' && note.trim().length > 0) : [];
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  response?: ChatAskResponse;
}

function renderAssistantMarkdown(value: string): string {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\s+-\s+/g, '\n- ')
    .trim();

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = (): void => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(`<h3>${formatInline(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      blocks.push(`<h3>${formatInline(line.slice(2))}</h3>`);
      continue;
    }
    if (line.startsWith('- ')) {
      listItems.push(`<li>${formatInline(line.slice(2))}</li>`);
      continue;
    }
    flushList();
    blocks.push(`<p>${formatInline(line)}</p>`);
  }
  flushList();

  return blocks.join('');
}

function formatInline(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
