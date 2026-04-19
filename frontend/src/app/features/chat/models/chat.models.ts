// chat.models.ts - Chat Feature TypeScript Interfaces

export type RoleType = 'ADMIN' | 'CORPORATE' | 'INDIVIDUAL';
export type Language = 'tr' | 'en';

export interface StoreInfo {
  id: string;
  name: string;
}

export interface AccessScope {
  ownedStores: StoreInfo[];
}

export interface UserContext {
  userId: string;
  email: string;
  role: RoleType;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  response?: ChatAskResponse;
}

export interface ChatSessionStateResponse {
  sessionId: string;
  messages: ConversationMessage[];
  lastMessageAt: string;
}

export interface ChatAskRequest {
  sessionId: string;
  message: string;
  currentDate: string; // ISO 8601: YYYY-MM-DD
  user: UserContext;
  accessScope: AccessScope;
  conversation: ConversationMessage[];
}

// Execution Steps
export type ExecutionStepName =
  | 'GUARDRAILS'
  | 'SCHEMA_CONTEXT'
  | 'SQL_GENERATION'
  | 'SQL_VALIDATION'
  | 'QUERY_EXECUTION'
  | 'ERROR_REPAIR'
  | 'ANALYSIS'
  | 'VISUALIZATION';

export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ExecutionStepResponse {
  name: ExecutionStepName;
  status: ExecutionStepStatus;
  message: string;
}

// Table Response
export interface TableResponse {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

// Visualization
export type VisualizationType = 'line' | 'bar' | 'pie' | 'donut';

export interface VisualizationPoint {
  x: string | number | null;
  y: number | null;
}

export interface VisualizationSeries {
  name: string;
  data: VisualizationPoint[];
}

export interface VisualizationPlotly {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
}

export interface VisualizationResponse {
  type?: VisualizationType;
  data?: {
    type?: VisualizationType;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    series?: VisualizationSeries[];
    notes?: string[];
    plotly?: VisualizationPlotly;
  };
}

// Technical Details
export interface TechnicalResponse {
  generatedSql?: string;
  sqlSummary?: string;
  rowCount: number;
  executionMs: number;
  retryCount: number;
}

// Error Codes
export type ErrorCode =
  | 'OUT_OF_SCOPE'
  | 'PRIVACY_RISK'
  | 'AUTHORIZATION_RISK'
  | 'PROMPT_INJECTION'
  | 'DESTRUCTIVE_REQUEST'
  | 'AMBIGUOUS_QUESTION'
  | 'SQL_VALIDATION_FAILED'
  | 'SQL_SCOPE_VIOLATION'
  | 'SQL_EXECUTION_FAILED'
  | 'SQL_REPAIR_FAILED'
  | 'QUERY_TIMEOUT'
  | 'BACKEND_UNAVAILABLE'
  | 'SCHEMA_UNAVAILABLE'
  | 'MODEL_ERROR';

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
}

// Final Response
export interface ChatAskResponse {
  requestId: string;
  answer?: string;
  language?: Language;
  executionSteps: ExecutionStepResponse[];
  table?: TableResponse;
  visualization?: VisualizationResponse;
  technical?: TechnicalResponse;
  error?: ErrorResponse;
}
