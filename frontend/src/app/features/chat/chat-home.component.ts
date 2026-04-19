import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
      /* ── Layout ─────────────────────────────────── */
      :host { display: flex; flex-direction: column; height: 100%; }

      .chat-shell {
        display: flex;
        flex-direction: column;
        height: calc(100vh - var(--navbar-h, 60px) - var(--topnav-h, 48px));
        max-width: 900px;
        margin: 0 auto;
        width: 100%;
        padding: 0 24px;
      }

      /* ── Top bar ─────────────────────────────────── */
      .chat-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0 12px;
        border-bottom: 1px solid var(--border-default);
        flex-shrink: 0;
      }
      .chat-topbar__brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .chat-topbar__avatar {
        width: 44px; height: 44px;
        background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(2,132,199,.35);
      }
      .chat-topbar__title { font-size: 1rem; font-weight: 800; letter-spacing: -.02em; }
      .chat-topbar__sub { font-size: 0.72rem; color: var(--text-muted); }
      .btn-new-chat {
        display: inline-flex; align-items: center; gap: 6px;
        height: 34px; padding: 0 14px;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-default);
        background: #fff; color: var(--text-secondary);
        font-size: 0.8rem; font-weight: 700; cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-new-chat:hover { border-color: var(--clr-primary-300, #7dd3fc); color: var(--clr-primary-600); background: var(--clr-primary-50); }
      .btn-new-chat:disabled { opacity: .45; cursor: not-allowed; }

      /* ── Messages area ───────────────────────────── */
      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 28px 0 20px;
        display: flex;
        flex-direction: column;
        gap: 28px;
        scroll-behavior: smooth;
      }
      .messages-area::-webkit-scrollbar { width: 5px; }
      .messages-area::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }

      /* ── Empty state ─────────────────────────────── */
      .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 0;
        text-align: center;
        gap: 20px;
      }
      .empty-state__icon {
        width: 64px; height: 64px;
        background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
        border-radius: 20px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 24px rgba(2,132,199,.3);
        color: #fff;
        animation: pulse-glow 3s ease-in-out infinite;
      }
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 8px 24px rgba(2,132,199,.3); }
        50% { box-shadow: 0 8px 32px rgba(2,132,199,.55); }
      }
      .empty-state__title { font-size: 1.3rem; font-weight: 800; letter-spacing: -.02em; }
      .empty-state__sub { font-size: 0.875rem; color: var(--text-muted); max-width: 400px; line-height: 1.6; }
      .prompts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        width: 100%;
        max-width: 560px;
      }
      @media (max-width: 520px) { .prompts-grid { grid-template-columns: 1fr; } }
      .prompt-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: #fff;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-lg);
        text-align: left;
        cursor: pointer;
        transition: all var(--trans-fast);
        font-size: 0.8rem;
        color: var(--text-secondary);
        line-height: 1.4;
        font-weight: 500;
      }
      .prompt-card:hover { border-color: var(--clr-primary-400, #38bdf8); background: var(--clr-primary-50); color: var(--clr-primary-700); transform: translateY(-1px); box-shadow: var(--shadow-md); }
      .prompt-card:disabled { opacity: .5; cursor: not-allowed; }
      .prompt-card__icon { flex-shrink: 0; opacity: .5; margin-top: 1px; }

      /* ── Message bubbles ─────────────────────────── */
      .msg-row {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }
      .msg-row--user {
        flex-direction: row-reverse;
      }
      .msg-avatar {
        width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.85rem; font-weight: 800;
      }
      .msg-avatar--ai {
        background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
        color: #fff;
        box-shadow: 0 2px 10px rgba(2,132,199,.35);
      }
      .msg-avatar--user {
        background: var(--clr-slate-200, #e2e8f0);
        color: var(--text-secondary);
      }
      .msg-bubble {
        max-width: min(76%, 680px);
        border-radius: 18px;
        padding: 16px 20px;
        font-size: 0.95rem;
        line-height: 1.7;
        position: relative;
      }
      .msg-bubble--user {
        background: var(--clr-primary-600);
        color: #fff;
        border-radius: 18px 4px 18px 18px;
      }
      .msg-bubble--ai {
        background: #fff;
        border: 1px solid var(--border-default);
        box-shadow: var(--shadow-sm);
        border-radius: 4px 18px 18px 18px;
      }

      /* answer text */
      .answer-text p { margin: 0 0 8px; }
      .answer-text p:last-child { margin: 0; }
      .answer-text h3 { font-size: 0.95rem; font-weight: 700; margin: 10px 0 6px; }
      .answer-text strong { font-weight: 700; }
      .answer-text ul { margin: 6px 0 8px 18px; padding: 0; }
      .answer-text li { margin: 3px 0; }

      /* error badge */
      .error-box {
        display: flex; align-items: flex-start; gap: 8px;
        margin-top: 10px; padding: 10px 12px;
        background: #fef2f2; border: 1px solid #fecaca;
        border-radius: var(--radius-md); font-size: 0.8rem; color: #991b1b;
      }
      .error-box__code { font-weight: 700; margin-bottom: 2px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .04em; }

      /* execution steps */
      .steps-section { margin-top: 12px; }
      .steps-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
        text-transform: uppercase; letter-spacing: .06em;
        margin-bottom: 8px; cursor: pointer; user-select: none;
      }
      .steps-header svg { transition: transform var(--trans-fast); }
      .steps-header.open svg { transform: rotate(180deg); }
      .steps-pipeline {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }
      .step-pill {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px;
        border-radius: var(--radius-full);
        font-size: 0.68rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: .04em;
        white-space: nowrap;
      }
      .step-pill__dot { width: 5px; height: 5px; border-radius: 50%; }
      .step-completed { background: #dcfce7; color: #166534; }
      .step-completed .step-pill__dot { background: #166534; }
      .step-running   { background: #dbeafe; color: #1e40af; }
      .step-running .step-pill__dot { background: #1e40af; animation: blink .8s step-end infinite; }
      .step-pending   { background: #f1f5f9; color: #475569; }
      .step-pending .step-pill__dot { background: #94a3b8; }
      .step-failed    { background: #fee2e2; color: #991b1b; }
      .step-failed .step-pill__dot { background: #991b1b; }
      .step-skipped   { background: #f3f4f6; color: #6b7280; }
      .step-skipped .step-pill__dot { background: #9ca3af; }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

      /* table */
      .table-card {
        margin-top: 14px;
        overflow: auto;
        max-height: 340px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      table.result {
        width: 100%; border-collapse: collapse; font-size: 0.8rem;
      }
      table.result th {
        position: sticky; top: 0; z-index: 1;
        background: var(--clr-slate-50);
        padding: 8px 12px; text-align: left;
        font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .05em; color: var(--text-muted);
        border-bottom: 1px solid var(--border-default);
        white-space: nowrap;
      }
      table.result td {
        padding: 8px 12px; border-bottom: 1px solid var(--border-default);
        vertical-align: top; color: var(--text-secondary);
      }
      table.result tr:last-child td { border-bottom: none; }
      table.result tr:hover td { background: var(--clr-primary-50); }
      table.result th.col-metric, table.result td.col-metric,
      table.result th.col-currency, table.result td.col-currency { white-space: nowrap; }
      table.result th.col-id, table.result td.col-id { min-width: 160px; word-break: break-word; }
      table.result th.col-title, table.result td.col-title,
      table.result th.col-store, table.result td.col-store { min-width: 160px; }

      /* chart */
      .chart-card {
        margin-top: 14px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .chart-card__header {
        padding: 8px 12px; background: var(--clr-slate-50);
        border-bottom: 1px solid var(--border-default);
        font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
        text-transform: uppercase; letter-spacing: .06em;
      }
      .chart-card__body { padding: 4px; }
      .chart-notes { margin: 0; padding: 8px 12px 10px 24px; font-size: 0.78rem; color: var(--text-muted); }
      .chart-notes li { margin: 3px 0; }

      /* technical details */
      .tech-details {
        margin-top: 12px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
        font-size: 0.78rem;
      }
      .tech-details summary {
        cursor: pointer; list-style: none;
        padding: 8px 12px;
        background: var(--clr-slate-50);
        font-weight: 700; color: var(--text-muted);
        display: flex; align-items: center; gap: 6px;
        font-size: 0.72rem; text-transform: uppercase; letter-spacing: .06em;
        user-select: none;
      }
      .tech-details[open] summary { border-bottom: 1px solid var(--border-default); }
      .tech-details__body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
      .tech-stat { display: flex; gap: 16px; flex-wrap: wrap; }
      .tech-stat span { color: var(--text-muted); }
      .tech-stat strong { color: var(--text-secondary); }
      .sql-block {
        background: #0f172a; color: #94d2f8;
        border-radius: var(--radius-md);
        padding: 12px 14px; overflow: auto;
        font-size: 0.72rem; line-height: 1.6; font-family: monospace;
        max-height: 200px; margin-top: 4px;
      }
      .sql-block code { color: inherit; font-family: inherit; }

      /* skeleton / loading */
      .loading-row { padding: 4px 0 8px; }
      .skeleton {
        height: 15px; border-radius: 8px; background-size: 400% 100%;
        background-image: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
        animation: shimmer 1.4s ease-in-out infinite;
        margin-bottom: 12px;
      }
      .skeleton--sm { max-width: 50%; }
      .skeleton--md { max-width: 72%; }
      .skeleton--lg { max-width: 90%; }
      @keyframes shimmer {
        0%   { background-position: 400% 0; }
        100% { background-position: -400% 0; }
      }
      .typing-dots { display: flex; gap: 5px; margin: 0 0 14px; }
      .typing-dots span {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--clr-primary-400, #38bdf8);
        animation: bounce 1.2s ease-in-out infinite;
      }
      .typing-dots span:nth-child(2) { animation-delay: .2s; }
      .typing-dots span:nth-child(3) { animation-delay: .4s; }
      @keyframes bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-7px); }
      }

      /* Yükleme satırı: avatar + balon önizlemesi daha büyük */
      .msg-row--loading {
        gap: 16px;
        align-items: flex-start;
      }
      .msg-row--loading .msg-avatar {
        width: 52px;
        height: 52px;
      }
      .msg-row--loading .msg-bubble.loading-row {
        padding: 20px 24px;
        min-width: min(280px, 82vw);
      }
      .msg-row--loading .typing-dots {
        gap: 8px;
        margin-bottom: 18px;
      }
      .msg-row--loading .typing-dots span {
        width: 11px;
        height: 11px;
      }
      .msg-row--loading .skeleton {
        height: 18px;
        border-radius: 10px;
        margin-bottom: 14px;
      }

      /* retry */
      .btn-retry {
        display: inline-flex; align-items: center; gap: 6px;
        height: 30px; padding: 0 12px; margin-top: 10px;
        border-radius: var(--radius-md); border: 1.5px solid var(--border-default);
        background: #fff; color: var(--text-secondary);
        font-size: 0.78rem; font-weight: 600; cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-retry:hover { border-color: var(--clr-primary-300, #7dd3fc); color: var(--clr-primary-600); background: var(--clr-primary-50); }

      /* ── Composer ────────────────────────────────── */
      .composer-wrap {
        padding: 16px 0 24px;
        flex-shrink: 0;
        border-top: 1px solid var(--border-default);
      }
      .composer {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        background: #fff;
        border: 2px solid var(--border-default);
        border-radius: 20px;
        padding: 16px 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,.08);
        transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      }
      .composer:focus-within {
        border-color: var(--clr-primary-400, #38bdf8);
        box-shadow: 0 0 0 4px rgba(14,165,233,.13), 0 4px 20px rgba(0,0,0,.08);
      }
      .composer textarea {
        flex: 1;
        border: none; outline: none; resize: none;
        font: inherit; font-size: 1rem; background: transparent;
        line-height: 1.6; color: var(--text-primary);
        overflow-y: auto;
        padding: 2px 0;
        display: block;
      }
      .composer textarea::placeholder { color: var(--text-muted); font-size: 0.95rem; }
      .btn-send {
        width: 44px; height: 44px; flex-shrink: 0;
        border-radius: 12px; border: none;
        background: var(--clr-primary-600); color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: background var(--trans-fast), transform var(--trans-fast), box-shadow var(--trans-fast);
        box-shadow: 0 3px 10px rgba(2,132,199,.4);
      }
      .btn-send:hover:not(:disabled) { background: var(--clr-primary-700); transform: scale(1.06); }
      .btn-send:disabled { background: var(--clr-slate-300, #cbd5e1); box-shadow: none; cursor: not-allowed; transform: none; }
      .composer-hint { font-size: 0.72rem; color: var(--text-muted); text-align: center; margin-top: 8px; }

      @media (max-width: 640px) {
        .chat-shell { padding: 0 10px; }
        .empty-state__title { font-size: 1.1rem; }
        .msg-bubble { max-width: 88%; }
      }
    `,
  ],
  template: `
    <div class="chat-shell">
      <!-- Top bar -->
      <div class="chat-topbar">
        <div class="chat-topbar__brand">
          <div class="chat-topbar__avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <div class="chat-topbar__title">Analytics AI</div>
            <div class="chat-topbar__sub">E-ticaret veri asistanı</div>
          </div>
        </div>
        <button type="button" class="btn-new-chat" (click)="startNewChat()" [disabled]="loading()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Sohbet
        </button>
      </div>

      <!-- Messages / Empty -->
      <div class="messages-area" #messagesArea>

        <!-- Empty state -->
        <div *ngIf="!messages().length && !loading()" class="empty-state">
          <div class="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="empty-state__title">Merhaba! Size nasıl yardımcı olabilirim?</div>
          <div class="empty-state__sub">
            Rolünüze uygun e-ticaret analitik sorularını yanıtlarım. Aşağıdan bir örnek seçin veya kendi sorunuzu yazın.
          </div>
          <div class="prompts-grid">
            <button
              type="button"
              class="prompt-card"
              *ngFor="let q of samplePrompts()"
              (click)="sendMessage(q)"
              [disabled]="loading()"
            >
              <svg class="prompt-card__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ q }}
            </button>
          </div>
        </div>

        <!-- Message rows -->
        <div
          *ngFor="let message of messages()"
          class="msg-row"
          [class.msg-row--user]="message.role === 'user'"
        >
          <!-- Avatar -->
          <div [class]="message.role === 'user' ? 'msg-avatar msg-avatar--user' : 'msg-avatar msg-avatar--ai'">
            <ng-container *ngIf="message.role === 'assistant'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </ng-container>
            <ng-container *ngIf="message.role === 'user'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </ng-container>
          </div>

          <!-- Bubble -->
          <div [class]="message.role === 'user' ? 'msg-bubble msg-bubble--user' : 'msg-bubble msg-bubble--ai'">

            <!-- User content -->
            <span *ngIf="message.role === 'user'">{{ message.content }}</span>

            <!-- Assistant content -->
            <ng-container *ngIf="message.role === 'assistant'">
              <div class="answer-text" [innerHTML]="renderAnswer(message.content)"></div>

              <ng-container *ngIf="message.response as response">

                <!-- Error -->
                <div class="error-box" *ngIf="response.error?.code as code">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <div class="error-box__code">{{ code }}</div>
                    <div>{{ errorCodeHint(code) }}</div>
                  </div>
                </div>

                <!-- Execution steps -->
                <div class="steps-section" *ngIf="response.executionSteps?.length">
                  <div class="steps-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Pipeline
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  <div class="steps-pipeline">
                    <span
                      *ngFor="let step of response.executionSteps"
                      class="step-pill"
                      [ngClass]="stepBadgeClass(step)"
                      [title]="step.message"
                    >
                      <span class="step-pill__dot"></span>
                      {{ step.name }}
                    </span>
                  </div>
                </div>

                <!-- Data table -->
                <div class="table-card" *ngIf="response.table?.columns?.length">
                  <table class="result">
                    <thead>
                      <tr>
                        <th *ngFor="let column of response.table!.columns" [ngClass]="columnClass(column)">
                          {{ column }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of response.table!.rows">
                        <td *ngFor="let column of response.table!.columns; let i = index" [ngClass]="columnClass(column)">
                          {{ formatCell(column, row[i], row, response.table!.columns) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Chart -->
                <div class="chart-card" *ngIf="hasChart(response.visualization)">
                  <div class="chart-card__header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:5px;vertical-align:middle"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Görselleştirme
                  </div>
                  <div class="chart-card__body">
                    <app-chat-plotly [figure]="plotlyFigure(response.visualization)" />
                  </div>
                  <ul class="chart-notes" *ngIf="chartNotes(response).length">
                    <li *ngFor="let note of chartNotes(response)">{{ note }}</li>
                  </ul>
                </div>

                <!-- Technical details -->
                <details class="tech-details" *ngIf="response.technical">
                  <summary>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    Teknik Detaylar
                  </summary>
                  <div class="tech-details__body">
                    <div class="tech-stat">
                      <span>Satır: <strong>{{ response.technical.rowCount }}</strong></span>
                      <span>Süre: <strong>{{ response.technical.executionMs }} ms</strong></span>
                      <span>Onarım: <strong>{{ response.technical.retryCount }}</strong></span>
                    </div>
                    <div *ngIf="response.technical.sqlSummary" style="color:var(--text-secondary);font-size:.78rem">
                      <strong>Özet:</strong> {{ response.technical.sqlSummary }}
                    </div>
                    <pre *ngIf="showFullSql() && response.technical.generatedSql" class="sql-block"><code>{{ response.technical.generatedSql }}</code></pre>
                    <div *ngIf="!showFullSql() && response.technical.generatedSql" style="font-size:.75rem;color:var(--text-muted)">
                      Tam SQL bu rol için gizlendi.
                    </div>
                  </div>
                </details>

                <!-- Retry -->
                <div *ngIf="canRetry(response)">
                  <button type="button" class="btn-retry" (click)="retryAfterError()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    Yeniden Dene
                  </button>
                </div>

              </ng-container>
            </ng-container>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()" class="msg-row msg-row--loading">
          <div class="msg-avatar msg-avatar--ai">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="msg-bubble msg-bubble--ai loading-row">
            <div class="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <div class="skeleton skeleton--lg"></div>
            <div class="skeleton skeleton--md"></div>
            <div class="skeleton skeleton--sm"></div>
          </div>
        </div>

      </div>

      <!-- Composer -->
      <div class="composer-wrap">
        <form class="composer" (ngSubmit)="sendMessage()">
          <textarea
            #composerTextarea
            name="message"
            [(ngModel)]="draft"
            [disabled]="loading()"
            placeholder="Analitik sorunuzu yazın…"
            rows="1"
            (ngModelChange)="onDraftModelChange()"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button type="submit" class="btn-send" [disabled]="loading() || !draft.trim()" title="Gönder (Enter)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
        <div class="composer-hint">Enter ile gönder · Shift+Enter ile yeni satır</div>
      </div>
    </div>
  `,
})
export class ChatHomeComponent implements OnInit, AfterViewInit, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly authStore = inject(AuthStore);

  @ViewChild('messagesArea') private messagesArea?: ElementRef<HTMLDivElement>;
  @ViewChild('composerTextarea') private composerTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly sessionId = signal<string>('');
  draft = '';
  private shouldScroll = false;

  ngAfterViewInit(): void {
    this.syncComposerTextareaRows();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesArea?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onEnter(event: Event): void {
    const kbEvent = event as KeyboardEvent;
    if (!kbEvent.shiftKey) {
      kbEvent.preventDefault();
      this.sendMessage();
    }
  }

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

  /** Boşken 1 satır; içerik 1 satırı aşınca 3, 3 satırı aşınca 6 satır yüksekliği. */
  syncComposerTextareaRows(): void {
    const el = this.composerTextarea?.nativeElement;
    if (!el) return;

    if (!this.draft.trim()) {
      el.style.minHeight = '';
      el.style.height = '';
      el.style.overflow = '';
      el.rows = 1;
      return;
    }

    const linePx = this.textareaLineHeightPx(el);
    el.rows = 1;
    el.style.minHeight = '0';
    el.style.height = '0';
    el.style.overflow = 'hidden';

    const lines = Math.max(1, Math.ceil(el.scrollHeight / linePx));

    el.style.minHeight = '';
    el.style.height = '';
    el.style.overflow = '';

    el.rows = lines > 3 ? 6 : lines > 1 ? 3 : 1;
  }

  onDraftModelChange(): void {
    queueMicrotask(() => this.syncComposerTextareaRows());
  }

  private textareaLineHeightPx(el: HTMLTextAreaElement): number {
    const cs = getComputedStyle(el);
    const raw = cs.lineHeight;
    if (raw === 'normal') {
      const fontSize = parseFloat(cs.fontSize);
      return Number.isFinite(fontSize) ? fontSize * 1.6 : 19.2;
    }
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : parseFloat(cs.fontSize) * 1.6;
  }

  sendMessage(prefill?: string): void {
    const content = (prefill ?? this.draft).trim();
    if (!content || this.loading() || !this.sessionId()) {
      return;
    }
    this.draft = '';
    queueMicrotask(() => this.syncComposerTextareaRows());
    this.messages.update((messages) => [...messages, { role: 'user', content }]);
    this.loading.set(true);
    this.shouldScroll = true;

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
        this.shouldScroll = true;
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
        queueMicrotask(() => this.syncComposerTextareaRows());
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
