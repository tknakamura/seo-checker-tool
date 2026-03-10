/**
 * SEOChecker およびチェック結果の型定義
 */

export interface SEOCheckResult {
  url?: string;
  timestamp?: string;
  overallScore?: number;
  aioOverallScore?: number;
  combinedScore?: number;
  checks: Record<string, SEOCheckItem>;
  aio?: AIOChecks;
  conciseRecommendations?: ConciseRecommendation[];
  detailedAnalysis?: unknown;
  detailedReport?: unknown;
}

export interface SEOCheckItem {
  score: number;
  current?: string;
  length?: number;
  issues?: string[];
  recommendations?: string[];
}

export interface AIOChecks {
  overallScore: number;
  checks: Record<string, SEOCheckItem>;
}

export interface ConciseRecommendation {
  priority: string;
  fix: string;
  element: string;
  location: string;
  count?: number;
}

declare class SEOChecker {
  constructor();
  calculateFullWidthLength(text: string | null): number;
  checkSEO(url: string | null, html: string | null, waitForJS: boolean): Promise<SEOCheckResult>;
  generateReport(results: SEOCheckResult): string;
}

export { SEOChecker };
