/**
 * バックエンドAPI用型定義（段階的TypeScript移行）
 */

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface AnalysisHistoryRecord {
  url?: string | null;
  inputType: 'url' | 'html';
  waitForJS: boolean;
  overallScore?: number;
  aioOverallScore?: number;
  combinedScore?: number;
  sessionId?: string | null;
  userId?: string | null;
  createdAt?: Date;
}
